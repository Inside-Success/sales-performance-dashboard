import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { canUseGreenLight, generateRequestSchema, multiClientFields, refineFactSource, refineRequestSchema, repFolderName, saveRequestSchema } from "@/lib/green-light/server";
import { countContextWords, focusPointLines, googleDocPdfUrl, greenLightDeadlineText, greenLightMinContextWords, isZoomRecordingLink } from "@/lib/green-light/shows";

describe("green light access", () => {
  it("is open to signed-in users unless a pilot list or the off switch is set", () => {
    expect(canUseGreenLight("Rep@InsideSuccess.com", {})).toBe(true);
    expect(canUseGreenLight(null, {})).toBe(false);
    expect(canUseGreenLight("", {})).toBe(false);
    const pilot = { GREEN_LIGHT_LETTERS_PILOT_EMAILS: " lead@insidesuccess.com, Other@insidesuccess.com " };
    expect(canUseGreenLight("LEAD@insidesuccess.com", pilot)).toBe(true);
    expect(canUseGreenLight("other@insidesuccess.com", pilot)).toBe(true);
    expect(canUseGreenLight("rep@insidesuccess.com", pilot)).toBe(false);
    expect(canUseGreenLight("lead@insidesuccess.com", { ...pilot, GREEN_LIGHT_LETTERS_DISABLED: "true" })).toBe(false);
    expect(canUseGreenLight("rep@insidesuccess.com", { GREEN_LIGHT_LETTERS_DISABLED: "true" })).toBe(false);
  });

  it("names the rep folder from the Google account, never with path characters", () => {
    expect(repFolderName("  Jordan   Example ", "jordan@insidesuccess.com")).toBe("Jordan Example");
    expect(repFolderName('Jo/rd:an*?"<>|', "jordan@insidesuccess.com")).toBe("Jo rd an");
    expect(repFolderName("", "jordan.example@insidesuccess.com")).toBe("jordan.example");
    expect(repFolderName(null, "jordan@insidesuccess.com")).toBe("jordan");
  });
});

describe("green light inputs", () => {
  it("keeps every line of the focus points box and cuts nothing", () => {
    expect(focusPointLines("")).toEqual([]);
    expect(focusPointLines(" - first point \n\n2) second   point\r\nthird\n\n")).toEqual(["- first point", "2) second point", "third"]);
    expect(focusPointLines(Array.from({ length: 60 }, (_, index) => `Q: question ${index}?`).join("\n"))).toHaveLength(60);
    expect(focusPointLines("x".repeat(5000))[0]).toHaveLength(5000);
  });

  it("counts only real words and asks more of the story letters", () => {
    expect(countContextWords("")).toBe(0);
    expect(countContextWords("  -  /  ...  ")).toBe(0);
    expect(countContextWords("Owns a roofing co, 12 yrs - started after getting laid off")).toBe(11);
    expect(countContextWords(["Owns a roofing co", "12 yrs"])).toBe(6);
    for (const show of ["mansion", "island", "reality"] as const) expect(greenLightMinContextWords(show)).toBe(8);
    for (const show of ["normal", "nlceo"] as const) expect(greenLightMinContextWords(show)).toBe(15);
  });

  it("accepts only Zoom recording links", () => {
    expect(isZoomRecordingLink("https://us06web.zoom.us/rec/share/abc.DEF_123")).toBe(true);
    expect(isZoomRecordingLink("https://insidesuccess.zoom.us/rec/play/abc?startTime=1")).toBe(true);
    expect(isZoomRecordingLink("https://us06web.zoom.us/j/83614505751?pwd=x")).toBe(false);
    expect(isZoomRecordingLink("http://us06web.zoom.us/rec/share/abc")).toBe(false);
    expect(isZoomRecordingLink("https://zoom.us.example.com/rec/share/abc")).toBe(false);
    expect(isZoomRecordingLink("https://docs.google.com/document/d/abc")).toBe(false);
    expect(isZoomRecordingLink("not a link")).toBe(false);
  });

  it("sends the editor deadline line only for the letters that carry one", () => {
    expect(greenLightDeadlineText("normal")).toBe("Sunday 11.59pm EST");
    expect(greenLightDeadlineText("reality")).toBe("Sunday 11.59pm EST");
    for (const show of ["nlceo", "mansion", "island"] as const) expect(greenLightDeadlineText(show)).toBe("");
  });

  it("builds the PDF link from the Google Doc link", () => {
    expect(googleDocPdfUrl("https://docs.google.com/document/d/1AbC_d-9/edit")).toBe("https://docs.google.com/document/d/1AbC_d-9/export?format=pdf");
    expect(googleDocPdfUrl("https://example.com/x")).toBe("");
  });

  it("maps the multi-prospect choice onto the workflow's existing fields", () => {
    expect(multiClientFields(undefined, "A One")).toEqual({ multi_client: false, multi_client_letter_count: 1, target_client_name: "", target_client_position: 1, client_names: [] });
    expect(multiClientFields({ enabled: false, letter_count: 1, position: 1, names: [] }, "A One").multi_client).toBe(false);
    expect(multiClientFields({ enabled: true, letter_count: 2, position: 2, names: ["A One", "B Two"] }, "B Two")).toEqual({ multi_client: true, multi_client_letter_count: 2, target_client_name: "B Two", target_client_position: 2, client_names: ["A One", "B Two"] });
    expect(multiClientFields({ enabled: true, letter_count: 1, position: 1, names: ["A One"] }, "A One")).toMatchObject({ multi_client: true, multi_client_letter_count: 1, target_client_name: "A One" });
  });

  it("requires a show, a prospect name and a real transcript", () => {
    const base = { show: "mansion", prospect_name: "Jordan Example", transcript: "x".repeat(200), input_type: "transcript", focus_points: [] };
    expect(generateRequestSchema.safeParse(base).success).toBe(true);
    expect(generateRequestSchema.safeParse({ ...base, show: "other" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...base, prospect_name: " " }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...base, transcript: "too short" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...base, focus_points: ["1", "2", "3", "4", "5", "6"] }).success).toBe(true);
    expect(generateRequestSchema.safeParse({ ...base, focus_points: Array.from({ length: 80 }, () => "A: " + "long answer ".repeat(60)) }).success).toBe(true);
    expect(generateRequestSchema.safeParse({ ...base, focus_points: [""] }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...base, transcript: "" }).success).toBe(false);
    expect(saveRequestSchema.safeParse({ show: "island", draft_text: "short", prospect_name: "Jordan Example" }).success).toBe(false);
    const saved = saveRequestSchema.parse({ show: "island", draft_text: "x".repeat(600), prospect_name: "Jordan Example", guest_name: "g".repeat(500), warnings: Array.from({ length: 40 }, () => "w".repeat(5000)) });
    expect(saved.guest_name).toHaveLength(160);
    expect(saved.warnings).toHaveLength(30);
    expect(saved.warnings?.[0]).toHaveLength(2000);
  });

  it("writes from the focus points alone only when there is no call, one prospect and enough to go on", () => {
    const words = (count: number) => [Array.from({ length: count }, (_, index) => `word${index}`).join(" ")];
    const base = { prospect_name: "Jordan Example", transcript: "", input_type: "focus_points" };
    for (const show of ["mansion", "island", "reality"] as const) {
      expect(generateRequestSchema.safeParse({ ...base, show, focus_points: words(8) }).success).toBe(true);
      expect(generateRequestSchema.safeParse({ ...base, show, focus_points: words(7) }).success).toBe(false);
    }
    for (const show of ["normal", "nlceo"] as const) {
      expect(generateRequestSchema.safeParse({ ...base, show, focus_points: words(15) }).success).toBe(true);
      expect(generateRequestSchema.safeParse({ ...base, show, focus_points: words(14) }).success).toBe(false);
    }
    const good = { ...base, show: "mansion", focus_points: words(30) };
    expect(generateRequestSchema.safeParse({ ...good, focus_points: [] }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...good, focus_points: ["- / ...", "!!"] }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...good, transcript: "x".repeat(200) }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...good, multi: { enabled: true, letter_count: 2, position: 1, names: ["A One", "B Two"] } }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...good, multi: { enabled: false, letter_count: 1, position: 1, names: [] } }).success).toBe(true);
    // A call request still needs its transcript, whatever is in the box.
    expect(generateRequestSchema.safeParse({ ...good, input_type: "zoom_link" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...good, input_type: "transcript" }).success).toBe(false);
  });

  it("gives the refine step the rep's own text when there was no transcript", () => {
    expect(refineFactSource("the call transcript", undefined)).toBe("the call transcript");
    expect(refineFactSource("the call transcript", "notes")).toBe("the call transcript");
    expect(refineFactSource("", "")).toBe("");
    const source = refineFactSource("", "Owns a roofing company.\nA: $5000 - $10,000");
    expect(source.startsWith("There is no call transcript for this letter.")).toBe(true);
    expect(source).toContain("Never mention budget, investment");
    expect(source.endsWith("\n\nOwns a roofing company.\nA: $5000 - $10,000")).toBe(true);
    const request = { show: "island", draft_text: "x".repeat(600), prospect_name: "Jordan Example", instructions: "shorter", transcript: "" };
    expect(refineRequestSchema.safeParse(request).success).toBe(true);
    expect(refineRequestSchema.safeParse({ ...request, source_notes: "n".repeat(150000) }).success).toBe(true);
  });
});
