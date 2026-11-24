"use server";
import { neon } from "@neondatabase/serverless";
import { redirect } from "next/navigation";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

export async function saveMark(form: FormData) {
  const session = await requireRepScoringAdmin();
  const id = String(form.get("id"));
  const choice =
    form.get("feedback") === "none" ? "none" : String(form.get("cue"));
  if (choice !== "none" && !/^\d{1,8}$/.test(choice))
    throw Error("Invalid selection");
  const feedback = String(form.get("feedback") || "corrected");
  if (
    !["right", "early", "late", "none", "missed", "corrected"].includes(
      feedback,
    )
  )
    throw Error("Invalid feedback");
  if (
    (feedback === "none") !== (choice === "none") &&
    feedback !== "corrected" &&
    feedback !== "missed"
  )
    throw Error("Feedback does not match selection");
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`WITH candidate AS (
    SELECT jsonb_array_elements(cast_cues) AS cue FROM call2_duration_pilot WHERE occurrence = ${id}
  ), selected AS (SELECT cue FROM candidate WHERE cue->>'id' = ${choice})
  UPDATE call2_duration_pilot SET review = jsonb_build_object('signal',(SELECT cue FROM selected),
    'feedback',${feedback}::text, 'reviewer',${session?.user?.email}::text), reviewed_at = now()
  WHERE occurrence = ${id} AND digest = ${String(form.get("digest"))}
    AND coalesce(reviewed_at::text,'') = ${String(form.get("revision"))}
    AND (${choice} = 'none' OR EXISTS (SELECT 1 FROM selected)) RETURNING occurrence`;
  if (!rows.length) redirect("/manager/call2-duration?changed=1");
  const query = new URLSearchParams({ saved: id });
  const rep = form.get("rep");
  if (rep) query.set("rep", String(rep));
  redirect(
    "/manager/call2-duration?" + query + "#call-" + encodeURIComponent(id),
  );
}
