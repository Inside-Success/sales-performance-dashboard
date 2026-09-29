import { requireRepScoringAdmin } from '@/lib/rep-scoring/access';
import { BenchmarkForm } from './test-form';
export const dynamic='force-dynamic';
export default async function Page(){await requireRepScoringAdmin();return <main className="mx-auto max-w-3xl p-8"><h1>Temporary coaching benchmark</h1><p>Isolated approved fixtures. No coaching records or deliveries are written.</p><BenchmarkForm/></main>;}
