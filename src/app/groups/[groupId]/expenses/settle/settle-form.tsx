'use client'
// IHA fork: a "record a payment" sheet, the counterpart to the quick-add
// screen. Arrives pre-filled from a suggested reimbursement (from/to/amount)
// but every field is editable, so partial payments and ad-hoc transfers work
// too. Submits the same reimbursement expense the full form would.
import { Button } from '@/components/ui/button'
import { useActiveUser } from '@/lib/hooks'
import { ExpenseFormValues } from '@/lib/schemas'
import {
  amountAsDecimal,
  amountAsMinorUnits,
  formatCurrency,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ArrowRight, CalendarDays, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function todayForInput() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function dateFromInput(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const selectClass =
  'appearance-none rounded-md border border-foreground/60 bg-transparent px-3 py-2 pr-8 text-lg focus:border-primary focus:outline-none'

const Chevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">
    ▾
  </span>
)

export function SettleForm({
  groupId,
  from: initialFrom,
  to: initialTo,
  amount: initialAmount,
}: {
  groupId: string
  from?: string
  to?: string
  amount?: number // minor units
}) {
  const router = useRouter()
  const locale = useLocale()
  const utils = trpc.useUtils()
  const { data } = trpc.groups.get.useQuery({ groupId })
  const group = data?.group
  const activeUserId = useActiveUser(groupId)
  const { mutateAsync: createExpense, isPending } =
    trpc.groups.expenses.create.useMutation()

  const [from, setFrom] = useState(initialFrom ?? '')
  const [to, setTo] = useState(initialTo ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayForInput)
  const [error, setError] = useState<string | null>(null)

  const participants = group?.participants ?? []

  // Fill in whatever the link didn't: payer defaults to this device's user,
  // and the pre-filled amount is converted once the currency is known.
  useEffect(() => {
    if (!group) return
    const currency = getCurrencyFromGroup(group)
    if (initialAmount && amount === '') {
      setAmount(
        amountAsDecimal(initialAmount, currency, true).toFixed(
          currency.decimal_digits,
        ),
      )
    }
    if (!from && participants.length) {
      setFrom(activeUserId ?? participants[0].id)
    }
    if (!to && participants.length) {
      const other = participants.find((p) => p.id !== (from || activeUserId))
      if (other) setTo(other.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, activeUserId])

  if (!group) return null

  const currency = getCurrencyFromGroup(group)
  const name = (id: string) =>
    id === activeUserId
      ? 'you'
      : (participants.find((p) => p.id === id)?.name ?? '')
  const amountNumber = Number(amount.replace(/,/g, '.'))
  const canSave =
    !!from &&
    !!to &&
    from !== to &&
    amount !== '' &&
    !Number.isNaN(amountNumber) &&
    amountNumber > 0 &&
    !isPending

  const save = async () => {
    if (!canSave) return
    setError(null)
    const values: ExpenseFormValues = {
      expenseDate: dateFromInput(date),
      title: 'Reimbursement',
      category: 1, // Payment
      amount: amountAsMinorUnits(amountNumber, currency),
      originalCurrency: '',
      paidBy: from,
      paidFor: [{ participant: to, shares: 100 }],
      splitMode: 'EVENLY',
      saveDefaultSplittingOptions: false,
      isReimbursement: true,
      documents: [],
      recurrenceRule: 'NONE',
    }
    try {
      await createExpense({
        groupId,
        expenseFormValues: values,
        participantId: activeUserId ?? undefined,
      })
      utils.groups.expenses.invalidate()
      utils.groups.balances.invalidate()
      router.push(`/groups/${groupId}/balances`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the payment.')
    }
  }

  const isToday = date === todayForInput()
  const dateLabel = isToday
    ? 'Today'
    : dateFromInput(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col px-4">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3">
        <Button asChild variant="ghost" size="icon" aria-label="Cancel">
          <Link href={`/groups/${groupId}/balances`}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <span className="iha-wordmark">Record a payment</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary font-semibold text-base"
          disabled={!canSave}
          onClick={save}
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
        {/* Who paid whom */}
        <div className="flex items-center justify-center gap-3">
          <span className="relative inline-flex">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={selectClass}
              aria-label="Paid by"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {name(p.id)}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
          <ArrowRight className="h-6 w-6 text-primary" />
          <span className="relative inline-flex">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={selectClass}
              aria-label="Paid to"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {name(p.id)}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>
        <p className="iha-serif -mt-4 text-lg text-muted-foreground">
          {from && to && from !== to
            ? `${name(from)} paid ${name(to)}`
            : 'Choose two different people'}
        </p>

        {/* Amount */}
        <label className="flex w-full items-end gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-foreground/60 text-2xl font-semibold">
            {currency.symbol_native || currency.symbol}
          </span>
          <input
            autoFocus={!initialAmount}
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full border-0 border-b border-foreground/50 bg-transparent pb-1 text-left text-5xl font-light tabular-nums placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>
        {initialAmount ? (
          <p className="-mt-4 text-sm text-muted-foreground">
            Suggested: {formatCurrency(currency, initialAmount, locale)} — edit
            for a partial payment
          </p>
        ) : null}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t py-3">
        <label className="relative inline-flex items-center gap-2 text-primary">
          <CalendarDays className="h-5 w-5" />
          <span>{dateLabel}</span>
          <input
            type="date"
            value={date}
            max={todayForInput()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Payment date"
          />
        </label>
        <Link
          href={`/groups/${groupId}/expenses/create?reimbursement=yes${
            from ? `&from=${from}` : ''
          }${to ? `&to=${to}` : ''}${
            initialAmount ? `&amount=${initialAmount}` : ''
          }`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Full form →
        </Link>
      </div>
    </div>
  )
}
