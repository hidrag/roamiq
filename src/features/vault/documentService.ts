import { supabase } from '@/lib/supabase'
import { sanitizeDisplayTitle } from '@/lib/utils'
import type { DocumentKind, TripDocument } from '@/types/database'

/**
 * Trip document vault: MIME-allowlisted, 5 MB-capped, collision-proof paths.
 * Filenames are never trusted — extension comes from the validated MIME type
 * and the stored path is `${tripId}/${crypto.randomUUID()}.${ext}`.
 */

const BUCKET = 'trip-documents'
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024 // 5 MB

/** MIME allowlist — SVG, executables and anything unknown are rejected. */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function documentValidationError(file: File): string | null {
  if (!(file.type in ALLOWED_MIME_TYPES)) {
    return `"${file.name}" rejected — only PDF, JPG, PNG and WEBP files up to 5 MB are allowed.`
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`
  }
  return null
}

function guessKind(name: string): DocumentKind {
  const lower = name.toLowerCase()
  if (/board|ticket|flight|pass|pnr/.test(lower)) return 'ticket'
  if (/hotel|booking|reservation|airbnb/.test(lower)) return 'booking'
  if (/insurance|policy/.test(lower)) return 'insurance'
  if (/passport|visa|\bid\b/.test(lower)) return 'id'
  if (/note/.test(lower)) return 'note'
  return 'other'
}

/** Validates + uploads one file and records it. Throws a friendly Error. */
export async function uploadDocument(
  tripId: string,
  uploadedBy: string,
  file: File,
  displayName: string,
): Promise<TripDocument> {
  const invalid = documentValidationError(file)
  if (invalid) throw new Error(invalid)

  const extension = ALLOWED_MIME_TYPES[file.type]
  const storagePath = `${tripId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  const title = sanitizeDisplayTitle(displayName) || file.name

  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      trip_id: tripId,
      uploaded_by: uploadedBy,
      kind: guessKind(file.name),
      title,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      meta: { original_name: file.name },
    })
    .select()
    .single()

  if (error) {
    // Roll the orphaned storage object back.
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(error.message)
  }

  return data as TripDocument
}

/** Removes the storage object, then the DB row. */
export async function deleteDocument(
  documentId: string,
  storagePath: string,
): Promise<void> {
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath])
  // Missing-file errors are fine (already gone); anything else still proceeds
  // so a lost object never blocks cleaning the row.
  if (removeError && !/not found|404/i.test(removeError.message)) {
    throw new Error(`Could not remove file: ${removeError.message}`)
  }

  const { error } = await supabase.from('trip_documents').delete().eq('id', documentId)
  if (error) throw new Error(error.message)
}

export async function fetchDocuments(tripId: string): Promise<TripDocument[]> {
  const { data, error } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TripDocument[]
}

/** Fetch as blob and trigger a browser download (cross-origin-safe). */
export async function downloadDocument(document: TripDocument): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(document.storage_path)
  if (error) throw new Error(`Download failed: ${error.message}`)
  const url = URL.createObjectURL(data)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = document.title || `document-${document.id}`
  anchor.rel = 'noopener noreferrer'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const documentKeys = {
  list: (tripId: string) => ['documents', tripId] as const,
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
