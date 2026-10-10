import type { PackingItem, Expense, ItineraryItem, Trip } from '@/types/database'
import { categoryTotals, totalSpent } from '@/features/expenses/expenseService'
import { formatCurrency, formatDate, roundMoney } from '@/lib/utils'

/**
 * Print-only export sheet. Hidden on screen (see src/styles/print.css) and
 * revealed exclusively during @media print — the interactive shell, Leaflet
 * map and all buttons are stripped at print time by the same stylesheet.
 */
interface TripPrintSheetProps {
  trip: Trip
  items: ItineraryItem[]
  expenses: Expense[]
  packing: PackingItem[]
}

const SLOT_ORDER = ['morning', 'afternoon', 'evening'] as const

export function TripPrintSheet({ trip, items, expenses, packing }: TripPrintSheetProps) {
  const tripBudget = trip.budget ?? trip.budget_total ?? 0
  const dayNumbers = [...new Set(items.map((i) => i.day_number))].sort((a, b) => a - b)
  const totals = categoryTotals(expenses)
  const spent = totalSpent(expenses)
  const packedItems = packing.filter((p) => p.is_packed)
  const unpackedItems = packing.filter((p) => !p.is_packed)

  return (
    <article className="print-only" aria-label="Printable trip export">
      <header className="print-section">
        <h1>{trip.title}</h1>
        <p>
          <strong>Destination:</strong> {trip.destination}
          {'  ·  '}
          <strong>Dates:</strong> {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
          {'  ·  '}
          <strong>Budget:</strong> {formatCurrency(tripBudget, trip.currency)}
        </p>
        {trip.description && <p>{trip.description}</p>}
      </header>

      {/* Day-by-day schedule */}
      <section className="print-section">
        <h2>Day-by-Day Schedule</h2>
        {dayNumbers.length === 0 && <p>No activities planned yet.</p>}
        {dayNumbers.map((day) => (
          <div key={day} className="print-day">
            <h3>Day {day}</h3>
            {SLOT_ORDER.map((slot) => {
              const slotItems = items
                .filter((i) => i.day_number === day && i.time_slot === slot)
                .sort((a, b) => a.order_index - b.order_index)
              if (slotItems.length === 0) return null
              return (
                <div key={slot}>
                  <p>
                    <strong>{slot.charAt(0).toUpperCase() + slot.slice(1)}</strong>
                  </p>
                  <ul>
                    {slotItems.map((item) => (
                      <li key={item.id} className="print-activity">
                        <strong>{item.title}</strong>
                        {item.location_name ? ` — ${item.location_name}` : ''}
                        {item.estimated_cost ? ` (${formatCurrency(item.estimated_cost, trip.currency)})` : ''}
                        {item.description ? ` · ${item.description}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </section>

      {/* Expense summary by category */}
      <section className="print-section">
        <h2>Expense Summary</h2>
        {expenses.length === 0 ? (
          <p>No expenses recorded yet.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(totals)
                  .filter(([, value]) => value > 0)
                  .map(([category, value]) => (
                    <tr key={category}>
                      <td>{category}</td>
                      <td>{formatCurrency(value, trip.currency)}</td>
                      <td>{spent > 0 ? `${Math.round((value / spent) * 100)}%` : '0%'}</td>
                    </tr>
                  ))}
                <tr>
                  <td>
                    <strong>Total spent</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(spent, trip.currency)}</strong>
                  </td>
                  <td>
                    {tripBudget
                      ? `of ${formatCurrency(tripBudget, trip.currency)}`
                      : ''}
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Remaining:{' '}
              {formatCurrency(
                roundMoney(tripBudget - spent),
                trip.currency,
              )}
            </p>
          </>
        )}
      </section>

      {/* Packing essentials */}
      <section className="print-section">
        <h2>Packed Essentials</h2>
        {packing.length === 0 ? (
          <p>No packing list yet.</p>
        ) : (
          <ul>
            {packedItems.map((item) => (
              <li key={item.id}>
                [x] {item.item_name} <em>({item.category})</em>
              </li>
            ))}
            {unpackedItems.map((item) => (
              <li key={item.id}>
                [ ] {item.item_name} <em>({item.category})</em>
              </li>
            ))}
          </ul>
        )}
        <p>
          {packedItems.length} of {packing.length} items packed.
        </p>
      </section>
    </article>
  )
}
