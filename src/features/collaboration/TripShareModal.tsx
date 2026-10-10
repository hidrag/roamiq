import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Loader2, Trash2, UserPlus, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  collaborationKeys,
  getTripMembers,
  inviteMemberByEmail,
  removeMember,
  updateTripVisibility,
} from '@/features/collaboration/collaborationService'
import { toast } from '@/components/ui/toast'
import { cn, errorMessage, sanitizeDisplayTitle } from '@/lib/utils'
import type { Trip } from '@/types/database'

interface TripShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  currentUserId: string
  isOwner: boolean
  /** Called after visibility toggles so the parent can refetch the trip. */
  onVisibilityChanged: () => void
}

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-primary/15 text-primary',
  editor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  viewer: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
}

/** Members, invite-by-email, and the public link — owner-gated where needed. */
export function TripShareModal({
  open,
  onOpenChange,
  trip,
  currentUserId,
  isOwner,
  onVisibilityChanged,
}: TripShareModalProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const membersQuery = useQuery({
    queryKey: collaborationKeys.members(trip.id),
    queryFn: () => getTripMembers(trip.id),
    enabled: open,
  })

  const inviteMutation = useMutation({
    mutationFn: () => inviteMemberByEmail(trip.id, email, role, currentUserId),
    onSuccess: () => {
      setEmail('')
      setInviteError(null)
      toast.success('Member invited')
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.members(trip.id) })
    },
    onError: (error) => setInviteError(errorMessage(error)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(trip.id, userId),
    onSuccess: () => {
      toast.success('Member removed')
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.members(trip.id) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const isPublic = trip.is_public === true
  const publicUrl = `${window.location.origin}/trips/${trip.id}?view=public`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success('Trip link copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not access the clipboard — copy the link manually.')
    }
  }

  const handleTogglePublic = async (next: boolean) => {
    try {
      await updateTripVisibility(trip.id, next)
      onVisibilityChanged()
      toast.success(next ? 'Public link enabled' : 'Public link disabled')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-print sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Share “{sanitizeDisplayTitle(trip.title)}”
          </DialogTitle>
          <DialogDescription>
            Invite collaborators by email, or share a read-only public link.
          </DialogDescription>
        </DialogHeader>

        {/* Members */}
        <section className="space-y-2" aria-label="Trip members">
          {membersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : membersQuery.isError ? (
            // RLS/offline degradations must not break the modal.
            <p className="text-sm text-muted-foreground">
              Member list unavailable right now — you can still share the public link.
            </p>
          ) : (
            <ul className="space-y-2">
              {membersQuery.data?.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 rounded-lg border p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {member.displayName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge className={cn('border-transparent', ROLE_STYLE[member.role])}>
                    {member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer'}
                  </Badge>
                  {isOwner && !member.isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label={`Remove ${member.displayName}`}
                      disabled={removeMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${member.displayName} from this trip?`,
                          )
                        ) {
                          removeMutation.mutate(member.userId)
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Invite */}
        {isOwner && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              setInviteError(null)
              inviteMutation.mutate()
            }}
          >
            <Label htmlFor="invite-email">Invite by email</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-48 flex-1"
                autoComplete="off"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="h-9 rounded-md border border-input bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Invite role"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button
                type="submit"
                size="sm"
                disabled={inviteMutation.isPending || email.trim().length === 0}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Invite
              </Button>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </form>
        )}

        {/* Public link */}
        <section className="space-y-2 rounded-lg border p-3" aria-label="Public itinerary link">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Public Itinerary Link
            </span>
            <span className="relative inline-flex h-6 w-11 items-center">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={!isOwner}
                onChange={(e) => void handleTogglePublic(e.target.checked)}
                className="peer sr-only"
                aria-label="Toggle public itinerary link"
              />
              <span
                className={cn(
                  'h-6 w-11 rounded-full transition-colors',
                  isPublic ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  isPublic && 'translate-x-5',
                )}
              />
            </span>
          </label>
          {isPublic && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                aria-label="Public link"
                className="h-9 min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 text-xs text-muted-foreground"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy Link
              </Button>
            </div>
          )}
          {!isOwner && <p className="text-xs text-muted-foreground">Only the owner can change sharing.</p>}
        </section>
      </DialogContent>
    </Dialog>
  )
}
