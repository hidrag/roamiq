import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  ExternalLink,
  FileText,
  Image,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import {
  deleteDocument,
  documentKeys,
  downloadDocument,
  fetchDocuments,
  formatFileSize,
  uploadDocument,
} from '@/features/vault/documentService'
import { cn, sanitizeDisplayTitle } from '@/lib/utils'
import type { TripDocument } from '@/types/database'

interface TripVaultViewProps {
  tripId: string
  userId: string
  /** Viewer role hides upload zone and delete buttons. */
  canEdit: boolean
}

const BADGE_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
}

/**
 * Drag-and-drop document vault. All validation happens before any storage
 * write; titles are sanitized on render, external links are noopener'd.
 */
export function TripVaultView({ tripId, userId, canEdit }: TripVaultViewProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: documentKeys.list(tripId),
    queryFn: () => fetchDocuments(tripId),
    enabled: Boolean(tripId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(tripId, userId, file, file.name),
    onSuccess: () => {
      setActionError(null)
      toast.success('Document uploaded')
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(tripId) })
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => deleteDocument(id, path),
    onSuccess: () => {
      setActionError(null)
      toast.success('Document deleted')
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(tripId) })
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  })

  const downloadMutation = useMutation({
    mutationFn: (document: TripDocument) => downloadDocument(document),
    onSuccess: () => toast.success('Download started'),
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    // One at a time keeps the 5 MB/allowlist feedback unambiguous.
    uploadMutation.mutate(files[0])
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = (document: TripDocument) => {
    if (window.confirm(`Delete "${sanitizeDisplayTitle(document.title)}"? This cannot be undone.`)) {
      deleteMutation.mutate({ id: document.id, path: document.storage_path })
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Drop zone */}
      {canEdit ? (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Upload documents"
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-input hover:border-primary/50 hover:bg-accent/30',
        )}
      >
        {uploadMutation.isPending ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {uploadMutation.isPending ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG or WEBP · max 5 MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      ) : null}

      {actionError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {/* Empty state */}
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : query.data && query.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tickets or reservations added yet. Upload your boarding passes, hotel
          confirmations, or insurance PDFs.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data?.map((document) => {
            const isImage = document.mime_type.startsWith('image/')
            const Icon = isImage ? Image : FileText
            const badge =
              BADGE_BY_MIME[document.mime_type] ?? document.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE'
            const title = sanitizeDisplayTitle(document.title)
            return (
              <div key={document.id} className="flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={title}>
                      {title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {badge} · {formatFileSize(document.size_bytes)}
                    </p>
                  </div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {badge}
                  </span>
                </div>
                <div className="mt-auto flex gap-1.5">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={document.public_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={downloadMutation.isPending}
                    onClick={() => downloadMutation.mutate(document)}
                  >
                    {downloadMutation.isPending && downloadMutation.variables?.id === document.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      aria-label={`Delete ${title}`}
                      onClick={() => handleDelete(document)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
