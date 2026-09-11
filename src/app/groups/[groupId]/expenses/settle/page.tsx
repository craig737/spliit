import { SettleForm } from '@/app/groups/[groupId]/expenses/settle/settle-form'

export const metadata = { title: 'Record a payment' }

export default async function SettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ from?: string; to?: string; amount?: string }>
}) {
  const { groupId } = await params
  const { from, to, amount } = await searchParams
  const amountMinor = amount ? Number(amount) : undefined
  return (
    <SettleForm
      groupId={groupId}
      from={from}
      to={to}
      amount={
        amountMinor && Number.isFinite(amountMinor) && amountMinor > 0
          ? amountMinor
          : undefined
      }
    />
  )
}
