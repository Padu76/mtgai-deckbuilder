export function estimateLandCount(archetype: string, curveAvg: number, bo: 'bo1'|'bo3') {
  let base = archetype==='aggro' ? 22 : archetype==='control' ? 27 : 24
  if (bo==='bo1' && curveAvg < 2.2) base -= 1
  if (curveAvg > 3.2) base += 1
  return Math.max(20, Math.min(28, base))
}
