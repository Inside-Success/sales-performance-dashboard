// Reads the transcript of a Zoom cloud recording from its share link, the way the Zoom recording
// page itself does: the page names a "feature config" endpoint, which names the transcript endpoint.
// Only https zoom.us hosts are ever contacted, and only same-origin /nws/recording/ paths are followed.
// Returns null when Zoom has no finished transcript for the recording (the rep is then asked to paste it).

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_TRANSCRIPT_BYTES = 600000;

function zoomUrl(value: string, base?: string) {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !/(^|\.)zoom\.us$/i.test(url.hostname) || url.username || url.password || url.port) {
    throw new Error("Untrusted Zoom URL");
  }
  return url;
}

function recordingApiUrl(path: unknown, origin: string) {
  if (typeof path !== "string" || !path) return null;
  const url = zoomUrl(path, origin);
  return url.origin === origin && url.pathname.startsWith("/nws/recording/") ? url : null;
}

async function fetchZoom(url: URL, accept: string, referer: string, signal: AbortSignal) {
  let current = url;
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { accept, referer, "user-agent": BROWSER },
      cache: "no-store",
      signal,
    });
    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await response.body?.cancel();
      current = zoomUrl(location, current.href);
      continue;
    }
    if (!response.ok) throw new Error(`Zoom request failed with HTTP ${response.status}`);
    return response.text();
  }
  throw new Error("Too many Zoom redirects");
}

function readPath(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Zoom's transcript items, joined into "Speaker: text" paragraphs (one per speaker turn). */
export function transcriptFromItems(items: unknown) {
  if (!Array.isArray(items)) return "";
  const turns: Array<{ speaker: string; text: string[] }> = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.replace(/\s+/g, " ").trim() : "";
    if (!text) continue;
    const speaker = typeof record.userName === "string" ? record.userName.replace(/\s+/g, " ").trim() : "";
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) last.text.push(text);
    else turns.push({ speaker, text: [text] });
  }
  return turns.map((turn) => (turn.speaker ? `${turn.speaker}: ${turn.text.join(" ")}` : turn.text.join(" "))).join("\n\n");
}

/** Plain text from a WEBVTT caption file: cue numbers and timings removed, speaker labels kept. */
export function transcriptFromVtt(raw: string) {
  if (!/^﻿?WEBVTT/.test(raw)) return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^﻿?WEBVTT/.test(line) && !/^\d+$/.test(line) && !/-->/.test(line) && !/^(NOTE|Kind:|Language:)/.test(line))
    .map((line) => line.replace(/<[^>]+>/g, ""))
    .join("\n");
}

export async function resolveZoomCallTranscript(zoomLink: string): Promise<string | null> {
  const link = zoomUrl(zoomLink);
  if (!/^\/(?:rec\/(?:share|play)|recording\/play)\/[^/]+\/?$/.test(link.pathname)) return null;
  const { origin } = link;
  const signal = AbortSignal.timeout(25000);

  const page = (await fetchZoom(link, "text/html,application/xhtml+xml", origin, signal))
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
  const configPath = page.match(/window\.__zm_unified_player__\s*=\s*\{[\s\S]*?["']?featureConfigApi["']?\s*:\s*["']([^"']+)["']/)?.[1];
  const configUrl = recordingApiUrl(configPath, origin);
  if (!configUrl) return null;

  const config: unknown = JSON.parse(await fetchZoom(configUrl, "application/json", origin, signal));
  if (readPath(config, ["status"]) !== true) return null;
  const transcriptStatus = readPath(config, ["result", "transcript", "status"]);
  if (typeof transcriptStatus === "string" && transcriptStatus !== "success") return null;

  const accept = (text: string) => (text.length >= 120 && Buffer.byteLength(text) <= MAX_TRANSCRIPT_BYTES ? text : null);

  const itemsUrl = recordingApiUrl(readPath(config, ["result", "transcript", "getApi"]), origin);
  if (itemsUrl) {
    try {
      const items: unknown = JSON.parse(await fetchZoom(itemsUrl, "application/json", origin, signal));
      const text = accept(transcriptFromItems(readPath(items, ["result", "dataList"])));
      if (text) return text;
    } catch {
      // Fall through to the caption file.
    }
  }

  const captionsUrl = recordingApiUrl(readPath(config, ["result", "captions", "transcriptCaptionApi"]), origin);
  if (captionsUrl) {
    const text = accept(transcriptFromVtt(await fetchZoom(captionsUrl, "text/vtt,text/plain", origin, signal)));
    if (text) return text;
  }
  return null;
}
