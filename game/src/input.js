// Keyboard and mouse input. Arrows / WASD fly the plane, Shift is a short
// boost, Enter starts, R restarts, P pauses, M mutes. Moving the mouse also
// steers: hold the pointer left or right of centre to bank, above or below
// centre to pitch.

export function makeInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, inside: false, down: false };
  const pressed = new Set(); // keys pressed since the last consume

  function codeOf(e) {
    return e.code || e.key;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(codeOf(e));
    keys.add(codeOf(e));
  });
  window.addEventListener('keyup', (e) => keys.delete(codeOf(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; // -1 left .. 1 right
    mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1; // -1 top .. 1 bottom
    mouse.inside = true;
  });
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    pressed.add('MouseClick');
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  function has(...codes) {
    return codes.some((c) => keys.has(c));
  }

  return {
    // -1..1 pitch demand (positive = pull up), -1..1 roll demand, throttle
    // keys held, plus edge-triggered actions consumed once per press.
    sample() {
      let pitch = 0;
      let roll = 0;
      if (has('ArrowUp', 'KeyW')) pitch += 1;
      if (has('ArrowDown', 'KeyS')) pitch -= 1;
      if (has('ArrowLeft', 'KeyA')) roll -= 1;
      if (has('ArrowRight', 'KeyD')) roll += 1;
      if (mouse.inside && !mouse.down) {
        // Gentle mouse steering blends with the keys.
        roll += mouse.x * 0.9;
        pitch += -mouse.y * 0.7;
      }
      let throttleUp = has('ShiftLeft', 'ShiftRight', 'Equal');
      let throttleDown = has('ControlLeft', 'Minus');
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
        throttleUp,
        throttleDown,
        boost: has('Space'),
      };
    },
    wasPressed(...codes) {
      for (const c of codes) {
        if (pressed.has(c)) {
          pressed.delete(c);
          return true;
        }
      }
      return false;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
