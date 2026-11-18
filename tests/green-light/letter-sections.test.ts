import { describe, expect, it } from "vitest";
import fixtures from "./letter-fixtures.json";
import {
  assembleLetter,
  emptySections,
  joinLetter,
  otherShowMentions,
  splitLetter,
  type LetterSegment,
} from "@/lib/green-light/letter-sections";

const letters = fixtures as Record<string, string>;
const editable = (segments: LetterSegment[]) =>
  segments.filter((segment): segment is Extract<LetterSegment, { kind: "edit" }> => segment.kind === "edit");
const setText = (segments: LetterSegment[], key: string, text: string) =>
  segments.map((segment) => (segment.kind === "edit" && segment.key === key ? { ...segment, text } : segment));

describe("green light letter sections", () => {
  it.each(Object.keys(letters))("splits the %s letter and rebuilds it unchanged", (show) => {
    const split = splitLetter(letters[show]);
    expect(split.mode).toBe("sections");
    expect(joinLetter(split.segments)).toBe(letters[show]);
    expect(assembleLetter(split.segments)).toBe(letters[show].trim());
    expect(emptySections(split.segments)).toEqual([]);
  });

  it.each(["mansion", "island", "reality"])("finds the name and four profile paragraphs in the %s letter", (show) => {
    const keys = editable(splitLetter(letters[show]).segments).map((segment) => segment.key);
    expect(keys).toEqual(["prospect_name", "business_experience", "competitive_edge", "personality", "the_wildcard"]);
  });

  it.each(["normal", "nlceo"])("finds every story section in the %s letter", (show) => {
    const keys = editable(splitLetter(letters[show]).segments).map((segment) => segment.key);
    expect(keys).toEqual(["prospect_name", "act_1", "act_2", "act_3", "act_4", "act_5", "your_thing", "mission", "why_now"]);
  });

  it("keeps the fixed wording byte for byte when sections are edited", () => {
    for (const show of Object.keys(letters)) {
      const original = splitLetter(letters[show]);
      let edited = original.segments;
      for (const segment of editable(original.segments)) edited = setText(edited, segment.key, `  Edited ${segment.key}\r\nsecond line   \n\n\n\nthird  `);
      const rebuilt = splitLetter(assembleLetter(edited));
      expect(rebuilt.mode).toBe("sections");
      const fixed = (segments: LetterSegment[]) => segments.filter((segment) => segment.kind === "fixed").map((segment) => segment.text);
      expect(fixed(rebuilt.segments)).toEqual(fixed(original.segments));
      expect(editable(rebuilt.segments).find((segment) => segment.key === "business_experience" || segment.key === "act_1")?.text)
        .toMatch(/^Edited (business_experience|act_1)\nsecond line\n\nthird$/);
      expect(editable(rebuilt.segments)[0].text).toBe("Edited prospect_name second line third");
    }
  });

  it("keeps the Cast Name prefix out of the editable name", () => {
    const name = editable(splitLetter(letters.mansion).segments)[0];
    expect(name).toMatchObject({ key: "prospect_name", prefix: "Cast Name: ", text: "Jordan Example", multiline: false });
    expect(assembleLetter(setText(splitLetter(letters.mansion).segments, "prospect_name", "Alex Rivera"))).toContain("\nCast Name: Alex Rivera\n");
  });

  it("reports empty sections by label", () => {
    const segments = setText(splitLetter(letters.island).segments, "personality", "   \n ");
    expect(emptySections(segments)).toEqual(["Personality"]);
  });

  it("falls back to one text box for an unknown layout", () => {
    for (const text of ["", "Just some text", letters.mansion.replace("\nPERSONALITY\n", "\nCHARACTER\n"), letters.normal.replace("This was the turning point.", "A new fixed line.")]) {
      const split = splitLetter(text);
      expect(split.mode).toBe("full");
      expect(split.segments).toHaveLength(1);
      expect(assembleLetter(split.segments)).toBe(text.trim());
    }
  });

  it("flags another show named in the written sections only", () => {
    const mansion = splitLetter(letters.mansion).segments;
    expect(otherShowMentions("mansion", mansion)).toEqual([]);
    expect(otherShowMentions("mansion", setText(mansion, "the_wildcard", "You first applied for Entrepreneur's Island."))).toEqual(["Entrepreneurs Island"]);
    expect(otherShowMentions("island", setText(splitLetter(letters.island).segments, "personality", "A Mansion of Money natural."))).toEqual(["Mansion of Money"]);
    expect(otherShowMentions("normal", setText(splitLetter(letters.normal).segments, "act_3", "Mansion of Money and Next Level CEO came up."))).toEqual(["Mansion of Money", "Next Level CEO"]);
    // The fixed island wording names its own show; that must never be flagged.
    expect(otherShowMentions("island", splitLetter(letters.island).segments)).toEqual([]);
    expect(otherShowMentions("reality", setText(splitLetter(letters.reality).segments, "personality", "Mansion of Money"))).toEqual([]);
  });
});
