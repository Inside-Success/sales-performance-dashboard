import { Skeleton } from "@/components/ui/skeleton";

export default function V7CallLoading() { return <main className="magic-page"><div className="mx-auto grid max-w-6xl gap-5 px-5 py-8 sm:px-8"><Skeleton className="h-44 rounded-3xl" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div><Skeleton className="h-72 rounded-2xl" /></div></main>; }
