// Pure timing logic for guided breathing. No DOM access, so it runs under node --test.

// Cosine ease, 0 -> 1. Written with sin(PI/2 - x) == cos(x) so the midpoint is exactly 0.5
// in floating point (the cos form gives 0.49999999999999994).
export function easeInOut(p) {
  return 0.5 - 0.5 * Math.sin(Math.PI * (0.5 - p));
}

export function totalMs(pattern) {
  return pattern.phases.reduce((sum, phase) => sum + phase.seconds * 1000, 0);
}

export function phaseAt(elapsedMs, pattern) {
  const elapsed = Math.max(0, elapsedMs);
  const total = totalMs(pattern);
  const cycle = Math.floor(elapsed / total);
  let t = elapsed % total;
  let index = 0;
  while (t >= pattern.phases[index].seconds * 1000) {
    t -= pattern.phases[index].seconds * 1000;
    index += 1;
  }
  const { label, seconds, from, to } = pattern.phases[index];
  const progress = t / (seconds * 1000);
  const remaining = Math.max(1, Math.ceil(seconds - progress * seconds));
  const size = Math.min(1, Math.max(0, from + (to - from) * easeInOut(progress)));
  return { index, label, seconds, progress, remaining, size, cycle };
}

export function isComplete(state, pattern) {
  return Boolean(pattern.cycles) && state.cycle >= pattern.cycles;
}

export function phaseFractions(pattern) {
  const total = totalMs(pattern);
  return pattern.phases.map((phase) => (phase.seconds * 1000) / total);
}

export function phaseFills(state, pattern) {
  return pattern.phases.map((_, i) => (i < state.index ? 1 : i === state.index ? state.progress : 0));
}
