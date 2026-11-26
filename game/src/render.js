// All drawing: sky, ridges, valley floor, runway, rings, the courier plane,
// particles and the HUD. Pure canvas 2D, no images, no network.

import { VIEW_W, VIEW_H, RUNWAY_LENGTH } from './config.js';
import { ridgeHeight, riverOffset, terrainAlt } from './world.js';

const CX = VIEW_W / 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function horizonYOf(G) {
  const p = G.plane;
  return clamp(305 - p.pitch * 5 - (p.alt - 900) * 0.03, 175, 430);
}

function groundCenterX(G, depth) {
  return CX - G.plane.lat * (0.25 + depth * 0.5);
}

export function draw(ctx, G) {
  const p = G.plane;
  const horizonY = horizonYOf(G);
  ctx.save();
  if (G.shake > 0) {
    ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  }
  drawSky(ctx, G, horizonY);
  drawRidges(ctx, G, horizonY);
  drawGround(ctx, G, horizonY);
  drawRings(ctx, G, horizonY);
  drawParticles(ctx, G);
  drawPlane(ctx, G);
  ctx.restore();
  drawHud(ctx, G, horizonY);
  drawOverlays(ctx, G);
}

function drawSky(ctx, G, horizonY) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  sky.addColorStop(0, '#1c2f5e');
  sky.addColorStop(0.55, '#5f7fb0');
  sky.addColorStop(1, '#f2a95c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, horizonY + 2);

  // Low sun with a warm glow.
  const sunX = 1060;
  const sunY = Math.max(70, horizonY - 150);
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
  glow.addColorStop(0, 'rgba(255, 214, 130, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 190, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Drifting clouds, parallaxed against the plane's travel.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 9; i++) {
    const cx = (((i * 173 + 420 - G.plane.dist * 0.12) % 1500) + 1500) % 1500 - 110;
    const cy = 52 + ((i * 61) % 190);
    const s = 0.7 + ((i * 37) % 10) / 14;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 52 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34 * s, cy + 5, 38 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 36 * s, cy + 6, 32 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRidges(ctx, G, horizonY) {
  for (const layer of G.world.ridges) {
    const baseY = horizonY + 6 - (0.74 - layer.base) * 120;
    ctx.beginPath();
    ctx.moveTo(-4, horizonY + 4);
    for (let x = 0; x <= VIEW_W; x += 16) {
      ctx.lineTo(x, baseY - ridgeHeight(layer, x, G.plane.dist));
    }
    ctx.lineTo(VIEW_W + 4, horizonY + 4);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();
    // Snow caps: a lighter copy of the same ridge, squashed toward the peaks.
    ctx.beginPath();
    ctx.moveTo(-4, horizonY + 4);
    for (let x = 0; x <= VIEW_W; x += 16) {
      const h = ridgeHeight(layer, x, G.plane.dist);
      ctx.lineTo(x, baseY - h - Math.max(0, h - layer.amp * 0.45) * 0.55);
    }
    ctx.lineTo(VIEW_W + 4, horizonY + 4);
    ctx.closePath();
    ctx.fillStyle = layer.snow;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawGround(ctx, G, horizonY) {
  const rows = 14;
  const ys = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    ys.push(horizonY + (VIEW_H - horizonY) * t * t);
  }
  // Field bands, darker and greener near the horizon, warm near the camera.
  for (let i = 0; i < rows; i++) {
    const depth = i / rows;
    const gc = groundCenterX(G, depth);
    const halfW = 90 + depth * 900;
    ctx.fillStyle = G.world.fields[i % G.world.fields.length];
    ctx.globalAlpha = 0.55 + depth * 0.45;
    ctx.fillRect(0, ys[i], VIEW_W, ys[i + 1] - ys[i] + 1);
    ctx.globalAlpha = 1;
    // A hedgerow line between bands.
    ctx.fillStyle = 'rgba(20, 40, 20, 0.35)';
    ctx.fillRect(gc - halfW, ys[i + 1] - 1, halfW * 2, 1.5);
  }

  // The river: a blue ribbon winding down the valley.
  ctx.fillStyle = '#4a7fb5';
  for (let i = 0; i < rows; i++) {
    const depth = (i + 0.5) / rows;
    const yMid = (ys[i] + ys[i + 1]) / 2;
    const rx = groundCenterX(G, depth) + riverOffset(G.world, yMid, G.plane.dist);
    const w = 8 + depth * 46;
    ctx.fillRect(rx - w / 2, ys[i], w, ys[i + 1] - ys[i] + 1);
  }

  // Runway near the start of the course: a converging strip with dashes.
  if (G.plane.dist < RUNWAY_LENGTH + 500) {
    ctx.fillStyle = '#3c3f46';
    ctx.beginPath();
    const topW = 16;
    const botW = 150;
    const gcTop = groundCenterX(G, 0.12);
    const gcBot = groundCenterX(G, 1);
    ctx.moveTo(gcTop - topW, ys[1]);
    ctx.lineTo(gcTop + topW, ys[1]);
    ctx.lineTo(gcBot + botW, VIEW_H);
    ctx.lineTo(gcBot - botW, VIEW_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5d76e';
    for (let i = 2; i < rows; i += 2) {
      const depth = i / rows;
      const gc = groundCenterX(G, depth);
      const w = 3 + depth * 8;
      ctx.fillRect(gc - w / 2, ys[i], w, ys[i + 1] - ys[i]);
    }
  }
}

function drawRings(ctx, G, horizonY) {
  const p = G.plane;
  for (const ring of G.world.rings) {
    if (ring.passed || ring.missed) continue;
    const rel = ring.dist - p.dist;
    if (rel <= 0 || rel > 3400) continue;
    const persp = 1 / (0.35 + rel / 700);
    const sx = CX + (ring.lat - p.lat) * persp * 1.05;
    const sy = horizonY - (ring.alt - p.alt) * persp * 0.5 - 26 * persp;
    const rx = 108 * persp;
    const ry = rx * 0.62;
    if (rx < 4 || sx < -160 || sx > VIEW_W + 160) continue;
    ctx.save();
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 26;
    ctx.strokeStyle = '#ff9d2e';
    ctx.lineWidth = Math.max(3, 9 * persp);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.9)';
    ctx.lineWidth = Math.max(1.5, 3.5 * persp);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 220, 150, 0.9)';
    ctx.font = `bold ${Math.max(11, Math.round(15 * persp))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`RING ${ring.index + 1}`, sx, sy - ry - 10);
    ctx.restore();
  }

  // Off-screen pointer toward the next ring.
  const next = G.world.rings.find((r) => !r.passed && !r.missed && r.dist > p.dist);
  if (next && G.state === 'playing') {
    const rel = next.dist - p.dist;
    if (rel > 3400) {
      const dir = next.lat > p.lat ? 1 : -1;
      const ax = CX + dir * 430;
      ctx.save();
      ctx.fillStyle = '#ffb347';
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 6);
      ctx.beginPath();
      ctx.moveTo(ax + dir * 26, 84);
      ctx.lineTo(ax - dir * 10, 70);
      ctx.lineTo(ax - dir * 10, 98);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`NEXT RING ${Math.round(rel)}m`, ax, 122);
      ctx.restore();
    }
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Speed streaks at full throttle.
  if (G.plane.throttle > 0.92 && G.state === 'playing') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 120 + ((i * 97 + Math.floor(G.time * 900)) % 520);
      const x = i % 2 === 0 ? 26 : VIEW_W - 26;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 34);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlane(ctx, G) {
  const p = G.plane;
  const px = CX;
  const py = 478;
  const bankRad = (p.bank * Math.PI) / 180;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(bankRad * 0.9);
  const bob = Math.sin(G.time * 2.1) * 2;
  ctx.translate(0, bob);

  // Propeller blur and spinning blades (nose is up-screen, away from camera).
  ctx.save();
  ctx.translate(0, -78);
  ctx.fillStyle = 'rgba(200, 210, 225, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 48, 64, 0.75)';
  ctx.lineWidth = 3;
  const spin = G.time * (6 + p.throttle * 26);
  ctx.beginPath();
  ctx.moveTo(Math.cos(spin) * -42, Math.sin(spin) * -8);
  ctx.lineTo(Math.cos(spin) * 42, Math.sin(spin) * 8);
  ctx.moveTo(Math.cos(spin + 1.57) * -42, Math.sin(spin + 1.57) * -8);
  ctx.lineTo(Math.cos(spin + 1.57) * 42, Math.sin(spin + 1.57) * 8);
  ctx.stroke();
  ctx.restore();

  // Wings.
  ctx.fillStyle = '#e8b64c';
  roundRect(ctx, -118, -16, 236, 30, 12);
  ctx.fill();
  ctx.fillStyle = '#c98f2e';
  roundRect(ctx, -118, 6, 236, 8, 4);
  ctx.fill();

  // Tailplane.
  ctx.fillStyle = '#d9a83e';
  roundRect(ctx, -52, 44, 104, 16, 7);
  ctx.fill();

  // Fuselage: nose away (top), tail toward camera (bottom).
  const body = ctx.createLinearGradient(-13, 0, 13, 0);
  body.addColorStop(0, '#f4f6f8');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#c9d2dc');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-11, -72);
  ctx.quadraticCurveTo(-16, -20, -13, 52);
  ctx.quadraticCurveTo(-12, 62, 0, 62);
  ctx.quadraticCurveTo(12, 62, 13, 52);
  ctx.quadraticCurveTo(16, -20, 11, -72);
  ctx.quadraticCurveTo(0, -82, -11, -72);
  ctx.fill();

  // Canopy.
  ctx.fillStyle = '#7ec8e8';
  ctx.beginPath();
  ctx.ellipse(0, -44, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-2, -50, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Courier stripe and tail number.
  ctx.fillStyle = '#2e6fb0';
  ctx.fillRect(-13, 18, 26, 7);
  ctx.fillStyle = '#22303f';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKY-7', 0, 40);

  // Navigation lights, blinking.
  const blink = Math.sin(G.time * 5) > 0;
  ctx.fillStyle = blink ? '#ff4d4d' : '#7a2020';
  ctx.beginPath();
  ctx.arc(-116, -2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blink ? '#39d353' : '#14551f';
  ctx.beginPath();
  ctx.arc(116, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Boost flame.
  if (p.boost) {
    ctx.fillStyle = 'rgba(255, 150, 40, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-8, 62);
    ctx.lineTo(0, 62 + 26 + Math.random() * 14);
    ctx.lineTo(8, 62);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 28, 0.62)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHud(ctx, G, horizonY) {
  const p = G.plane;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Instruments: altitude, speed, heading.
  panel(ctx, 18, 16, 300, 74);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ALTITUDE', 32, 36);
  ctx.fillText('SPEED', 132, 36);
  ctx.fillText('HEADING', 222, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${Math.round(p.alt)} ft`, 30, 66);
  ctx.fillText(`${Math.round(p.speed)} kt`, 130, 66);
  const hdg = ((Math.round(p.heading) % 360) + 360) % 360;
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 220, 66);
  // Compass tape.
  ctx.fillStyle = '#c8d6ea';
  ctx.font = '11px sans-serif';
  const dirs = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  for (const [label, deg] of dirs) {
    let d = ((deg - hdg + 540) % 360) - 180;
    if (Math.abs(d) < 46) ctx.fillText(label, 222 + d * 1.1, 84);
  }

  // Clock and rings.
  panel(ctx, CX - 130, 16, 260, 74);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TIME LEFT', CX - 52, 36);
  ctx.fillText('RINGS', CX + 62, 36);
  ctx.fillStyle = G.timeLeft <= 10 ? '#ff6b5e' : '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`${Math.ceil(Math.max(0, G.timeLeft))}s`, CX - 52, 68);
  ctx.fillStyle = '#ffd27a';
  ctx.fillText(`${G.ringsPassed} / ${G.world.rings.length}`, CX + 62, 68);

  // Score.
  panel(ctx, VIEW_W - 218, 16, 200, 74);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', VIEW_W - 204, 36);
  ctx.fillText('BEST', VIEW_W - 104, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${G.score}`, VIEW_W - 204, 66);
  ctx.fillStyle = '#ffd27a';
  ctx.fillText(`${G.best}`, VIEW_W - 104, 66);

  // Throttle gauge, bottom left.
  panel(ctx, 18, VIEW_H - 118, 54, 100);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', 45, VIEW_H - 100);
  const barH = 62;
  const barY = VIEW_H - 92;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(38, barY, 14, barH);
  ctx.fillStyle = p.throttle > 0.85 ? '#ff9d2e' : '#39d353';
  const fillH = barH * p.throttle;
  ctx.fillRect(38, barY + barH - fillH, 14, fillH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, 45, VIEW_H - 26);

  // Artificial horizon, bottom left next to the throttle.
  const ahX = 128;
  const ahY = VIEW_H - 68;
  const ahR = 42;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ahX, ahY);
  ctx.rotate((-p.bank * Math.PI) / 180);
  ctx.translate(0, clamp(p.pitch * 1.6, -ahR, ahR));
  ctx.fillStyle = '#3f6fb5';
  ctx.fillRect(-ahR, -ahR * 2, ahR * 2, ahR * 2);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-ahR, 0, ahR * 2, ahR * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ahX - ahR, ahY);
  ctx.lineTo(ahX + ahR, ahY);
  ctx.stroke();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.moveTo(ahX - 12, ahY - 3);
  ctx.lineTo(ahX, ahY + 4);
  ctx.lineTo(ahX + 12, ahY - 3);
  ctx.closePath();
  ctx.fill();

  // Lives, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`LIVES  ${'✈ '.repeat(G.lives)}${'· '.repeat(Math.max(0, 3 - G.lives))}`, VIEW_W - 22, VIEW_H - 26);
  ctx.fillStyle = '#c8d6ea';
  ctx.font = '12px sans-serif';
  ctx.fillText('Arrows / WASD fly · Shift throttle · Space boost · P pause · R restart', VIEW_W - 22, VIEW_H - 48);

  // Warnings.
  const ground = terrainAlt(p.dist);
  if (G.state === 'playing') {
    if (p.alt - ground < 130 && p.alt - ground > 0) {
      flashText(ctx, '⚠  PULL UP — TERRAIN  ⚠', '#ff6b5e');
    } else if (p.speed < 72) {
      flashText(ctx, 'STALL — THROTTLE UP', '#ffb347');
    }
  }

  // Floating score messages.
  ctx.textAlign = 'center';
  for (const m of G.messages) {
    ctx.save();
    ctx.globalAlpha = clamp(m.life / 1.4, 0, 1);
    ctx.fillStyle = m.color;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(m.text, CX, 190 - (1.4 - m.life) * 34);
    ctx.restore();
  }
  ctx.restore();
}

function flashText(ctx, text, color) {
  if (Math.sin(performance.now() / 130) < 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(text, CX, 150);
  ctx.restore();
}

function drawOverlays(ctx, G) {
  if (G.state === 'title') {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 28, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('ALPINE RING RUN', CX, 210);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('A courier flight through the valley — thread all 10 rings before the clock runs out.', CX, 256);
    ctx.fillStyle = '#c8d6ea';
    ctx.font = '17px sans-serif';
    ctx.fillText('↑ / W climb    ↓ / S descend    ← → / A D bank & turn    Shift throttle    Space boost', CX, 330);
    ctx.fillText('Fly through the glowing rings. Mind the mountains — the valley floor is not forgiving.', CX, 358);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    const pulse = 0.65 + 0.35 * Math.sin(G.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillText('Press ENTER or click to fly', CX, 430);
    ctx.globalAlpha = 1;
    if (G.best > 0) {
      ctx.fillStyle = '#ffd27a';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Best score: ${G.best}`, CX, 470);
    }
    ctx.restore();
  } else if (G.state === 'paused') {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', CX, 330);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#c8d6ea';
    ctx.fillText('Press P to keep flying · R to restart from the runway', CX, 372);
    ctx.restore();
  } else if (G.state === 'won' || G.state === 'lost') {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    if (G.state === 'won') {
      ctx.fillStyle = '#7be495';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('COURSE COMPLETE!', CX, 280);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText(`All ${G.world.rings.length} rings threaded — the valley mail is delivered.`, CX, 326);
    } else {
      ctx.fillStyle = '#ff6b5e';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText(G.crashReason === 'time' ? 'OUT OF TIME' : 'COURIER DOWN', CX, 280);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText(
        G.crashReason === 'time'
          ? 'The clock beat you to the last ring.'
          : G.crashReason === 'stall'
            ? 'The wing stalled and the plane dropped out of the sky.'
            : 'The mountains keep what they catch.',
        CX,
        326,
      );
    }
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`Score ${G.score}   ·   Rings ${G.ringsPassed}/${G.world.rings.length}   ·   Best ${G.best}`, CX, 392);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press R to fly again', CX, 448);
    ctx.restore();
  }
}
