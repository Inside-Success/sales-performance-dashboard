type RecordingData = {
  meetingId?: string;
  fileId?: string;
  isFromShare?: boolean;
};

export type ZoomTranscriptResult = {
  transcriptText: string;
  transcriptUrl: string | null;
  fileId: string | null;
};

type RecordingIdentity = { owner: string; title: string; startedAt: string };
type ArchiveLookup = (recording: RecordingIdentity) => Promise<string | null>;

const HTML = "text/html,application/xhtml+xml";
const CAPTIONS = "text/vtt,text/plain";
const ZOOM_PLAYER_PATH = /^\/nws\/recording\/2\.0\/(?:share|play)\/[A-Za-z0-9._%=-]+$/;

function zoomUrl(value: string, base?: string): URL {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !/(^|\.)zoom\.us$/i.test(url.hostname) ||
      url.username || url.password || url.port) {
    throw new Error("Untrusted Zoom URL");
  }
  return url;
}

export async function resolveZoomTranscript(
  zoomLink: string,
  lookupArchive?: ArchiveLookup,
): Promise<ZoomTranscriptResult | null> {
  const link = zoomUrl(zoomLink);
  if (!/^\/(?:rec\/(?:share|play)|recording\/play)\/[^/]+\/?$/.test(link.pathname)) return null;
  const { origin, host } = link;
  const signal = AbortSignal.timeout(18000);
  const firstPage = normalizeZoomHtml(await fetchText(link.href, link.href, HTML, signal));

  let transcriptUrl = pickTranscriptUrl(firstPage, origin);
  let recordingData = parseRecordingData(firstPage);
  let identity: RecordingIdentity | null = null;

  const playInfoPath = firstPage.match(/window\.__zm_unified_player__\s*=\s*\{[\s\S]*?["']?playInfoApi["']?\s*:\s*["']([^"']+)["']/)?.[1];
  if (playInfoPath) {
    const playInfoUrl = zoomUrl(playInfoPath, origin);
    if (playInfoUrl.origin !== origin || !ZOOM_PLAYER_PATH.test(playInfoUrl.pathname)) {
      throw new Error("Untrusted Zoom player metadata URL");
    }
    const info = await fetchJson(playInfoUrl.href, link.href, signal);
    if (info && typeof info === "object" && "status" in info && info.status === true) {
      const field = (name: string) => readNestedString(info, ["result", "mediaInfo", name]);
      const time = readNested(info, ["result", "mediaInfo", "createdTime"]);
      if (field("mediaTopic") && field("ownerName") && field("mediaId") &&
          typeof time === "number" && Number.isFinite(new Date(time).getTime())) {
        identity = { owner: field("ownerName"), title: field("mediaTopic"), startedAt: new Date(time).toISOString() };
      }
      recordingData.fileId = field("mediaId") || recordingData.fileId;
      transcriptUrl ||= transcriptFromInfo(info, origin);
    }
  }

  if (!transcriptUrl && !playInfoPath && recordingData.isFromShare && recordingData.meetingId) {
    const shareInfoUrl = `${origin}/nws/recording/1.0/guest/play/share-info/${encodeURIComponent(
      recordingData.meetingId,
    )}?originDomain=${encodeURIComponent(host)}`;
    const shareInfo = await fetchJson(shareInfoUrl, link.href, signal);
    const redirectUrl = readNestedString(shareInfo, ["result", "redirectUrl"]);

    if (redirectUrl) {
      const playUrl = absoluteUrl(redirectUrl, origin);
      const playPage = normalizeZoomHtml(
        await fetchText(playUrl, link.href, HTML, signal),
      );
      recordingData = { ...recordingData, ...parseRecordingData(playPage) };
      transcriptUrl = pickTranscriptUrl(playPage, origin);
    }
  }

  if (!transcriptUrl && !playInfoPath && recordingData.fileId) {
    const playInfoUrl = `${origin}/nws/recording/1.0/guest/play/info/${encodeURIComponent(
      recordingData.fileId,
    )}?originDomain=${encodeURIComponent(host)}`;
    const playInfo = await fetchJson(playInfoUrl, link.href, signal);
    transcriptUrl = transcriptFromInfo(playInfo, origin);
  }

  if (transcriptUrl) {
    try {
      const raw = await fetchText(transcriptUrl, link.href, CAPTIONS, signal);
      const transcriptText = cleanZoomTranscript(raw);
      if (transcriptText.length >= 80 && Buffer.byteLength(transcriptText) <= 600000 &&
          !/^\s*(?:<|\{|\[\s*[{"\]])/.test(raw)) {
        return { transcriptText, transcriptUrl, fileId: recordingData.fileId || null };
      }
    } catch (error) {
      if (!identity || !lookupArchive) throw error;
    }
  }
  if (!identity || !lookupArchive) return null;
  const transcriptText = await lookupArchive(identity);
  return transcriptText ? { transcriptText, transcriptUrl: null, fileId: recordingData.fileId || null } : null;
}

async function fetchText(value: string, referer: string, accept: string, signal: AbortSignal) {
  let url = zoomUrl(value);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        accept,
        referer: new URL(referer).origin,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal,
    });
    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await response.body?.cancel();
      url = zoomUrl(location, url.href);
      continue;
    }
    if (!response.ok) throw new Error(`Zoom request failed with HTTP ${response.status}`);
    return response.text();
  }
  throw new Error("Too many Zoom redirects");
}

async function fetchJson(url: string, referer: string, signal: AbortSignal): Promise<unknown> {
  return JSON.parse(await fetchText(url, referer, "application/json", signal));
}

function transcriptFromInfo(info: unknown, origin: string) {
  for (const path of [["result", "mediaInfo"], ["result"]]) {
    for (const key of ["transcriptUrl", "ccUrl", "transcript_url"]) {
      const value = readNestedString(info, [...path, key]);
      if (value) return absoluteUrl(value, origin);
    }
  }
  return "";
}

function normalizeZoomHtml(html: string) {
  return html.replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

function parseRecordingData(html: string): RecordingData {
  const data: RecordingData = {};
  const block = html.match(/window\.recordingMobilePlayData\s*=\s*\{([\s\S]*?)\};/);
  const body = block ? block[1] : html;

  for (const key of ["meetingId", "fileId"] as const) {
    const match = body.match(new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`));
    if (match?.[1]) data[key] = match[1];
  }

  const shareMatch = body.match(/isFromShare\s*:\s*(true|false)/);
  if (shareMatch) data.isFromShare = shareMatch[1] === "true";

  return data;
}

function pickTranscriptUrl(raw: string, origin: string) {
  const patterns = [
    /"(?:transcriptUrl|transcript_url|ccUrl)"\s*:\s*"([^"]+)"/i,
    /'(?:transcriptUrl|transcript_url|ccUrl)'\s*:\s*'([^']+)'/i,
    /https?:\/\/[^"'<>\s]+\.vtt(?:\?[^"'<>\s]*)?/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return absoluteUrl((match[1] || match[0]).replace(/\\/g, "").trim(), origin);
  }

  return "";
}

function absoluteUrl(url: string, origin: string) {
  if (!url) return "";
  return zoomUrl(url, origin).href;
}

function readNested(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readNestedString(value: unknown, path: string[]) {
  const result = readNested(value, path);
  return typeof result === "string" ? result : "";
}

function cleanZoomTranscript(raw: string) {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!/^WEBVTT(?:\s|$)/.test(normalized)) return normalized;

  return normalized.split(/\n\s*\n/).flatMap(cue => {
    const marker = /^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->[^\n]*\n([\s\S]+)$/m.exec(cue);
    if (!marker) return [];
    const [, time, caption] = marker;
    const speech = caption.replace(/<v\s+([^>]+)>/gi, "$1: ").replace(/<[^>]+>/g, "").trim();
    const timestamp = time.split(":").length === 2 ? "00:" + time : time;
    return speech ? [`[${timestamp}] ${speech}`] : [];
  }).join("\n");
}
