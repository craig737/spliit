import { QuickAddForm } from '@/app/groups/[groupId]/expenses/new/quick-add-form'

export const metadata = { title: 'Add an expense' }

export default async function QuickAddPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  return <QuickAddForm groupId={groupId} />
}
