// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GreenLightGenerator } from "@/components/green-light/green-light-generator";
import { splitLetter } from "@/lib/green-light/letter-sections";
import fixtures from "./letter-fixtures.json";

// What a refresh keeps: a letter on the review screen, yes; anything typed on the call details screen, no.
const KEY = "magic-mike-green-light-letters-v1";
const LETTER = (fixtures as Record<string, string>).mansion;
const ZOOM = "https://us06web.zoom.us/rec/share/abc.DEF_123";

const FILLED_FORM = {
  show: "mansion",
  inputType: "zoom_link",
  zoomLink: ZOOM,
  transcript: "",
  multiEnabled: false,
  letterCount: 2,
  prospectName: "Jordan Example",
  firstName: "",
  secondName: "",
  focus: "Wants to be known for storm repair",
  focusSecond: "",
};
const DRAFT = {
  id: "v2_1763500000000_abc123",
  prospectName: "Jordan Example",
  jobId: "v2_1763500000000_abc123",
  show: "mansion",
  multi: { enabled: false, letter_count: 1, position: 1, names: [] },
  segments: splitLetter(LETTER).segments,
  guestName: "Jordan Example",
  docTitle: "Mansion of Money TV x Jordan Example",
  warnings: [],
  saved: null,
  noTranscript: false,
  sourceNotes: "",
};
const stored = () => JSON.parse(window.sessionStorage.getItem(KEY) || "null");
const store = (value: unknown) => window.sessionStorage.setItem(KEY, JSON.stringify(value));
const zoomBox = () => screen.getByRole("textbox", { name: "Zoom recording link" }) as HTMLInputElement;
const focusBox = () => screen.getByRole("textbox", { name: /Focus points/ }) as HTMLTextAreaElement;
const nameBox = () => screen.getByLabelText("Prospect's full name") as HTMLInputElement;
const showIsPicked = () => screen.getAllByRole("radio").some((choice) => choice.getAttribute("aria-checked") === "true");
/** A refresh: the page is torn down and loaded again in the same tab. */
const refresh = () => {
  cleanup();
  render(<GreenLightGenerator />);
};
const expectCleanForm = () => {
  expect(zoomBox().value).toBe("");
  expect(focusBox().value).toBe("");
  expect(nameBox().value).toBe("");
  expect(showIsPicked()).toBe(false);
  expect(screen.queryByRole("button", { name: "Back to the letter" })).toBeNull();
};

beforeEach(() => {
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("green light page after a refresh", () => {
  it("starts clean when the rep was on the call details screen", async () => {
    render(<GreenLightGenerator />);
    fireEvent.click(screen.getByRole("radio", { name: "Mansion of Money" }));
    fireEvent.change(zoomBox(), { target: { value: ZOOM } });
    fireEvent.change(nameBox(), { target: { value: "Jordan Example" } });
    fireEvent.change(focusBox(), { target: { value: "Wants to be known for storm repair" } });
    fireEvent.click(screen.getByRole("button", { name: "Paste transcript" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Call transcript" }), { target: { value: "A pasted transcript" } });
    expect(showIsPicked()).toBe(true);
    // Nothing typed on this screen is written to the browser's storage.
    await waitFor(() => expect(stored()).toBeNull());

    refresh();
    expectCleanForm();
    expect(screen.queryByRole("textbox", { name: "Call transcript" })).toBeNull();
  });

  it("ignores details saved by the earlier version of the page", () => {
    store({ form: FILLED_FORM, callTranscript: "", drafts: [], activeIndex: 0, step: "details" });
    render(<GreenLightGenerator />);
    expectCleanForm();
    expect(stored()).toBeNull();
  });

  it("keeps a letter that is on the review screen, with the rep's edits", async () => {
    store({ form: FILLED_FORM, callTranscript: "the call transcript", drafts: [DRAFT], activeIndex: 0, step: "review" });
    render(<GreenLightGenerator />);
    expect(screen.getByRole("heading", { name: "Review and edit" })).toBeTruthy();
    const section = () => screen.getByRole("textbox", { name: "Business Experience" }) as HTMLTextAreaElement;
    expect(section().value).toContain("regional roofing company");
    fireEvent.change(section(), { target: { value: "You built a $3.5 million roofing company." } });
    await waitFor(() => expect(JSON.stringify(stored())).toContain("$3.5 million roofing company"));

    refresh();
    expect(screen.getByRole("heading", { name: "Review and edit" })).toBeTruthy();
    expect(section().value).toBe("You built a $3.5 million roofing company.");
    // The details that letter was made from are still behind "Change call details".
    fireEvent.click(screen.getByRole("button", { name: "Change call details" }));
    expect(zoomBox().value).toBe(ZOOM);
    expect(screen.getByRole("button", { name: "Back to the letter" })).toBeTruthy();
  });

  it("starts clean when the rep went back to the call details and then refreshed", async () => {
    store({ form: FILLED_FORM, callTranscript: "the call transcript", drafts: [DRAFT], activeIndex: 0, step: "review" });
    render(<GreenLightGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "Change call details" }));
    await waitFor(() => expect(stored()).toBeNull());
    // Going back to the letter without refreshing still works, and it is kept again.
    fireEvent.click(screen.getByRole("button", { name: "Back to the letter" }));
    await waitFor(() => expect(stored()?.step).toBe("review"));
    fireEvent.click(screen.getByRole("button", { name: "Change call details" }));
    await waitFor(() => expect(stored()).toBeNull());

    refresh();
    expectCleanForm();
    expect(screen.queryByRole("heading", { name: "Review and edit" })).toBeNull();
  });

  it("starts clean after Start a new letter", async () => {
    store({ form: FILLED_FORM, callTranscript: "the call transcript", drafts: [DRAFT], activeIndex: 0, step: "review" });
    render(<GreenLightGenerator />);
    fireEvent.click(screen.getAllByRole("button", { name: "Start a new letter" })[0]);
    expectCleanForm();
    await waitFor(() => expect(stored()).toBeNull());
    refresh();
    expectCleanForm();
  });

  it("does not break when the saved state is damaged", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    render(<GreenLightGenerator />);
    expectCleanForm();
    cleanup();
    store({ step: "review", drafts: [DRAFT] });
    render(<GreenLightGenerator />);
    expectCleanForm();
  });
});
