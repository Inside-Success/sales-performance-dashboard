"use client";

import Link from "next/link";
import { useEffect } from "react";
import type React from "react";
import type { UsageEventData, UsageEventName } from "@/lib/usage-events";

const SESSION_STORAGE_KEY = "magic_mike_usage_session_id";

export function trackUsageEvent(eventName: UsageEventName, data: UsageEventData = {}) {
  if (typeof window === "undefined") return;

  const body = {
    ...data,
    event_name: eventName,
    anonymous_session_id: getAnonymousSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
  };

  void fetch("/api/usage-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Usage analytics should never interrupt the dashboard experience.
  });
}

export function TrackUsageEvent({
  eventName,
  eventData,
}: {
  eventName: UsageEventName;
  eventData?: UsageEventData;
}) {
  useEffect(() => {
    trackUsageEvent(eventName, eventData);
  }, [eventName, eventData]);

  return null;
}

export function TrackedLink({
  href,
  eventName,
  eventData,
  children,
  onClick,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  eventName: UsageEventName;
  eventData?: UsageEventData;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        trackUsageEvent(eventName, eventData);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

export function TrackedExternalLink({
  href,
  eventName,
  eventData,
  children,
  onClick,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  eventName: UsageEventName;
  eventData?: UsageEventData;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        trackUsageEvent(eventName, eventData);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

function getAnonymousSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}
