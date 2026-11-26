// Alpine Ring Run — game loop, flight physics, rings, lives and states.
// The plane flies down a seeded alpine valley. Thread the glowing rings,
// mind the terrain, beat the clock.

import { VIEW_W, VIEW_H, SEED, RING_COUNT, RING_GAP, TIME_LIMIT, LIVES, MIN_SPEED, MAX_SPEED, MAX_PITCH, MIN_PITCH, MAX_BANK, GROUND_CLEARANCE, RING_LAT_TOL, RING_ALT_TOL, RING_SCORE, TIME_BONUS_PER_SECOND, RUNWAY_LENGTH } from './config.js';
import { makeWorld, terrainAlt } from './world.js';
import { makeInput } from './input.js';
import { makeSfx } from './audio.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = makeInput(canvas);
const sfx = makeSfx();

const G = {
  state: 'title', // title | playing | paused | won | lost
  time: 0,
  timeLeft: TIME_LIMIT,
  score: 0,
  best: 0,
  ringsPassed: 0,
  lives: LIVES,
  combo: 0,
  crashReason: null,
  shake: 0,
  grace: 0, // seconds of terrain immunity right after a respawn
  stallTime: 0,
  plane: freshPlane(),
  world: makeWorld(SEED),
  particles: [],
  messages: [],
};

try {
  G.best = Number(window.localStorage.getItem('alpine-ring-run-best') || 0) || 0;
} catch {
  G.best = 0;
}

function freshPlane() {
  return {
    dist: 0,
    lat: 0,
    alt: terrainAlt(0) + 130,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    boost: false,
  };
}

function saveBest() {
  if (G.score > G.best) {
    G.best = G.score;
    try {
      window.localStorage.setItem('alpine-ring-run-best', String(G.best));
    } catch {
      // Best score is a nicety; the game does not depend on storage.
    }
  }
}

function resetRun() {
  G.world = makeWorld(SEED);
  G.plane = freshPlane();
  G.plane.speed = 95;
  G.plane.throttle = 0.62;
  G.plane.alt = 620;
  G.score = 0;
  G.ringsPassed = 0;
  G.lives = LIVES;
  G.combo = 0;
  G.timeLeft = TIME_LIMIT;
  G.crashReason = null;
  G.particles = [];
  G.messages = [];
  G.shake = 0;
  G.grace = 0;
  G.stallTime = 0;
}

function startGame() {
  resetRun();
  G.state = 'playing';
  sfx.unlock();
  sfx.click();
  sfx.engineOn();
}

function addMessage(text, color = '#ffd27a') {
  G.messages.push({ text, color, life: 1.6 });
  if (G.messages.length > 4) G.messages.shift();
}

function burst(x, y, color, n = 26) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 220;
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.7 + Math.random() * 0.6,
      maxLife: 1.3,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function ringScreenPos(ring) {
  // Mirror of the renderer's projection, for the pass burst.
  const p = G.plane;
  const rel = Math.max(1, ring.dist - p.dist);
  const persp = 1 / (0.35 + rel / 700);
  const horizonY = Math.max(175, Math.min(430, 305 - p.pitch * 5 - (p.alt - 900) * 0.03));
  return {
    x: VIEW_W / 2 + (ring.lat - p.lat) * persp * 1.05,
    y: horizonY - (ring.alt - p.alt) * persp * 0.5 - 26 * persp,
  };
}

function passRing(ring) {
  ring.passed = true;
  G.ringsPassed += 1;
  G.combo += 1;
  const bonus = RING_SCORE + (G.combo - 1) * 25;
  G.score += bonus;
  const pos = ringScreenPos(ring);
  burst(pos.x, pos.y, '#ffb347', 30);
  burst(pos.x, pos.y, '#fff3c4', 16);
  addMessage(`+${bonus}  RING ${ring.index + 1}${G.combo > 1 ? `  ·  COMBO x${G.combo}` : ''}`, '#ffd27a');
  sfx.ring();
  if (G.ringsPassed >= RING_COUNT) {
    const timeBonus = Math.round(G.timeLeft) * TIME_BONUS_PER_SECOND;
    G.score += timeBonus;
    saveBest();
    G.state = 'won';
    sfx.win();
    sfx.engineOff();
    addMessage(`TIME BONUS +${timeBonus}`, '#7be495');
  }
}

function missRing(ring) {
  ring.missed = true;
  G.combo = 0;
  addMessage(`MISSED RING ${ring.index + 1}`, '#ff9d8a');
}

function crash(reason) {
  G.lives -= 1;
  G.shake = 14;
  G.crashReason = reason;
  sfx.crash();
  burst(VIEW_W / 2, 500, '#ff6b5e', 34);
  burst(VIEW_W / 2, 500, '#3c3f46', 22);
  if (G.lives <= 0) {
    saveBest();
    G.state = 'lost';
    sfx.engineOff();
    return;
  }
  // Respawn just behind the next ring, wings level, with a short grace period.
  const next = G.world.rings.find((r) => !r.passed && !r.missed) || G.world.rings[G.world.rings.length - 1];
  const p = G.plane;
  p.dist = Math.max(0, next.dist - 500);
  p.lat = next.lat;
  p.alt = Math.max(next.alt, terrainAlt(p.dist) + 260);
  p.heading = 0;
  p.pitch = 0;
  p.bank = 0;
  p.speed = 115;
  p.throttle = 0.7;
  G.grace = 2.5;
  addMessage(`LIVES LEFT: ${G.lives} — BACK IN THE AIR`, '#ff9d8a');
}

function update(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 26);
  G.grace = Math.max(0, G.grace - dt);

  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 160 * dt;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const m of G.messages) m.life -= dt;
  G.messages = G.messages.filter((m) => m.life > 0);

  if (G.state === 'title') {
    // Idle drift on the title screen: the camera creeps along the runway.
    G.plane.dist += 26 * dt;
    G.plane.alt = terrainAlt(G.plane.dist) + 130;
    return;
  }
  if (G.state !== 'playing') return;

  const p = G.plane;
  const ctl = input.sample();

  if (ctl.throttleUp) p.throttle = Math.min(1, p.throttle + 0.35 * dt);
  if (ctl.throttleDown) p.throttle = Math.max(0, p.throttle - 0.35 * dt);
  p.boost = ctl.boost && p.throttle > 0.5;

  const targetSpeed = MIN_SPEED + p.throttle * (MAX_SPEED - MIN_SPEED) + (p.boost ? 32 : 0);
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 0.55);

  const pitchTarget = ctl.pitch * (ctl.pitch > 0 ? MAX_PITCH : -MIN_PITCH);
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 3.2);
  const bankTarget = ctl.roll * MAX_BANK;
  p.bank += (bankTarget - p.bank) * Math.min(1, dt * 3.4);

  // Banking turns the nose; the nose steers the track.
  p.heading += p.bank * 0.24 * dt * (p.speed / 120);
  const headingRad = (p.heading * Math.PI) / 180;
  const forward = p.speed * 2.3 * dt;
  p.dist += Math.cos(headingRad) * forward;
  p.lat += Math.sin(headingRad) * forward;
  p.lat = Math.max(-520, Math.min(520, p.lat));

  // Climb and sink.
  const climb = Math.sin((p.pitch * Math.PI) / 180) * p.speed * 2.1;
  p.alt += climb * dt;
  if (p.speed < 82) p.alt -= (82 - p.speed) * 0.85 * dt; // mushy wing at low speed
  p.alt = Math.max(40, p.alt);

  // Stall: too slow for too long and the nose drops.
  if (p.speed < 62) {
    G.stallTime += dt;
    if (G.stallTime > 1.6) p.alt -= 130 * dt;
  } else {
    G.stallTime = 0;
  }

  sfx.engineSet(p.throttle, (p.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED));

  // Rings: crossing a ring's track position decides pass or miss.
  for (const ring of G.world.rings) {
    if (ring.passed || ring.missed) continue;
    if (ring.dist - p.dist <= 0 && ring.dist - (p.dist - forward) > 0) {
      const latErr = Math.abs(ring.lat - p.lat);
      const altErr = Math.abs(ring.alt - p.alt);
      if (latErr <= RING_LAT_TOL && altErr <= RING_ALT_TOL) passRing(ring);
      else missRing(ring);
      if (G.state !== 'playing') return;
    }
  }

  // Terrain.
  const ground = terrainAlt(p.dist);
  if (G.grace <= 0 && p.alt <= ground + GROUND_CLEARANCE) {
    crash(G.stallTime > 1.6 ? 'stall' : 'terrain');
    if (G.state !== 'playing') return;
  }

  // Clock.
  G.timeLeft -= dt;
  if (G.timeLeft <= 0) {
    G.timeLeft = 0;
    G.crashReason = 'time';
    saveBest();
    G.state = 'lost';
    sfx.engineOff();
  }
}

function handleKeys() {
  if (input.wasPressed('Enter', 'NumpadEnter', 'MouseClick', 'Space')) {
    if (G.state === 'title' || G.state === 'won' || G.state === 'lost') startGame();
  }
  if (input.wasPressed('KeyR')) {
    if (G.state !== 'title') startGame();
  }
  if (input.wasPressed('KeyP', 'Escape')) {
    if (G.state === 'playing') {
      G.state = 'paused';
      sfx.engineOff();
    } else if (G.state === 'paused') {
      G.state = 'playing';
      sfx.engineOn();
    }
  }
  if (input.wasPressed('KeyM')) {
    const muted = sfx.toggleMute();
    addMessage(muted ? 'SOUND OFF' : 'SOUND ON', '#c8d6ea');
  }
}

// Screenshot poses (?shot=1 title, 2 mid-flight, 3 ring pass). The game
// itself renders these states; nothing is composited or faked.
function applyShotMode() {
  const shot = new URLSearchParams(window.location.search).get('shot');
  if (shot === '1') {
    G.plane.dist = 500;
    G.plane.alt = terrainAlt(500) + 130;
    G.plane.speed = 0;
    G.plane.throttle = 0;
  } else if (shot === '2' || shot === '3') {
    resetRun();
    G.state = 'playing';
    const ring = G.world.rings[shot === '2' ? 2 : 4];
    const p = G.plane;
    if (shot === '2') {
      p.dist = ring.dist - 780;
      p.lat = ring.lat + 42;
      p.alt = ring.alt - 28;
      p.speed = 152;
      p.throttle = 0.82;
      p.pitch = 2;
      p.bank = -7;
    } else {
      // Just through the ring: the pass burst and score popup are live.
      p.dist = ring.dist + 130;
      p.lat = ring.lat;
      p.alt = ring.alt;
      p.speed = 158;
      p.throttle = 0.85;
      p.pitch = 1;
      p.bank = 6;
      ring.passed = true;
      G.ringsPassed = 1;
      G.score = 100;
      G.combo = 1;
      burst(VIEW_W / 2, 400, '#ffb347', 30);
      burst(VIEW_W / 2, 400, '#fff3c4', 16);
      addMessage('+100  RING 5', '#ffd27a');
    }
    sfx.engineOn();
  }
}

applyShotMode();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  handleKeys();
  update(dt);
  draw(ctx, G);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
