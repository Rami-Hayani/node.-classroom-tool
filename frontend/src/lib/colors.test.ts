import { describe, it, expect } from "vitest";
import { confidenceToColor } from "./colors";

describe("confidenceToColor", () => {
  it("returns gray for 0", () => {
    expect(confidenceToColor(0)).toBe("gray");
  });

  it("returns red for 0.01", () => {
    expect(confidenceToColor(0.01)).toBe("red");
  });

  it("returns red below 25%", () => {
    expect(confidenceToColor(0.24)).toBe("red");
  });

  it("returns orange from 25% to 49%", () => {
    expect(confidenceToColor(0.25)).toBe("orange");
    expect(confidenceToColor(0.49)).toBe("orange");
  });

  it("returns yellow from 50% to 74%", () => {
    expect(confidenceToColor(0.5)).toBe("yellow");
    expect(confidenceToColor(0.74)).toBe("yellow");
  });

  it("returns green at 75% or higher", () => {
    expect(confidenceToColor(0.75)).toBe("green");
  });

  it("returns green for 1.0", () => {
    expect(confidenceToColor(1.0)).toBe("green");
  });
});
