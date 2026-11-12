export const VOICE_MAX_BYTES = 4_000_000;
export const VOICE_MAX_SECONDS = 120;
export type VoiceContext =
  | {kind:"coaching";reportType:"official"|"manual";reportId:string}
  | {kind:"faq";conversationId:string;messageId:string};

export function appendVoiceText(current: string, transcript: string) {
  return [current.trimEnd(), transcript.trim()].filter(Boolean).join("\n\n");
}

export function audioExtension(type: string) {
  const mime = type.split(";")[0].trim().toLowerCase();
  return ({ "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3" } as Record<string, string>)[mime];
}

export function audioMatchesContainer(bytes: Uint8Array, extension: string) {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (extension === "webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (extension === "mp4") return text(4, 8) === "ftyp";
  if (extension === "ogg") return text(0, 4) === "OggS";
  if (extension === "wav") return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  return extension === "mp3" && (text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
}
