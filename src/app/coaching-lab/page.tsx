import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { CoachingReportContent } from "@/components/dashboard/coaching-report-content";
import { canReadCoachingLab } from "@/lib/coaching-lab-access";

export const dynamic = "force-dynamic";

export default async function CoachingLabPage() {
  const session = await auth();
  if (!canReadCoachingLab(process.env.VERCEL_ENV, session?.user?.email)) notFound();
  const saved = process.env.COACHING_LAB_REVIEWED_PAYLOAD;
  if (!saved) notFound();
  const payload = JSON.parse(saved);
  return <main className="magic-page"><div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
    <header><p className="text-sm font-medium text-amber-700">Isolated review · saved test output</p>
      <h1 className="mt-2 text-3xl font-bold">Call coaching</h1>
      <p className="mt-3 text-sm text-slate-600">Report presentation check. Delivery, chat, analytics and live transcript lookup are not exercised here.</p>
    </header>
    <CoachingReportContent report={{source_payload:payload}} reportType="official" reportId="isolated-preview" />
  </div></main>;
}
