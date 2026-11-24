"use client";
import React, { useState } from "react";
export function Player({
  occurrence,
  start,
  marked,
}: {
  occurrence: string;
  start: number;
  marked: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        className="inline-flex min-h-11 items-center font-semibold text-red-700"
        onClick={() => setOpen(true)}
      >
        {marked ? "Listen to exchange" : "Listen to call"}
      </button>
    );
  return (
    <audio
      controls
      autoPlay
      preload="metadata"
      className="my-2 w-full max-w-lg"
      aria-label="Call recording"
      src={
        "/manager/call2-duration/audio?" +
        new URLSearchParams({ call: occurrence }) +
        "#t=" +
        start
      }
    />
  );
}
