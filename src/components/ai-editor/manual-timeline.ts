export function manualTimelineRange(
  duration: number | undefined,
  segmentCount: number,
  total: number,
  maxSegments: number,
  maxDuration: number,
): { start: number; end: number } | undefined {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return;
  const end = duration;
  if (segmentCount >= maxSegments || total + end > maxDuration) return;
  return { start: 0, end };
}
