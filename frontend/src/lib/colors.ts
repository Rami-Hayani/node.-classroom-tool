export const COLOR_HEX: Record<string, string> = {
  gray: "#94a3b8",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  active: "#3b82f6",
};

export function confidenceToColor(confidence: number): string {
  if (confidence === 0) return "gray";
  if (confidence > 0.75) return "green";
  if (confidence >= 0.5) return "yellow";
  if (confidence >= 0.25) return "orange";
  return "red";
}

export function confidenceToFill(confidence: number): string {
  if (confidence === 0) return "#e2e8f0";     // slate-200 (unvisited)
  if (confidence > 0.75) return "#bbf7d0";
  if (confidence >= 0.5) return "#fef08a";
  if (confidence >= 0.25) return "#fed7aa";
  return "#fecaca";
}

// 4-bucket node fill for the student knowledge graph (matches heatmap visual bands)
export function confidenceToNodeFill(confidence: number): string {
  if (confidence === 0) return "#e2e8f0";     // slate-200 (not started)
  if (confidence > 0.75) return "#bbf7d0";
  if (confidence >= 0.5) return "#fef08a";
  if (confidence >= 0.25) return "#fed7aa";
  return "#fecaca";
}

// 4-bucket node border for the student knowledge graph
export function confidenceToNodeBorder(confidence: number): string {
  if (confidence === 0) return "#94a3b8";     // gray
  if (confidence > 0.75) return "#22c55e";
  if (confidence >= 0.5) return "#eab308";
  if (confidence >= 0.25) return "#f97316";
  return "#ef4444";
}
