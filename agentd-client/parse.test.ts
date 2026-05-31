import { describe, expect, it } from "vitest";
import { coerceDecision } from "./parse.js";

describe("coerceDecision — tolerant LLM JSON", () => {
  it("passes through a real object", () => {
    expect(coerceDecision({ action: "vote", target: 3 })).toEqual({ action: "vote", target: 3 });
  });

  it("parses a bare JSON string", () => {
    expect(coerceDecision('{"action":"check","target":5}')).toEqual({ action: "check", target: 5 });
  });

  it("strips a ```json fence", () => {
    const s = "```json\n{ \"action\": \"kill\", \"target\": 2 }\n```";
    expect(coerceDecision(s)).toEqual({ action: "kill", target: 2 });
  });

  it("strips a bare ``` fence", () => {
    expect(coerceDecision("```\n{\"action\":\"pass\"}\n```")).toEqual({ action: "pass" });
  });

  it("extracts the first object from surrounding prose", () => {
    const s = 'Sure! Here is my decision: {"action":"vote","target":4} — hope that helps.';
    expect(coerceDecision(s)).toEqual({ action: "vote", target: 4 });
  });

  it("handles braces inside strings", () => {
    const s = '{"action":"speech","speech":"I think {seat 3} is sus"}';
    expect(coerceDecision(s)).toEqual({ action: "speech", speech: "I think {seat 3} is sus" });
  });

  it("returns null for unsalvageable input", () => {
    expect(coerceDecision("no json here")).toBeNull();
    expect(coerceDecision(null)).toBeNull();
    expect(coerceDecision(42)).toBeNull();
    expect(coerceDecision("[1,2,3]")).toBeNull(); // array, not a decision object
  });
});
