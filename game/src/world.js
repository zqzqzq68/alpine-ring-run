// The valley: terrain profile, mountain ridges, river, fields and the ring
// course. Everything is a pure function of the seed, so the course never
// changes between runs.

import { mulberry32, range, pick } from './random.js';
import { RING_COUNT, RING_GAP, RUNWAY_LENGTH, SEED } from './config.js';

const FIELD_COLORS = ['#5d8a4a', '#6f9a52', '#7fae5e', '#4f7d46', '#8aa860', '#a8a35c'];

export function makeWorld(seed = SEED) {
  const rng = mulberry32(seed);

  // Three ridge layers, each a sum of sines with seeded phases. The renderer
  // samples them across the screen with a parallax offset from the plane.
  const ridges = [
    { parallax: 0.12, base: 0.52, amp: 46, color: '#5a6d94', snow: '#dfe8f5', waves: [[0.004, range(rng, 0, 6)], [0.011, range(rng, 0, 6)], [0.023, range(rng, 0, 6)]] },
    { parallax: 0.3, base: 0.62, amp: 62, color: '#46587c', snow: '#cfdaec', waves: [[0.006, range(rng, 0, 6)], [0.014, range(rng, 0, 6)], [0.031, range(rng, 0, 6)]] },
    { parallax: 0.55, base: 0.74, amp: 74, color: '#35466a', snow: '#bcc9e2', waves: [[0.008, range(rng, 0, 6)], [0.019, range(rng, 0, 6)], [0.043, range(rng, 0, 6)]] },
  ];

  // The river meanders across the valley floor.
  const river = { phase: range(rng, 0, 6), amp: range(rng, 130, 220), freq: 0.0016 };

  // Field strips for the valley floor, coloured in seeded order.
  const fields = [];
  for (let i = 0; i < 26; i++) fields.push(pick(rng, FIELD_COLORS));

  // Ring course: evenly spaced down the track, alternating sides and heights.
  const rings = [];
  let side = 1;
  for (let i = 0; i < RING_COUNT; i++) {
    side = -side;
    rings.push({
      index: i,
      dist: RUNWAY_LENGTH + 900 + i * RING_GAP,
      lat: side * range(rng, 90, 260) + range(rng, -40, 40),
      alt: range(rng, 520, 1380),
      passed: false,
      missed: false,
    });
  }

  return { ridges, river, fields, rings };
}

// Height of the valley floor (feet) at a track distance. Gentle rolling
// hills: the lowest ground sits near 60 ft, the highest knolls near 330 ft.
export function terrainAlt(dist) {
  const h =
    170 +
    92 * Math.sin(dist * 0.0011 + 1.7) +
    58 * Math.sin(dist * 0.0029 + 0.4) +
    32 * Math.sin(dist * 0.0073 + 2.2);
  return Math.max(55, h);
}

// Height of one ridge layer (pixels above its base line) at a screen x.
export function ridgeHeight(layer, x, planeDist) {
  const t = x + planeDist * layer.parallax;
  let h = 0;
  for (const [freq, phase] of layer.waves) h += Math.sin(t * freq + phase);
  return (h / layer.waves.length) * layer.amp;
}

// Lateral centre of the river (pixels from screen centre) at a screen y.
export function riverOffset(world, y, planeDist) {
  const depth = (y - 300) / 420; // 0 at the horizon, 1 at the bottom edge
  return Math.sin(planeDist * world.river.freq + y * 0.004 + world.river.phase) * world.river.amp * (0.25 + depth);
}
