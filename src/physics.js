import {
  W, H, FLOOR_Y, BODIES, NEED_PER_MASS, SENS_NEED_MULT, SENSE_SCALE, BOUNCE_MIN_VY, BOUNCE_H_MIN, BOUNCE_H_MAX,
  POWER_RANGE, PUSH, MAX_VX, WALL_BOUNCE, AIR_DRAG, BOUNCE_COOLDOWN, SPIN_MAX, SQUASH_DECAY,
  HEAVY_MASS, ASSIST_DRAG, NEED_MORE_TIME, SPAWN_GRACE, FLICK_SCALE, FLICK_MIN_SPEED,
  FLICK_FULL_SPEED, FLICK_POWER, FLICK_MIN_UP, MAX_FLICK_VX, FLICK_COOLDOWN, DIVIDER_X, DIVIDER_W,
} from "./config.js";
import { sampleHeat, sampleFlow } from "./camera.js";

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function createBody(kind, x, y, vx, vy) {
  const { mass, r } = BODIES[kind];
  return {
    kind, mass, r, x, y, vx, vy,
    angle: 0, spin: (Math.random() - 0.5) * SPIN_MAX,
    cooldown: SPAWN_GRACE, squash: 0, needMore: 0,
    splat: false, timer: 0, gone: false,
  };
}

export function stepBody(body, dt, gravity, wind) {
  body.cooldown = Math.max(0, body.cooldown - dt);
  body.squash = Math.max(0, body.squash - SQUASH_DECAY * dt);
  body.needMore = Math.max(0, body.needMore - dt);
  body.vx += (wind / body.mass) * dt - body.vx * AIR_DRAG * dt;
  body.vy += gravity * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.angle += body.spin * dt;
  bounceOffWalls(body);
  return landed(body);
}

function bounceOffWalls(body) {
  if (body.x < body.r) {
    body.x = body.r;
    body.vx = Math.abs(body.vx) * WALL_BOUNCE;
  } else if (body.x > W - body.r) {
    body.x = W - body.r;
    body.vx = -Math.abs(body.vx) * WALL_BOUNCE;
  }
}

export function bounceOffDivider(body, side) {
  if (side === 0) {
    const limit = DIVIDER_X - DIVIDER_W / 2 - body.r;
    if (body.x <= limit) return;
    body.x = limit;
    body.vx = -Math.abs(body.vx) * WALL_BOUNCE;
  } else {
    const limit = DIVIDER_X + DIVIDER_W / 2 + body.r;
    if (body.x >= limit) return;
    body.x = limit;
    body.vx = Math.abs(body.vx) * WALL_BOUNCE;
  }
}

function landed(body) {
  if (body.vy <= 0 || body.y + body.r < FLOOR_Y) return false;
  body.y = FLOOR_Y - body.r;
  return true;
}

export function crowdBounce(body, motion, gravity, dt) {
  if (body.cooldown > 0 || body.vy < BOUNCE_MIN_VY) return null;
  const need = NEED_PER_MASS * SENS_NEED_MULT[motion.sensitivity - 1] * body.mass;
  const heat = sampleHeat(motion, body.x, body.y, body.r * SENSE_SCALE);
  if (heat.cells >= need) return launch(body, heat, need, gravity, motion);
  if (heat.cells > 0 && body.mass >= HEAVY_MASS) hesitate(body, dt);
  return null;
}

function launch(body, heat, need, gravity, motion) {
  const power = clamp((heat.cells - need) / (need * POWER_RANGE), 0, 1);
  const height = H * (BOUNCE_H_MIN + (BOUNCE_H_MAX - BOUNCE_H_MIN) * power);
  body.vy = -Math.sqrt(2 * gravity * height);
  body.vx = clamp(body.vx + (body.x - heat.cx) * PUSH, -MAX_VX, MAX_VX);
  body.spin = ((Math.random() - 0.5) * 2 * SPIN_MAX) / Math.sqrt(body.mass);
  body.cooldown = BOUNCE_COOLDOWN;
  body.squash = 1;
  return { cells: heat.cells, power, flick: flick(body, motion) };
}

function flick(body, motion) {
  const flow = sampleFlow(motion, body.x, body.y, body.r * FLICK_SCALE);
  const k = clamp((flow.speed - FLICK_MIN_SPEED) / (FLICK_FULL_SPEED - FLICK_MIN_SPEED), 0, 1);
  if (k <= 0) return 0;
  const push = (FLICK_POWER * k) / Math.sqrt(body.mass);
  body.vx = clamp(body.vx + flow.dx * push, -MAX_FLICK_VX, MAX_FLICK_VX);
  body.vy = Math.min(body.vy + flow.dy * push, -FLICK_MIN_UP);
  body.cooldown = FLICK_COOLDOWN;
  return k;
}

function hesitate(body, dt) {
  if (body.vy > 0) body.vy -= body.vy * ASSIST_DRAG * dt;
  body.needMore = NEED_MORE_TIME;
}
