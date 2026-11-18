import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { canUseGreenLight, generateRequestSchema, multiClientFields, repFolderName, saveRequestSchema } from "@/lib/green-light/server";
import { googleDocPdfUrl, greenLightDeadlineText, isZoomRecordingLink, parseFocusPoints } from "@/lib/green-light/shows";

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
  it("keeps at most five tidy focus points", () => {
    expect(parseFocusPoints("")).toEqual([]);
    expect(parseFocusPoints(" - first point \n\n2) second   point\n• third\n4. fourth\nfifth\nsixth")).toEqual(["first point", "second point", "third", "fourth", "fifth"]);
    expect(parseFocusPoints("x".repeat(500))[0]).toHaveLength(300);
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
    expect(generateRequestSchema.safeParse({ ...base, focus_points: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(saveRequestSchema.safeParse({ show: "island", draft_text: "short", prospect_name: "Jordan Example" }).success).toBe(false);
    const saved = saveRequestSchema.parse({ show: "island", draft_text: "x".repeat(600), prospect_name: "Jordan Example", guest_name: "g".repeat(500), warnings: Array.from({ length: 40 }, () => "w".repeat(5000)) });
    expect(saved.guest_name).toHaveLength(160);
    expect(saved.warnings).toHaveLength(30);
    expect(saved.warnings?.[0]).toHaveLength(2000);
  });
});
