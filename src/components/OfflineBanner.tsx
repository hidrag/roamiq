import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Non-intrusive fixed banner shown only while offline. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-700 shadow-lg backdrop-blur dark:text-amber-400"
    >
      <WifiOff className="h-4 w-4" />
      You are offline. Viewing cached trip itinerary.
    </div>
  )
}
