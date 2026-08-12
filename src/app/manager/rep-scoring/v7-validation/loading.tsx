import { Skeleton } from "@/components/ui/skeleton";

export default function V7ValidationLoading() {
  return <main className="magic-page"><div className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-16 pt-8 sm:px-8"><Skeleton className="h-44 rounded-3xl" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-3xl" /></div></main>;
}
