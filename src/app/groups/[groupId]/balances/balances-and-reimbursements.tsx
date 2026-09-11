'use client'

import { BalancesList } from '@/app/groups/[groupId]/balances-list'
import { ReimbursementList } from '@/app/groups/[groupId]/reimbursement-list'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrackPage } from '@/lib/analytics/track-page'
import { useActiveUser } from '@/lib/hooks'
import { getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { HandCoins } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Fragment, useEffect } from 'react'
import { match } from 'ts-pattern'
import { useCurrentGroup } from '../current-group-context'

export default function BalancesAndReimbursements() {
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: balancesData, isLoading: balancesAreLoading } =
    trpc.groups.balances.list.useQuery({
      groupId,
    })
  const t = useTranslations('Balances')
  const storedUser = useActiveUser(groupId)
  const activeUserId = storedUser && storedUser !== 'None' ? storedUser : null

  useEffect(() => {
    // Until we use tRPC more widely and can invalidate the cache on expense
    // update, it's easier and safer to invalidate the cache on page load.
    utils.groups.balances.invalidate()
  }, [utils])

  const isLoading = balancesAreLoading || !balancesData || !group

  // IHA fork: "Settle up" opens the record-a-payment sheet. If this device's
  // user has exactly one suggested payment to make, pre-fill it.
  const mine =
    balancesData?.reimbursements.filter((r) => r.from === activeUserId) ?? []
  const settleHref =
    mine.length === 1
      ? `/groups/${groupId}/expenses/settle?from=${mine[0].from}&to=${mine[0].to}&amount=${mine[0].amount}`
      : `/groups/${groupId}/expenses/settle${
          activeUserId ? `?from=${activeUserId}` : ''
        }`

  return (
    <>
      <TrackPage path={`/groups/${groupId}/balances`} />
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button asChild className="shrink-0">
            <Link href={settleHref}>
              <HandCoins className="mr-2 h-4 w-4" />
              Settle up
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <BalancesLoading participantCount={group?.participants.length} />
          ) : (
            <BalancesList
              balances={balancesData.balances}
              participants={group?.participants}
              currency={getCurrencyFromGroup(group)}
            />
          )}
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t('Reimbursements.title')}</CardTitle>
          <CardDescription>{t('Reimbursements.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ReimbursementsLoading
              participantCount={group?.participants.length}
            />
          ) : (
            <ReimbursementList
              reimbursements={balancesData.reimbursements}
              participants={group?.participants}
              currency={getCurrencyFromGroup(group)}
              groupId={groupId}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}

const ReimbursementsLoading = ({
  participantCount = 3,
}: {
  participantCount?: number
}) => {
  return (
    <div className="flex flex-col">
      {Array(participantCount - 1)
        .fill(undefined)
        .map((_, index) => (
          <div key={index} className="flex justify-between py-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
    </div>
  )
}

const BalancesLoading = ({
  participantCount = 3,
}: {
  participantCount?: number
}) => {
  const barWidth = (index: number) =>
    match(index % 3)
      .with(0, () => 'w-1/3')
      .with(1, () => 'w-2/3')
      .otherwise(() => 'w-full')

  return (
    <div className="grid grid-cols-2 py-1 gap-y-2">
      {Array(participantCount)
        .fill(undefined)
        .map((_, index) =>
          index % 2 === 0 ? (
            <Fragment key={index}>
              <div className="flex items-center justify-end pr-2">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="self-start">
                <Skeleton className={`h-7 ${barWidth(index)} rounded-l-none`} />
              </div>
            </Fragment>
          ) : (
            <Fragment key={index}>
              <div className="flex items-center justify-end">
                <Skeleton className={`h-7 ${barWidth(index)} rounded-r-none`} />
              </div>
              <div className="flex items-center pl-2">
                <Skeleton className="h-3 w-16" />
              </div>
            </Fragment>
          ),
        )}
    </div>
  )
}
