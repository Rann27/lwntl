import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonCard() {
  return <Card aria-label="Loading" className="py-0"><CardContent className="space-y-5 p-5"><Skeleton className="size-11 rounded-xl" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-1.5 w-full" /><Skeleton className="h-7 w-1/3" /></CardContent></Card>
}
