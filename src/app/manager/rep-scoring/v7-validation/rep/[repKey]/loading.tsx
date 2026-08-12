import { Skeleton } from "@/components/ui/skeleton";

export default function V7RepLoading() { return <main className="magic-page"><div className="mx-auto grid max-w-6xl gap-5 px-5 py-8 sm:px-8"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-36 rounded-2xl" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></div></main>; }
