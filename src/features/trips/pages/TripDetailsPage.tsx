import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Backpack,
  CalendarDays,
  FileStack,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  Printer,
  Share2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ItineraryTimeline } from '@/features/trips/components/ItineraryTimeline'
import { ActivityFormDialog, type ActivityFormValues } from '@/features/trips/components/ActivityFormDialog'
import { TripMap } from '@/features/trips/components/TripMap'
import {
  addItineraryItem,
  deleteItineraryItem,
  fetchItineraryItems,
  fetchTrip,
  tripKeys,
  updateItineraryItem,
} from '@/features/trips/tripService'
import { PackingListView } from '@/features/packing/PackingListView'
import { packingKeys, fetchPackingItems } from '@/features/packing/packingService'
import { TripExpensesView } from '@/features/expenses/TripExpensesView'
import { expenseKeys, fetchExpenses, totalSpent } from '@/features/expenses/expenseService'
import { TripVaultView } from '@/features/vault/TripVaultView'
import { documentKeys, fetchDocuments } from '@/features/vault/documentService'
import { WeatherWidget } from '@/features/weather/WeatherWidget'
import { getTripWeather, weatherLabel } from '@/features/weather/weatherService'
import { TripShareModal } from '@/features/collaboration/TripShareModal'
import { collaborationKeys, getTripMembers } from '@/features/collaboration/collaborationService'
import { TripExportModal } from '@/features/export/TripExportModal'
import { TripPrintSheet } from '@/features/export/TripPrintSheet'
import { toast } from '@/components/ui/toast'
import { useTripStore, type TripTab } from '@/stores/useTripStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn, formatDate, errorMessage, roundMoney } from '@/lib/utils'
import type { ItineraryItem } from '@/types/database'

/**
 * Trip workspace control dashboard:
 *  - prominent top tab bar (Itinerary & Map / Packing / Expenses / Vault) with
 *    live badges fed by the same query keys the tab bodies use,
 *  - weather docked in the header across all tabs,
 *  - Phase-2 split view preserved inside the itinerary tab.
 */
export function TripDetailsPage() {
  const { id: tripId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const activeDay = useTripStore((s) => s.activeDay)
  const setActiveDay = useTripStore((s) => s.setActiveDay)
  const selectedActivityId = useTripStore((s) => s.selectedActivityId)
  const hoveredActivityId = useTripStore((s) => s.hoveredActivityId)
  const selectActivity = useTripStore((s) => s.selectActivity)
  const hoverActivity = useTripStore((s) => s.hoverActivity)
  const tripTab = useTripStore((s) => s.tripTab)
  const setTripTab = useTripStore((s) => s.setTripTab)
  const resetTripUI = useTripStore((s) => s.resetTripUI)

  const user = useAuthStore((s) => s.user)

  const [formOpen, setFormOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null)
  const [pendingDay, setPendingDay] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)

  // Fresh UI state on every workspace entry.
  useEffect(() => resetTripUI(), [resetTripUI])

  /* ------------------------------- queries -------------------------------- */

  const tripQuery = useQuery({
    queryKey: tripKeys.trip(tripId ?? ''),
    queryFn: () => fetchTrip(tripId ?? ''),
    enabled: Boolean(tripId),
  })

  const itemsQuery = useQuery({
    queryKey: tripKeys.itinerary(tripId ?? ''),
    queryFn: () => fetchItineraryItems(tripId ?? ''),
    enabled: Boolean(tripId),
  })

  // Badge queries — same keys as the tab bodies, so React Query dedupes them.
  const packingQuery = useQuery({
    queryKey: packingKeys.list(tripId ?? ''),
    queryFn: () => fetchPackingItems(tripId ?? ''),
    enabled: Boolean(tripId),
  })
  const expensesQuery = useQuery({
    queryKey: expenseKeys.list(tripId ?? ''),
    queryFn: () => fetchExpenses(tripId ?? ''),
    enabled: Boolean(tripId),
  })
  const documentsQuery = useQuery({
    queryKey: documentKeys.list(tripId ?? ''),
    queryFn: () => fetchDocuments(tripId ?? ''),
    enabled: Boolean(tripId),
  })

  // RBAC: owner always edits; members follow their trip_members role.
  const membersQuery = useQuery({
    queryKey: collaborationKeys.members(tripId ?? ''),
    queryFn: () => getTripMembers(tripId ?? ''),
    enabled: Boolean(tripId),
  })

  const trip = tripQuery.data ?? null

  // Derive permissions: owner > editor > viewer > public read-only.
  const isOwner = Boolean(trip && user && trip.owner_id === user.id)
  const myRole = membersQuery.data?.find((m) => m.userId === user?.id)?.role
  const isEditor = isOwner || myRole === 'editor'
  const isViewer = myRole === 'viewer' || (!isOwner && myRole === undefined)

  const durationDays = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return 3
    const start = new Date(`${trip.start_date}T00:00:00`)
    const end = new Date(`${trip.end_date}T00:00:00`)
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    return Number.isFinite(days) && days >= 1 ? Math.min(days, 14) : 3
  }, [trip?.start_date, trip?.end_date])

  const hasCoords = trip?.lat != null && trip?.lng != null
  const fallbackCenter: [number, number] | undefined =
    trip?.lat != null && trip?.lng != null ? [trip.lat, trip.lng] : undefined

  // Shared with WeatherWidget via the same query key (1 h stale time).
  const weatherQuery = useQuery({
    queryKey: ['weather', trip?.lat, trip?.lng, trip?.start_date, trip?.end_date],
    queryFn: () =>
      getTripWeather(
        trip?.lat as number,
        trip?.lng as number,
        trip?.start_date as string,
        trip?.end_date as string,
      ),
    enabled: Boolean(hasCoords && trip?.start_date && trip?.end_date),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  const weatherSummary = useMemo(() => {
    const day = weatherQuery.data?.days[0]
    if (!day) return 'unknown'
    return `${day.maxC}°C / ${day.minC}°C, ${weatherLabel(day.code)}`
  }, [weatherQuery.data])

  // Travel style isn't a persisted column yet — infer a sensible prompt value.
  const style = useMemo(() => {
    const tripBudget = trip?.budget ?? trip?.budget_total ?? 0
    if (!tripBudget || durationDays === 0) return 'Balanced'
    const perDay = tripBudget / durationDays
    if (perDay > 250) return 'Luxury'
    if (perDay < 80) return 'Budget'
    return 'Balanced'
  }, [trip?.budget, trip?.budget_total, durationDays])

  /* ------------------------------ mutations ------------------------------- */

  const invalidate = useCallback(() => {
    if (tripId) void queryClient.invalidateQueries({ queryKey: tripKeys.itinerary(tripId) })
  }, [queryClient, tripId])

  const saveMutation = useMutation({
    mutationFn: async (input: { values: ActivityFormValues; editingId: string | null }) => {
      const { values, editingId } = input
      // Exactly the audited public.itinerary_items columns — no legacy fields.
      const payload = {
        day_number: values.day_number,
        time_slot: values.slot,
        title: values.title,
        description: values.description,
        location_name: values.location_name,
        lat: values.lat,
        lng: values.lng,
        estimated_cost: values.cost_estimate ?? 0,
      }
      if (editingId) {
        await updateItineraryItem(editingId, payload)
        return input
      }
      if (!tripId) throw new Error('Missing trip id')
      await addItineraryItem({
        ...payload,
        trip_id: tripId,
        order_index: Date.now() % 100000,
      })
      return input
    },
    onSuccess: (data) => {
      setFormOpen(false)
      setEditingItem(null)
      setActionError(null)
      // Distinguish fresh stops from edits in the toast copy.
      if (data.editingId) toast.success('Activity updated')
      else toast.success('Activity added')
      invalidate()
    },
    onError: (error) => setActionError(errorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItineraryItem(id),
    onSuccess: () => {
      if (selectedActivityId) selectActivity(null)
      toast.success('Activity deleted')
      invalidate()
    },
    onError: (error) => setActionError(errorMessage(error)),
  })

  /* -------------------------------- derived -------------------------------- */

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const maxDay = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.day_number), 1),
    [items],
  )

  const packedCount = (packingQuery.data ?? []).filter((i) => i.is_packed).length
  const packingTotal = (packingQuery.data ?? []).length
  const spent = totalSpent(expensesQuery.data ?? [])
  const docCount = (documentsQuery.data ?? []).length
  const badgeMoney = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: trip?.currency ?? 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(roundMoney(value))

  const payerName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'Me'

  /* -------------------------------- loading -------------------------------- */

  if (tripQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  if (tripQuery.isError || !trip) {
    return (
      <div className="container flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-destructive">
          {tripQuery.isError ? `Could not load trip: ${tripQuery.error.message}` : 'Trip not found.'}
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  /* --------------------------------- layout -------------------------------- */

  const tabs: Array<{
    id: TripTab
    label: string
    icon: React.ReactNode
    badge?: string
  }> = [
    { id: 'itinerary', label: 'Itinerary & Map', icon: <List className="h-4 w-4" /> },
    {
      id: 'packing',
      label: 'Packing List',
      icon: <Backpack className="h-4 w-4" />,
      badge: packingTotal > 0 ? `${packedCount}/${packingTotal}` : undefined,
    },
    {
      id: 'expenses',
      label: 'Expenses & Budget',
      icon: <Wallet className="h-4 w-4" />,
      badge: expensesQuery.data
        ? `${badgeMoney(spent)} / ${badgeMoney(trip.budget ?? trip.budget_total ?? 0)}`
        : undefined,
    },
    {
      id: 'vault',
      label: 'Document Vault',
      icon: <FileStack className="h-4 w-4" />,
      badge: docCount > 0 ? `${docCount} file${docCount === 1 ? '' : 's'}` : undefined,
    },
  ]

  const section = tripTab === 'map' ? 'itinerary' : tripTab
  const showSplitView = section === 'itinerary'
  const showList = tripTab !== 'map'
  const showMap = tripTab === 'map'

  const timeline = (
    <div className="space-y-4 p-4 md:p-6">
      {actionError && (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}
      <ItineraryTimeline
        items={items}
        activeDay={activeDay}
        onDayChange={setActiveDay}
        selectedItemId={selectedActivityId}
        hoveredItemId={hoveredActivityId}
        canEdit={isEditor}
        onSelect={selectActivity}
        onHover={hoverActivity}
        onEditItem={(item) => {
          setEditingItem(item)
          setPendingDay(item.day_number)
          setFormOpen(true)
        }}
        onDeleteItem={(item) => {
          if (window.confirm(`Delete "${item.title}"? This can't be undone.`)) {
            deleteMutation.mutate(item.id)
          }
        }}
        onAddActivity={(day) => {
          setEditingItem(null)
          setPendingDay(day)
          setFormOpen(true)
        }}
      />
    </div>
  )

  const mapPane = (
    <div className="h-[50vh] w-full md:h-full">
      <TripMap items={items} fallbackCenter={fallbackCenter} className="h-full w-full" />
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header: title + meta + weather dock */}
      <header className="shrink-0 space-y-3 border-b bg-background px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold leading-tight md:text-xl">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground md:text-sm">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {trip.destination}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
              </span>
              {trip.description && (
                <span
                  className="hidden max-w-md truncate italic md:inline"
                  title={trip.description}
                >
                  {trip.description}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isViewer && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Read-only
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
              <Printer className="h-4 w-4" />
              Export Trip
            </Button>
            {showSplitView && isEditor && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null)
                  setPendingDay(maxDay)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Add Stop
              </Button>
            )}
          </div>
        </div>

        {hasCoords && trip.start_date && trip.end_date && (
          <WeatherWidget
            lat={trip.lat as number}
            lng={trip.lng as number}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        )}
      </header>

      {/* Top tab bar */}
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b bg-background px-2 pt-2 md:px-4"
        aria-label="Trip workspace sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={section === tab.id ? 'page' : undefined}
            onClick={() => setTripTab(tab.id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              section === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Active section */}
      {showSplitView ? (
        <div className="flex min-h-0 flex-1">
          <section
            className={cn(
              'min-h-0 flex-1 overflow-y-auto md:w-[52%] md:flex-none md:border-r',
              showList ? 'block' : 'hidden md:block',
            )}
            aria-label="Itinerary timeline"
          >
            {timeline}
          </section>
          <section
            className={cn(
              'min-h-0 flex-1 md:sticky md:top-0 md:w-[48%]',
              showMap ? 'block' : 'hidden md:block',
            )}
            aria-label="Trip map"
          >
            {mapPane}
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel" aria-label={section}>
          {section === 'packing' && tripId && user && (
            <PackingListView
              tripId={tripId}
              destination={trip.destination}
              durationDays={durationDays}
              style={style}
              weatherSummary={weatherSummary}
              canEdit={isEditor}
            />
          )}
          {section === 'expenses' && tripId && (
            <TripExpensesView
              tripId={tripId}
              budgetTotal={trip.budget ?? trip.budget_total ?? null}
              currency={trip.currency}
              defaultPayer={payerName}
              canEdit={isEditor}
            />
          )}
          {section === 'vault' && tripId && user && (
            <TripVaultView tripId={tripId} userId={user.id} canEdit={isEditor} />
          )}
        </div>
      )}

      {/* Mobile bottom toggle (itinerary <-> map) */}
      {showSplitView && (
        <nav className="flex shrink-0 border-t bg-background md:hidden" aria-label="Itinerary view">
          <button
            type="button"
            aria-pressed={tripTab !== 'map'}
            onClick={() => setTripTab('itinerary')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium',
              tripTab === 'map' ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            <List className="h-4 w-4" />
            Itinerary
          </button>
          <button
            type="button"
            aria-pressed={tripTab === 'map'}
            onClick={() => setTripTab('map')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium',
              tripTab === 'map' ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
        </nav>
      )}

      <ActivityFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null)
            setActionError(null)
          }
          setFormOpen(open)
        }}
        item={editingItem}
        defaultDay={pendingDay}
        maxHighestDay={maxDay}
        saving={saveMutation.isPending}
        error={actionError}
        onSubmit={(values) => saveMutation.mutate({ values, editingId: editingItem?.id ?? null })}
      />

      <TripShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        trip={trip}
        currentUserId={user?.id ?? ''}
        isOwner={isOwner}
        onVisibilityChanged={() => {
          void queryClient.invalidateQueries({ queryKey: tripKeys.trip(trip.id) })
        }}
      />

      <TripExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        trip={trip}
        items={items}
        expenses={expensesQuery.data ?? []}
        packing={packingQuery.data ?? []}
      />

      {/* Print-only export sheet (revealed by src/styles/print.css on print). */}
      <TripPrintSheet
        trip={trip}
        items={items}
        expenses={expensesQuery.data ?? []}
        packing={packingQuery.data ?? []}
      />
    </div>
  )
}
