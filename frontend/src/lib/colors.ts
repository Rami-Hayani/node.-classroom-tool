export const COLOR_HEX: Record<string, string> = {
  gray: "#9ca3af",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  active: "#3b82f6",
};

export function confidenceToColor(confidence: number): string {
  if (confidence === 0) return "gray";
  if (confidence < 0.25) return "red";
  if (confidence < 0.5) return "orange";
  if (confidence < 0.75) return "yellow";
  return "green";
}

export function confidenceToFill(confidence: number): string {
  if (confidence === 0) return "#d1d5db";     // neutral gray (unvisited)
  if (confidence < 0.25) return "#f87171";
  if (confidence < 0.5) return "#fb923c";
  if (confidence < 0.75) return "#facc15";
  return "#4ade80";
}

// 4-bucket node fill for the student knowledge graph (matches heatmap visual bands)
export function confidenceToNodeFill(confidence: number): string {
  if (confidence === 0) return "#d1d5db";     // neutral gray (not started)
  if (confidence < 0.25) return "#f87171";
  if (confidence < 0.5) return "#fb923c";
  if (confidence < 0.75) return "#facc15";
  return "#4ade80";
}

// 4-bucket node border for the student knowledge graph
export function confidenceToNodeBorder(confidence: number): string {
  if (confidence === 0) return "#9ca3af";     // neutral gray
  if (confidence < 0.25) return "#ef4444";
  if (confidence < 0.5) return "#f97316";
  if (confidence < 0.75) return "#eab308";
  return "#22c55e";
}
