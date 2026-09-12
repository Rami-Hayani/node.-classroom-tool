import { describe, expect, it } from "vitest";
import { createCircuitRoute, createCircuitRoutes, type MeasuredAnchor } from "./circuit-paths";

const anchors: MeasuredAnchor[] = [
  { id: "wordmark", left: 500, top: 260, width: 240, height: 100, side: "left" },
  { id: "tagline", left: 520, top: 420, width: 400, height: 32, side: "right" },
];

describe("circuit path generation", () => {
  it("connects measured anchor edges with a rounded orthogonal path", () => {
    const route = createCircuitRoute(anchors[0], anchors[1], { cornerRadius: 16 });

    expect(route.d).toMatch(/^M /);
    expect(route.d).toContain("Q");
    expect(route.source.x).toBe(482);
    expect(route.target.x).toBe(938);
    expect(route.bends.length).toBeGreaterThan(0);
  });

  it("preserves input order for sequential content anchors", () => {
    const routes = createCircuitRoutes(anchors);

    expect(routes).toHaveLength(1);
    expect(routes[0].source.y).toBe(310);
    expect(routes[0].target.y).toBe(436);
  });
});
