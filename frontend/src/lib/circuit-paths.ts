export type CircuitSide = "top" | "right" | "bottom" | "left";

export type MeasuredAnchor = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  side?: CircuitSide;
};

export type CircuitPoint = { x: number; y: number };

export type CircuitRoute = {
  source: CircuitPoint;
  target: CircuitPoint;
  bends: CircuitPoint[];
  points: CircuitPoint[];
  d: string;
};

export type CircuitRouteOptions = {
  cornerRadius?: number;
  clearance?: number;
};

const EPSILON = 0.5;

function center(anchor: MeasuredAnchor): CircuitPoint {
  return {
    x: anchor.left + anchor.width / 2,
    y: anchor.top + anchor.height / 2,
  };
}

function opposite(side: CircuitSide): CircuitSide {
  return side === "top" ? "bottom" : side === "right" ? "left" : side === "bottom" ? "top" : "right";
}

function chooseSide(source: MeasuredAnchor, target: MeasuredAnchor): CircuitSide {
  if (source.side) return source.side;

  const a = center(source);
  const b = center(target);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function edgePoint(anchor: MeasuredAnchor, side: CircuitSide, clearance: number): CircuitPoint {
  const midX = anchor.left + anchor.width / 2;
  const midY = anchor.top + anchor.height / 2;

  switch (side) {
    case "top": return { x: midX, y: anchor.top - clearance };
    case "right": return { x: anchor.left + anchor.width + clearance, y: midY };
    case "bottom": return { x: midX, y: anchor.top + anchor.height + clearance };
    case "left": return { x: anchor.left - clearance, y: midY };
  }
}

function compactPoints(points: CircuitPoint[]): CircuitPoint[] {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.abs(point.x - previous.x) > EPSILON || Math.abs(point.y - previous.y) > EPSILON;
  });
}

function roundedPath(points: CircuitPoint[], requestedRadius: number): string {
  const clean = compactPoints(points);
  if (clean.length < 2) return "";

  let d = `M ${clean[0].x} ${clean[0].y}`;

  for (let index = 1; index < clean.length - 1; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    const next = clean[index + 1];
    const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(requestedRadius, incomingLength / 2, outgoingLength / 2);

    if (radius <= EPSILON) {
      d += ` L ${current.x} ${current.y}`;
      continue;
    }

    const before = {
      x: current.x - ((current.x - previous.x) / incomingLength) * radius,
      y: current.y - ((current.y - previous.y) / incomingLength) * radius,
    };
    const after = {
      x: current.x + ((next.x - current.x) / outgoingLength) * radius,
      y: current.y + ((next.y - current.y) / outgoingLength) * radius,
    };

    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }

  const last = clean[clean.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function routePoints(source: CircuitPoint, target: CircuitPoint, sourceSide: CircuitSide, targetSide: CircuitSide): CircuitPoint[] {
  const sourceHorizontal = sourceSide === "left" || sourceSide === "right";
  const targetHorizontal = targetSide === "left" || targetSide === "right";

  if (sourceHorizontal && targetHorizontal) {
    const midX = (source.x + target.x) / 2;
    return [source, { x: midX, y: source.y }, { x: midX, y: target.y }, target];
  }

  if (!sourceHorizontal && !targetHorizontal) {
    const midY = (source.y + target.y) / 2;
    return [source, { x: source.x, y: midY }, { x: target.x, y: midY }, target];
  }

  // Mixed orientations use a single dogleg. This keeps the route short while
  // still leaving the anchor through its measured edge rather than its text.
  return sourceHorizontal
    ? [source, { x: target.x, y: source.y }, target]
    : [source, { x: source.x, y: target.y }, target];
}

export function createCircuitRoute(
  sourceAnchor: MeasuredAnchor,
  targetAnchor: MeasuredAnchor,
  options: CircuitRouteOptions = {},
): CircuitRoute {
  const clearance = options.clearance ?? 18;
  const cornerRadius = options.cornerRadius ?? 18;
  const sourceSide = chooseSide(sourceAnchor, targetAnchor);
  const targetSide = targetAnchor.side ?? opposite(sourceSide);
  const source = edgePoint(sourceAnchor, sourceSide, clearance);
  const target = edgePoint(targetAnchor, targetSide, clearance);
  const points = routePoints(source, target, sourceSide, targetSide);

  return {
    source,
    target,
    bends: points.slice(1, -1),
    points,
    d: roundedPath(points, cornerRadius),
  };
}

export function createCircuitRoutes(
  anchors: MeasuredAnchor[],
  options: CircuitRouteOptions = {},
): CircuitRoute[] {
  return anchors.slice(0, -1).flatMap((anchor, index) => {
    const next = anchors[index + 1];
    return next ? [createCircuitRoute(anchor, next, options)] : [];
  });
}
