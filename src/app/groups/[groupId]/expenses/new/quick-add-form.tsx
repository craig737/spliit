'use client'
// IHA fork: a two-field "quick add" screen in the spirit of Splitwise's add
// expense sheet. Covers the common case (one payer, split evenly, today) and
// hands off to the full upstream form for anything else. Self-contained on
// purpose so upstream changes to expense-form.tsx never conflict with it.
import { Button } from '@/components/ui/button'
import { useActiveUser } from '@/lib/hooks'
import { ExpenseFormValues } from '@/lib/schemas'
import { amountAsMinorUnits, cn, getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { CalendarDays, Check, FileText, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

function todayForInput() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function dateFromInput(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function QuickAddForm({ groupId }: { groupId: string }) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data } = trpc.groups.get.useQuery({ groupId })
  const group = data?.group
  const storedUser = useActiveUser(groupId)
  const activeUserId = storedUser && storedUser !== 'None' ? storedUser : null
  const { mutateAsync: createExpense, isPending } =
    trpc.groups.expenses.create.useMutation()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayForInput)
  const [paidBy, setPaidBy] = useState<string>('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const participants = useMemo(() => group?.participants ?? [], [group])

  // Default the payer to whoever this device identifies as, once known.
  useEffect(() => {
    if (paidBy || participants.length === 0) return
    const known = participants.find((p) => p.id === activeUserId)
    setPaidBy((known ?? participants[0]).id)
  }, [activeUserId, participants, paidBy])

  if (!group) return null

  const currency = getCurrencyFromGroup(group)
  const symbol = currency.symbol_native || currency.symbol
  const included = participants.filter((p) => !excluded.has(p.id))
  const amountNumber = Number(amount.replace(/,/g, '.'))
  const canSave =
    title.trim().length >= 2 &&
    amount !== '' &&
    !Number.isNaN(amountNumber) &&
    amountNumber > 0 &&
    !!paidBy &&
    included.length > 0 &&
    !isPending

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    if (!canSave) return
    setError(null)
    const values: ExpenseFormValues = {
      expenseDate: dateFromInput(date),
      title: title.trim(),
      category: 0,
      amount: amountAsMinorUnits(amountNumber, currency),
      originalCurrency: '',
      paidBy,
      // 100 = one even share each, matching what the full form submits.
      paidFor: included.map((p) => ({ participant: p.id, shares: 100 })),
      splitMode: 'EVENLY',
      saveDefaultSplittingOptions: false,
      isReimbursement: false,
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
      router.push(`/groups/${groupId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense.')
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
          <Link href={`/groups/${groupId}/expenses`}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <span className="iha-wordmark">Add an expense</span>
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

      {/* The two fields */}
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <label className="flex items-end gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-foreground/60">
            <FileText className="h-7 w-7" />
          </span>
          <input
            autoFocus
            enterKeyHint="next"
            placeholder="Enter a description"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-0 border-b border-foreground/50 bg-transparent pb-1 text-2xl placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex items-end gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-foreground/60 text-3xl font-semibold">
            {symbol}
          </span>
          <input
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full border-0 border-b border-foreground/50 bg-transparent pb-1 text-5xl font-light tabular-nums placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>

        {/* Paid by … and split equally */}
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 text-center text-lg">
          <span>Paid by</span>
          <span className="relative inline-flex">
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="appearance-none rounded-md border border-foreground/60 bg-transparent px-3 py-1 pr-7 text-lg focus:border-primary focus:outline-none"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === activeUserId ? 'you' : p.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">
              ▾
            </span>
          </span>
          <span>and split</span>
          <span className="rounded-md border border-foreground/60 px-3 py-1 text-lg">
            {included.length === participants.length
              ? 'equally'
              : `${included.length} ways`}
          </span>
        </p>

        {/* Who's in — tap to exclude for this expense */}
        <div className="flex flex-wrap justify-center gap-2">
          {participants.map((p) => {
            const on = !excluded.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
                  on
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground line-through',
                )}
              >
                {on && <Check className="h-3 w-3 text-primary" />}
                {p.id === activeUserId ? 'you' : p.name}
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
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
            aria-label="Expense date"
          />
        </label>
        <Link
          href={`/groups/${groupId}/expenses/create`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Full form →
        </Link>
      </div>
    </div>
  )
}
