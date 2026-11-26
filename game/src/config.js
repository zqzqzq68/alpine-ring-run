// Alpine Ring Run — shared tuning constants.
// A short courier flight through an alpine valley: fly through 10 glowing
// rings before the clock runs out, without clipping the terrain.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const SEED = 20261126;

export const RING_COUNT = 10;
export const RING_GAP = 1500; // track units between consecutive rings
export const TIME_LIMIT = 90; // seconds on the clock
export const LIVES = 3;

export const MIN_SPEED = 55; // knots, below this the wing stops flying
export const MAX_SPEED = 215; // knots at full throttle
export const MAX_PITCH = 24; // degrees, nose up
export const MIN_PITCH = -16; // degrees, nose down
export const MAX_BANK = 48; // degrees of roll

export const GROUND_CLEARANCE = 10; // feet above the terrain before a crash
export const RING_LAT_TOL = 78; // feet of lateral error allowed through a ring
export const RING_ALT_TOL = 95; // feet of vertical error allowed through a ring
export const RING_SCORE = 100;
export const TIME_BONUS_PER_SECOND = 5; // bonus points per second left on a win

export const RUNWAY_LENGTH = 2600; // track units of paved runway at the start
