// Deterministic pseudo-random helpers. The valley, the rings and the field
// colours all come from one seed, so every run of the game shows the same
// course and the screenshots always match the game.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

export function rangeInt(rng, lo, hi) {
  return Math.floor(range(rng, lo, hi + 1));
}

export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
