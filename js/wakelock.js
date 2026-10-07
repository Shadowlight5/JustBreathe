// Best-effort Screen Wake Lock. Takes the navigator as an argument so tests can fake it.
export function createWakeLock(nav) {
  let generation = 0;   // bumped on every release(); a request that resolves with an
  let sentinel = null;  // older generation is stale and released immediately

  function drop(s) { if (s && !s.released) Promise.resolve(s.release?.()).catch(() => {}); }

  async function acquire() {
    const api = nav?.wakeLock;
    if (!api?.request) return;
    if (sentinel && !sentinel.released) return;   // already held
    const gen = generation;
    try {
      const s = await api.request('screen');
      if (gen !== generation || (sentinel && !sentinel.released)) { drop(s); return; } // stale or superseded
      sentinel = s;
    } catch { /* denied or unsupported: ignore */ }
  }

  function release() {
    generation += 1;
    const s = sentinel; sentinel = null;
    drop(s);
  }

  return { acquire, release, get held() { return sentinel !== null && !sentinel.released; } };
}
