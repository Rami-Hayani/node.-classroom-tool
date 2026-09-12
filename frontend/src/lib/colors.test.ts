import { describe, it, expect } from "vitest";
import { confidenceToColor } from "./colors";

describe("confidenceToColor", () => {
  it("returns gray for 0", () => {
    expect(confidenceToColor(0)).toBe("gray");
  });

  it("returns red for 0.01", () => {
    expect(confidenceToColor(0.01)).toBe("red");
  });

  it("returns orange for 0.39", () => {
    expect(confidenceToColor(0.39)).toBe("orange");
  });

  it("returns orange for 0.4", () => {
    expect(confidenceToColor(0.4)).toBe("orange");
  });

  it("returns yellow for 0.5", () => {
    expect(confidenceToColor(0.5)).toBe("yellow");
  });

  it("returns green for 0.76", () => {
    expect(confidenceToColor(0.76)).toBe("green");
  });

  it("returns green for 1.0", () => {
    expect(confidenceToColor(1.0)).toBe("green");
  });
});
