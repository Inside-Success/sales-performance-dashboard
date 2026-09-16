"use client";

import React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export function ReviewForm({
  id,
  version,
  note,
  reviewed,
  through,
}: {
  id: string;
  version: number;
  note: string;
  reviewed: boolean;
  through: string;
}) {
  const [text, setText] = useState(note),
    [done, setDone] = useState(reviewed),
    [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const res = await fetch(
              `/api/ask-sales-faq/admin/conversations/${encodeURIComponent(id)}/review`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  note: text,
                  reviewed: done,
                  version,
                  through,
                }),
              },
            );
            const body = await res.json();
            setMessage(
              res.ok
                ? "Review saved. This does not change the chatbot or resolve the issue."
                : body.error,
            );
            if (res.ok) router.refresh();
          } catch {
            setMessage(
              "Could not save. Your note is still here; please retry.",
            );
          }
        });
      }}
    >
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
        />{" "}
        Mark reviewed
      </label>
      <p className="text-sm text-slate-500">
        Reviewed means someone looked at this conversation—not that its answer
        is correct or the issue is fixed. New messages or feedback put it back
        in the review queue.
      </p>
      <label className="block text-sm font-semibold" htmlFor="review-note">
        Internal note (optional)
      </label>
      <textarea
        id="review-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        className="w-full rounded-xl border border-slate-300 p-3"
        placeholder="What did you find? What still needs follow-up?"
      />
      <button
        disabled={pending}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save review"}
      </button>
      <p role="status" className="text-sm text-slate-600">
        {message}
      </p>
    </form>
  );
}
