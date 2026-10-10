import { useState } from 'react'
import { FileDown, Loader2, Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { categoryTotals, totalSpent } from '@/features/expenses/expenseService'
import { toast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Expense, ItineraryItem, PackingItem, Trip } from '@/types/database'

interface TripExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  items: ItineraryItem[]
  expenses: Expense[]
  packing: PackingItem[]
}

const SLOT_ORDER = ['morning', 'afternoon', 'evening'] as const

function buildMarkdown({
  trip,
  items,
  expenses,
  packing,
}: Pick<TripExportModalProps, 'trip' | 'items' | 'expenses' | 'packing'>): string {
  const lines: string[] = []
  lines.push(`# ${trip.title}`)
  lines.push('')
  lines.push(`- **Destination:** ${trip.destination}`)
  lines.push(`- **Dates:** ${formatDate(trip.start_date)} → ${formatDate(trip.end_date)}`)
  lines.push(
    `- **Total budget:** ${formatCurrency(trip.budget ?? trip.budget_total ?? 0, trip.currency)}` +
      ` · **Spent:** ${formatCurrency(totalSpent(expenses), trip.currency)}`,
  )
  if (trip.description) {
    lines.push('')
    lines.push(trip.description)
  }

  const dayNumbers = [...new Set(items.map((i) => i.day_number))].sort((a, b) => a - b)
  lines.push('', '## Day-by-Day Schedule', '')
  if (dayNumbers.length === 0) lines.push('_No activities planned yet._')
  for (const day of dayNumbers) {
    lines.push(`### Day ${day}`)
    for (const slot of SLOT_ORDER) {
      const slotItems = items
        .filter((i) => i.day_number === day && i.time_slot === slot)
        .sort((a, b) => a.order_index - b.order_index)
      if (slotItems.length === 0) continue
      lines.push(`**${slot.charAt(0).toUpperCase() + slot.slice(1)}**`)
      for (const item of slotItems) {
        const location = item.location_name ? ` — ${item.location_name}` : ''
        const cost = item.estimated_cost
          ? ` (${formatCurrency(item.estimated_cost, trip.currency)})`
          : ''
        lines.push(`- **${item.title}**${location}${cost}`)
        if (item.description) lines.push(`  - ${item.description}`)
      }
    }
    lines.push('')
  }

  const totals = categoryTotals(expenses)
  lines.push('## Expense Summary', '')
  lines.push('| Category | Amount | Share |', '| --- | ---: | ---: |')
  const spent = totalSpent(expenses)
  for (const [category, value] of Object.entries(totals)) {
    if (value <= 0) continue
    const share = spent > 0 ? `${Math.round((value / spent) * 100)}%` : '0%'
    lines.push(`| ${category} | ${formatCurrency(value, trip.currency)} | ${share} |`)
  }

  lines.push('', '## Packed Essentials', '')
  if (packing.length === 0) lines.push('_No packing list yet._')
  for (const item of packing) {
    lines.push(`- [${item.is_packed ? 'x' : ' '}] ${item.item_name} _(${item.category})_`)
  }
  lines.push('')

  return lines.join('\n')
}

/**
 * Accessible export dialog:
 *  - Print / Save as PDF → window.print() with src/styles/print.css layout
 *    (map and interactive chrome are stripped; sheet is TripPrintSheet),
 *  - Download Markdown summary.
 */
export function TripExportModal({
  open,
  onOpenChange,
  trip,
  items,
  expenses,
  packing,
}: TripExportModalProps) {
  const [exporting, setExporting] = useState(false)

  const handlePrint = () => {
    // Close first so the dialog overlay never lands on the printed sheet.
    onOpenChange(false)
    // Let the dialog unmount before the print snapshot is taken.
    window.setTimeout(() => window.print(), 150)
  }

  const handleDownloadMarkdown = () => {
    setExporting(true)
    try {
      const markdown = buildMarkdown({ trip, items, expenses, packing })
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeName =
        trip.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || 'trip'
      anchor.href = url
      anchor.download = `${safeName}.md`
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Markdown summary downloaded')
    } catch {
      toast.error('Could not generate the Markdown file.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-print sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export trip</DialogTitle>
          <DialogDescription>
            The printed version includes the trip header, day-by-day schedule,
            expense summary and packed essentials — buttons and the map are
            excluded automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button className="w-full justify-start" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={handleDownloadMarkdown}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download Markdown summary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
