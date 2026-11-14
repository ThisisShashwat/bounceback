import {
  W, H, PAPER, INK, FONT_POSTER, FONT_TYPE, VENUES, STAGE_H, ENCORES, CROWD_ALPHA,
  HAND_HEAT, HYPE_SHAKE_AT, CLEAR_BONUS, FLICK_TRAIL_SPEED, FLICK_TRAIL_LINES, FLICK_TRAIL_LEN,
  FLICK_TRAIL_SPACING, FLOOR_Y, BATTLE_VENUES, BATTLE_TIME, DIVIDER_X, DIVIDER_W, LINK_VENUES, LINK_NIGHT,
  LINK_TIME, LINK_TRANSITION, LINK_FINAL, LINK_FINAL_STAMP, LINK_SPLAT_FLASH, LINK_WIN_SCALE, LINK_WIN_W,
  LINK_WIN_H, LINK_WIN_X, LINK_WIN_Y, LINK_TOMATO_TIME, LINK_TOMATO_RADIUS,
} from "./config.js";
import { strings } from "./strings.js";
import { GRID_W, LUMA_W, LUMA_H } from "./camera.js";

const TAU = Math.PI * 2;
const TILT = -0.05;
const HALO = 5;
const CELL = W / GRID_W;

const SCENES = {
  doors: drawDoors,
  attract: drawAttract,
  card: drawCard,
  show: drawShow,
  clear: drawClear,
  complete: drawComplete,
  over: drawOver,
  battleCard: drawBattleCard,
  battle: drawBattle,
  battleResult: drawBattleResult,
  linkLobby: drawLinkLobby,
  linkPlay: drawLinkPlay,
  linkResult: drawLinkResult,
};

export function render(ctx, game, motion, images) {
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  SCENES[game.scene](ctx, game, motion, images);
  if (game.debug) drawDebug(ctx, game, motion);
  if (game.sensFlash > 0) stamp(ctx, sensLabel(game), W - 90, H - 40, 26, TILT);
}


function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

function text(ctx, str, x, y, size, color, { align = "left", face = FONT_POSTER } = {}) {
  ctx.font = `${size}px ${face}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function small(ctx, str, x, y, size, align = "left") {
  text(ctx, str, x, y, size, INK, { align, face: FONT_TYPE });
}

function headline(ctx, str, x, y, size, spot, align = "center") {
  const caps = str.toUpperCase();
  text(ctx, caps, x + 4, y + 3, size, spot, { align });
  text(ctx, caps, x, y, size, INK, { align });
}

function stamp(ctx, str, x, y, size, rot, fill = PAPER) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px ${FONT_POSTER}`;
  const w = ctx.measureText(str.toUpperCase()).width + size * 0.8;
  const h = size * 1.3;
  ctx.fillStyle = fill;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  text(ctx, str.toUpperCase(), 0, 0, size, INK, { align: "center" });
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function rule(ctx, x, y, w) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, 3);
}

function strike(ctx, x1, x2, y, seed) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const steps = Math.ceil((x2 - x1) / 12);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const py = y - 5 * t + Math.sin(seed * 7.3 + i * 1.9) * 2.5;
    if (i === 0) ctx.moveTo(x1, py);
    else ctx.lineTo(x1 + (x2 - x1) * t, py);
  }
  ctx.stroke();
}

function drawContain(ctx, img, cx, cy, maxW, maxH) {
  const k = Math.min(maxW / img.width, maxH / img.height);
  ctx.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
}

function drawCover(ctx, img) {
  const k = Math.max(W / img.width, H / img.height);
  const w = img.width * k;
  const h = img.height * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawTitle(ctx, images, x, y, size, spot) {
  if (images.title) drawContain(ctx, images.title, x, y, size * 8, size * 1.3);
  else headline(ctx, strings.title, x, y, size, spot);
}


const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

function disc(x, y, cx, cy, r) {
  const d = dist(x, y, cx, cy);
  return d < r ? 0.3 + 0.7 * (1 - d / r) : 0;
}

function hash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function beam(x, y, ox) {
  const dy = y - 130;
  if (dy < 0) return 0;
  const half = 30 + dy * 0.55;
  const dx = Math.abs(x - ox);
  return dx < half ? clamp((1 - dy / 600) * (0.45 + 0.55 * (1 - dx / half)), 0, 1) : 0;
}

function lightPanel(x, y, ox) {
  return Math.abs(x - ox) < 90 && y > 90 && y < 130 ? 1 : 0;
}

const CLOUDS = [[200, 230, 80], [900, 170, 95], [560, 420, 70], [1080, 450, 75], [330, 520, 60]];
const PUFFS = [[0, 0, 1], [0.95, 0.15, 0.7], [-0.95, 0.2, 0.65]];

function cloud(x, y, cx, cy, r) {
  if (y > cy + r * 0.6) return 0;
  const inside = PUFFS.some(([dx, dy, k]) => dist(x, y, cx + dx * r, cy + dy * r) < r * k);
  return inside ? 0.35 + 0.6 * clamp((y - (cy - r)) / (r * 1.6), 0, 1) : 0;
}

const FIELDS = {
  doors: (x, y) => disc(x, y, 640, 380, 360),
  divebar: (x, y) => {
    const sign = x > 800 && x < 1200 && y > 100 && y < 300 ? 0.4 + (0.6 * (y - 100)) / 200 : 0;
    const rods = (Math.abs(x - 850) < 15 || Math.abs(x - 1150) < 15) && y < 100 ? 1 : 0;
    return Math.max(sign, rods, disc(x, y, 300, 210, 130));
  },
  stadium: (x, y) => Math.max(beam(x, y, 230), beam(x, y, 1050), lightPanel(x, y, 230), lightPanel(x, y, 1050)),
  clouds: (x, y) => Math.max(...CLOUDS.map(([cx, cy, r]) => cloud(x, y, cx, cy, r))),
  moon: (x, y) => {
    const phase = dist(x, y, 880, 260) < 190 && dist(x, y, 950, 225) > 165;
    const crescent = phase ? 0.35 + 0.65 * (1 - dist(x, y, 880, 260) / 190) : 0;
    return Math.max(crescent, y < 600 && hash(x, y) < 0.03 ? 0.3 : 0);
  },
};

function halftone(ctx, color, coverage) {
  const step = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let y = step / 2, row = 0; y < H; y += step, row++) {
    for (let x = (row % 2) * (step / 2); x < W + step; x += step) {
      const c = coverage(x, y);
      if (c <= 0.02) continue;
      const r = step * 0.62 * Math.sqrt(Math.min(c, 1));
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
}

const layers = new Map();

function cachedLayer(key, spot) {
  if (!layers.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const layerCtx = canvas.getContext("2d");
    layerCtx.fillStyle = PAPER;
    layerCtx.fillRect(0, 0, W, H);
    halftone(layerCtx, spot, FIELDS[key]);
    layers.set(key, canvas);
  }
  return layers.get(key);
}

function drawBackground(ctx, key, spot, images) {
  const img = images[`venue_${key}`];
  if (img) drawCover(ctx, img);
  else ctx.drawImage(cachedLayer(key, spot), 0, 0, W, H);
}


function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function ridgeTop(heads, x) {
  let top = H - 70;
  for (const head of heads) {
    const dx = Math.abs(x - head.x);
    if (dx < head.r) top = Math.min(top, head.y - Math.sqrt(head.r * head.r - dx * dx));
  }
  return top;
}

function buildRidge() {
  const random = seeded(11);
  const heads = [];
  for (let x = -20; x < W + 40; x += 36 + random() * 30) {
    heads.push({ x, y: H - 120 + random() * 40, r: 30 + random() * 18 });
  }
  const dots = [];
  for (let y = H - 190, row = 0; y < H; y += 12, row++) {
    for (let x = (row % 2) * 6; x < W; x += 12) {
      const top = ridgeTop(heads, x);
      if (y >= top) dots.push({ x, y, r: 6.5 * clamp(0.35 + (y - top) / 80, 0.35, 1) });
    }
  }
  return dots;
}

const RIDGE = buildRidge();

function addLumaDots(ctx, luma) {
  let sum = 0;
  for (let i = 0; i < luma.length; i++) sum += luma[i];
  const mean = sum / luma.length;
  const cw = W / LUMA_W;
  const ch = H / LUMA_H;
  for (let y = 0; y < LUMA_H; y++) {
    for (let x = 0; x < LUMA_W; x++) {
      const d = (mean - luma[y * LUMA_W + x]) / 80 + 0.04;
      if (d < 0.1) continue;
      const r = cw * 0.55 * Math.sqrt(Math.min(d, 1));
      const cx = (x + 0.5 + (y % 2) * 0.5) * cw;
      const cy = (y + 0.5) * ch;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TAU);
    }
  }
}

function addRidgeDots(ctx) {
  for (const dot of RIDGE) {
    ctx.moveTo(dot.x + dot.r, dot.y);
    ctx.arc(dot.x, dot.y, dot.r, 0, TAU);
  }
}

function drawCrowd(ctx, motion) {
  ctx.globalAlpha = CROWD_ALPHA;
  ctx.fillStyle = INK;
  ctx.beginPath();
  if (motion.luma) addLumaDots(ctx, motion.luma);
  else addRidgeDots(ctx);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHands(ctx, motion, spot) {
  const ink = new Path2D();
  const color = new Path2D();
  for (let i = 0; i < motion.heat.length; i++) {
    const heat = motion.heat[i];
    if (heat <= HAND_HEAT) continue;
    const x = ((i % GRID_W) + 0.5) * CELL;
    const y = (Math.floor(i / GRID_W) + 0.5) * CELL;
    const r = 3 + heat * 4;
    ink.moveTo(x + r + 1.8, y);
    ink.arc(x, y, r + 1.8, 0, TAU);
    color.moveTo(x + r, y);
    color.arc(x, y, r, 0, TAU);
  }
  ctx.fillStyle = INK;
  ctx.fill(ink);
  ctx.fillStyle = spot;
  ctx.fill(color);
}

function sensLabel(game) {
  return `${strings.sens} ${game.sensitivity}`;
}

function drawDebug(ctx, game, motion) {
  for (let i = 0; i < motion.heat.length; i++) {
    const heat = motion.heat[i];
    if (heat < 0.05) continue;
    ctx.globalAlpha = heat;
    ctx.fillStyle = heat > HAND_HEAT ? VENUES[0].spot : INK;
    ctx.fillRect((i % GRID_W) * CELL, Math.floor(i / GRID_W) * CELL, CELL, CELL);
  }
  ctx.globalAlpha = 1;
  small(ctx, motion.mode, 12, H - 70, 18);
  small(ctx, sensLabel(game), 12, H - 46, 18);
}


function drawStage(ctx, images) {
  if (images.stage) {
    const h = (W * images.stage.height) / images.stage.width;
    ctx.drawImage(images.stage, 0, STAGE_H - h, W, h);
    return;
  }
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, STAGE_H);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  for (let x = 20; x < W; x += 40) {
    ctx.moveTo(x + 3, STAGE_H - 8);
    ctx.arc(x, STAGE_H - 8, 3, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  [[7, 5], [19, 3.4], [31, 2]].forEach(([offset, r], row) => {
    for (let x = (row % 2) * 7; x < W; x += 14) {
      ctx.moveTo(x + r, STAGE_H + offset);
      ctx.arc(x, STAGE_H + offset, r, 0, TAU);
    }
  });
  ctx.fill();
}

function drawWind(ctx, game, venue) {
  if (!venue.wind) return;
  const k = game.wind / venue.wind;
  if (Math.abs(k) < 0.12) return;
  const span = W + 200;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.globalAlpha = Math.min(1, Math.abs(k) * 2) * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 211 + game.clock * 900 * k) % span) + span) % span) - 100;
    const y = STAGE_H + 50 + i * 62;
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.sign(k) * (70 + ((i * 37) % 60)), y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawArrow(ctx, body, spot) {
  const size = clamp(24 + (body.y + body.r) / 40, 10, 24);
  const x = clamp(body.x, 30, W - 30);
  ctx.beginPath();
  ctx.moveTo(x, 6);
  ctx.lineTo(x - size, 6 + size * 1.3);
  ctx.lineTo(x + size, 6 + size * 1.3);
  ctx.closePath();
  ctx.fillStyle = spot;
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBodyHint(ctx, body, spot) {
  if (body.y + body.r < 0) drawArrow(ctx, body, spot);
  else if (body.needMore > 0) {
    const y = Math.max(STAGE_H + 30, body.y - body.r - 34);
    stamp(ctx, strings.needMore, clamp(body.x, 130, W - 130), y, 22, TILT, spot);
  }
}

function drawTrail(ctx, body) {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= FLICK_TRAIL_SPEED) return;
  const ux = body.vx / speed;
  const uy = body.vy / speed;
  ctx.beginPath();
  for (let i = 0; i < FLICK_TRAIL_LINES; i++) {
    const side = (i - (FLICK_TRAIL_LINES - 1) / 2) * body.r * FLICK_TRAIL_SPACING;
    const start = body.r * 1.1 + (i % 2) * 14;
    const len = FLICK_TRAIL_LEN * (i % 2 ? 0.65 : 1);
    const sx = body.x - ux * start - uy * side;
    const sy = body.y - uy * start + ux * side;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - ux * len, sy - uy * len);
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
}


function bodyImage(body, images) {
  if (body.kind !== "rockstar") return images[body.kind];
  if (body.splat) return images.rockstar_splat;
  return (body.vy < 0 ? images.rockstar_bounce : null) ?? images.rockstar;
}

function drawBody(ctx, body, images, spot, rival = false) {
  ctx.save();
  ctx.translate(body.x, body.y);
  const stretch = Math.min(Math.abs(body.vy) / 3000, 0.25);
  ctx.scale((1 + 0.3 * body.squash) / (1 + stretch), (1 - 0.3 * body.squash) * (1 + stretch));
  ctx.rotate(body.angle);
  if (rival && body.kind === "rockstar") ctx.scale(-1, 1);
  const img = bodyImage(body, images);
  if (img) drawContain(ctx, img, 0, 0, body.r * 2.8, body.r * 2.8);
  else drawSilhouette(ctx, body, spot, rival);
  ctx.restore();
}

function drawSilhouette(ctx, body, spot, rival) {
  const pose = body.splat ? "splat" : body.vy < 0 ? "up" : "down";
  const shape = SHAPES[body.kind];
  const halo = rival ? spot : PAPER;
  shape(ctx, body.r, pose, { ink: halo, spot: halo, grow: HALO, halo: true });
  shape(ctx, body.r, pose, { ink: INK, spot: rival ? PAPER : spot, grow: 0, halo: false });
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function box(ctx, x, y, w, h, grow) {
  ctx.fillRect(x - grow, y - grow, w + grow * 2, h + grow * 2);
}

function label(ctx, str, x, y, size, color = PAPER) {
  text(ctx, str, x, y, size, color, { align: "center" });
}

const LIMBS = {
  up: { arms: [[-0.55, -0.95], [0.55, -0.95]], legs: [[-0.3, 0.6, -0.45, 0.95], [0.3, 0.6, 0.45, 0.95]] },
  down: { arms: [[-0.85, -0.5], [0.85, -0.3]], legs: [[-0.4, 0.55, -0.3, 0.95], [0.4, 0.5, 0.6, 0.85]] },
};

function rockstar(ctx, r, pose, c) {
  if (pose === "splat") return splatShape(ctx, r, c);
  const { arms, legs } = LIMBS[pose];
  ctx.strokeStyle = c.ink;
  ctx.fillStyle = c.ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = r * 0.17 + c.grow * 2;
  for (const [x, y] of arms) line(ctx, 0, -0.2 * r, x * r, y * r);
  for (const [kx, ky, fx, fy] of legs) {
    line(ctx, 0, 0.25 * r, kx * r, ky * r);
    line(ctx, kx * r, ky * r, fx * r, fy * r);
  }
  ctx.lineWidth = r * 0.42 + c.grow * 2;
  line(ctx, 0, -0.3 * r, 0, 0.25 * r);
  dot(ctx, 0, -0.66 * r, r * 0.3 + c.grow);
  hair(ctx, r, c.grow);
  ctx.lineWidth = r * 0.08 + c.grow * 2;
  line(ctx, -0.2 * r, 0.2 * r, 0.8 * r, -0.35 * r);
  ctx.fillStyle = c.spot;
  ctx.beginPath();
  ctx.ellipse(-0.35 * r, 0.3 * r, 0.34 * r + c.grow, 0.22 * r + c.grow, -0.6, 0, TAU);
  ctx.fill();
}

function hair(ctx, r, grow) {
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
    const k = (i % 2 ? 0.3 : 0.5) * r + grow;
    const px = Math.cos(a) * k;
    const py = -0.66 * r + Math.sin(a) * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function splatShape(ctx, r, c) {
  ctx.fillStyle = c.spot;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const k = (i % 2 ? 1 : 1.55) * r + c.grow;
    const px = Math.cos(a) * k * 1.15;
    const py = 0.78 * r + Math.sin(a) * k * 0.38;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.16 + c.grow * 2;
  const cy = 0.72 * r;
  for (const [x, y] of [[-1, -0.2], [1, -0.15], [-0.8, 0.22], [0.85, 0.22]]) line(ctx, 0, cy, x * r, cy + y * r);
  dot(ctx, 0, cy - 0.2 * r, r * 0.28 + c.grow);
}

function guitar(ctx, r, pose, c) {
  ctx.strokeStyle = c.ink;
  ctx.fillStyle = c.ink;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.15 + c.grow * 2;
  line(ctx, -0.1 * r, 0.1 * r, 0.95 * r, -0.8 * r);
  ctx.lineWidth = r * 0.28 + c.grow * 2;
  line(ctx, 0.85 * r, -0.72 * r, 1 * r, -0.88 * r);
  ctx.beginPath();
  ctx.ellipse(-0.3 * r, 0.3 * r, 0.55 * r + c.grow, 0.42 * r + c.grow, -0.71, 0, TAU);
  ctx.fill();
  if (c.halo) return;
  ctx.fillStyle = c.spot;
  ctx.beginPath();
  ctx.ellipse(-0.3 * r, 0.3 * r, 0.34 * r, 0.24 * r, -0.71, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAPER;
  dot(ctx, -0.25 * r, 0.26 * r, 0.09 * r);
}

function amp(ctx, r, pose, c) {
  ctx.fillStyle = c.ink;
  box(ctx, -0.9 * r, -0.7 * r, 1.8 * r, 1.4 * r, c.grow);
  if (c.halo) return;
  label(ctx, strings.gear.amp, 0, -0.45 * r, 0.3 * r);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0.2 * r, 0.42 * r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = c.spot;
  dot(ctx, 0, 0.2 * r, 0.14 * r);
}

function drums(ctx, r, pose, c) {
  const drumsAt = [[0, 0.22, 0.62], [-0.52, -0.38, 0.3], [0.52, -0.38, 0.3]];
  ctx.strokeStyle = c.ink;
  ctx.fillStyle = c.ink;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.08 + c.grow * 2;
  line(ctx, -0.95 * r, -0.85 * r, -0.3 * r, -0.7 * r);
  line(ctx, 0.3 * r, -0.7 * r, 0.95 * r, -0.85 * r);
  for (const [x, y, k] of drumsAt) dot(ctx, x * r, y * r, k * r + c.grow);
  if (c.halo) return;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  for (const [x, y, k] of drumsAt) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, k * r * 0.8, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = c.spot;
  dot(ctx, 0, 0.22 * r, 0.46 * r);
  label(ctx, strings.gear.drums, 0, 0.22 * r, 0.2 * r, INK);
}

function piano(ctx, r, pose, c) {
  ctx.fillStyle = c.ink;
  box(ctx, -r, -0.7 * r, 2 * r, r, c.grow);
  box(ctx, -0.88 * r, 0.3 * r, 0.14 * r, 0.5 * r, c.grow);
  box(ctx, 0.74 * r, 0.3 * r, 0.14 * r, 0.5 * r, c.grow);
  if (c.halo) return;
  ctx.fillStyle = c.spot;
  ctx.fillRect(-r, -0.12 * r, 2 * r, 0.06 * r);
  label(ctx, strings.gear.piano, 0, -0.4 * r, 0.34 * r);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-0.92 * r, 0.02 * r, 1.84 * r, 0.26 * r);
  ctx.fillStyle = INK;
  for (let i = 1; i < 10; i++) ctx.fillRect(-0.92 * r + i * 0.184 * r, 0.02 * r, 2, 0.26 * r);
  for (const i of [1, 2, 4, 5, 7, 8]) ctx.fillRect(-0.92 * r + i * 0.184 * r - 0.04 * r, 0.02 * r, 0.08 * r, 0.16 * r);
}

const SHAPES = { rockstar, guitar, amp, drums, piano };


function drawConfetti(ctx, game) {
  for (const p of game.confetti) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.7)));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
    ctx.restore();
  }
}

function drawPopups(ctx, game, spot) {
  for (const p of game.popups) {
    const k = p.t / p.life;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const x = clamp(p.x, 70, W - 70);
    const y = p.y - p.t * 60;
    if (p.stamp) stamp(ctx, p.text, x, y, 38, p.rot);
    else headline(ctx, p.text, x, y, 30, spot);
  }
  ctx.globalAlpha = 1;
}

function drawLighter(ctx, img, x, spot) {
  if (img) {
    drawContain(ctx, img, x, 37, 40, 56);
    return;
  }
  ctx.fillStyle = PAPER;
  ctx.fillRect(x - 10, 32, 20, 30);
  ctx.fillRect(x - 12, 24, 24, 7);
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.moveTo(x, 6);
  ctx.lineTo(x - 6, 22);
  ctx.lineTo(x + 6, 22);
  ctx.closePath();
  ctx.fill();
}

function drawEncores(ctx, game, images, spot) {
  for (let i = 0; i < ENCORES; i++) {
    ctx.globalAlpha = i < game.encores ? 1 : 0.28;
    drawLighter(ctx, images.lighter, W - 40 - i * 52, spot);
  }
  ctx.globalAlpha = 1;
}

function drawHype(ctx, game, venue) {
  const w = 480;
  const h = 36;
  const x = (W - w) / 2;
  const y = H - 46;
  const ratio = clamp(game.hype / venue.hype, 0, 1);
  const bx = x + 90;
  const bw = w - 104;
  ctx.save();
  if (ratio > HYPE_SHAKE_AT) ctx.translate(Math.sin(game.clock * 80) * 2.5, Math.cos(game.clock * 63) * 2);
  panel(ctx, x, y, w, h);
  text(ctx, strings.hype, x + 16, y + h / 2 + 1, 22, INK);
  ctx.fillStyle = venue.spot;
  ctx.fillRect(bx, y + 8, bw * ratio, h - 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, y + 8, bw, h - 16);
  ctx.restore();
}

function drawHud(ctx, game, images) {
  const venue = VENUES[game.venue];
  text(ctx, strings.score, 24, 18, 14, PAPER, { face: FONT_TYPE });
  text(ctx, fmt(game.score), 24, 48, 34, PAPER);
  text(ctx, strings.venues[game.venue].name, W / 2, 28, 28, PAPER, { align: "center" });
  ctx.fillStyle = venue.spot;
  ctx.fillRect(W / 2 - 90, 48, 180, 5);
  drawEncores(ctx, game, images, venue.spot);
  if (game.combo >= 3) stamp(ctx, `${strings.combo} ${game.combo}  X${game.mult}`, 150, 118, 26, TILT);
  if (game.pianoWarn) stamp(ctx, strings.pianoWarning, W / 2, 150, 52, TILT, venue.spot);
  drawHype(ctx, game, venue);
}


function drawShow(ctx, game, motion, images) {
  const venue = VENUES[game.venue];
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * game.shake, (Math.random() - 0.5) * 2 * game.shake);
  drawBackground(ctx, venue.key, venue.spot, images);
  drawCrowd(ctx, motion);
  drawHands(ctx, motion, venue.spot);
  drawWind(ctx, game, venue);
  drawStage(ctx, images);
  for (const body of game.bodies) drawTrail(ctx, body);
  for (const body of game.bodies) drawBody(ctx, body, images, venue.spot);
  for (const body of game.bodies) drawBodyHint(ctx, body, venue.spot);
  drawConfetti(ctx, game);
  drawPopups(ctx, game, venue.spot);
  ctx.restore();
  drawHud(ctx, game, images);
}

function drawClear(ctx, game, motion, images) {
  drawShow(ctx, game, motion, images);
  const spot = VENUES[game.venue].spot;
  const k = 1 + 0.7 * Math.max(0, 1 - game.t / 0.2);
  ctx.save();
  ctx.translate(W / 2, 320);
  ctx.scale(k, k);
  stamp(ctx, strings.venueClear, 0, 0, 110, TILT * 1.2, spot);
  ctx.restore();
  headline(ctx, `+${fmt(CLEAR_BONUS)}`, W / 2, 450, 56, spot);
}

function drawDoors(ctx, game, motion, images) {
  const spot = VENUES[0].spot;
  drawBackground(ctx, "doors", spot, images);
  drawCrowd(ctx, motion);
  drawTitle(ctx, images, W / 2, 250, 150, PAPER);
  stamp(ctx, strings.doorsPrompt, W / 2, 440, 56, TILT, spot);
  panel(ctx, W / 2 - 230, 520, 460, 44);
  small(ctx, strings.doorsNote, W / 2, 543, 20, "center");
}

function drawDates(ctx, x, y) {
  panel(ctx, x, y, 330, 280);
  text(ctx, strings.tourDates, x + 24, y + 34, 30, INK);
  rule(ctx, x + 24, y + 58, 282);
  VENUES.forEach((venue, i) => {
    const ry = y + 98 + i * 56;
    ctx.fillStyle = venue.spot;
    ctx.fillRect(x + 24, ry - 9, 18, 18);
    text(ctx, strings.venues[i].name, x + 54, ry, 24, INK);
    small(ctx, strings.venues[i].when, x + 306, ry, 15, "right");
  });
}

function drawBoard(ctx, game, x, y) {
  panel(ctx, x, y, 330, 280);
  text(ctx, strings.topCrowds, x + 24, y + 34, 30, INK);
  rule(ctx, x + 24, y + 58, 282);
  if (!game.scores.length) small(ctx, strings.noScores, x + 165, y + 160, 20, "center");
  game.scores.slice(0, 5).forEach((entry, i) => {
    const ry = y + 92 + i * 36;
    small(ctx, `${i + 1}`, x + 24, ry, 18);
    text(ctx, entry.name, x + 54, ry, 22, INK);
    small(ctx, fmt(entry.score), x + 306, ry, 18, "right");
  });
}

function drawStartPrompt(ctx, game, motion, spot) {
  panel(ctx, 320, 560, 640, 132);
  text(ctx, strings.waveToStart, W / 2, 592, 38, INK, { align: "center" });
  small(ctx, motion.mode === "mouse" ? strings.mouseHint : strings.spaceHint, W / 2, 670, 18, "center");
}

function drawAttract(ctx, game, motion, images) {
  const venue = VENUES[0];
  if (!motion.luma) drawBackground(ctx, venue.key, venue.spot, images);
  drawCrowd(ctx, motion);
  drawHands(ctx, motion, venue.spot);
  panel(ctx, 120, 30, 1040, 175);
  drawTitle(ctx, images, W / 2, 118, 132, venue.spot);
  drawDates(ctx, 40, 240);
  drawBoard(ctx, game, 910, 240);
  drawStartPrompt(ctx, game, motion, venue.spot);
  stamp(ctx, strings.battle.prompt, W / 2, 515, 30, TILT, venue.spot);
  if (game.link) stamp(ctx, strings.link.prompt, W / 2, 455, 30, -TILT, venue.spot);
  if (game.confirmClear > 0) stamp(ctx, strings.clearPrompt, W / 2, 380, 44, TILT, venue.spot);
}

function drawCardRow(ctx, game, i) {
  const y = 230 + i * 106;
  const name = strings.venues[i].name;
  small(ctx, strings.venues[i].when, 300, y - 36, 18);
  if (i === game.venue) {
    const k = 1 + 0.6 * Math.max(0, 1 - game.t / 0.25);
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.scale(k, k);
    stamp(ctx, name, 0, 0, 70, TILT, VENUES[i].spot);
    ctx.restore();
    return;
  }
  text(ctx, name, W / 2, y, 70, INK, { align: "center" });
  if (i < game.venue) {
    const half = ctx.measureText(name).width / 2 + 10;
    strike(ctx, W / 2 - half, W / 2 + half, y, i);
  }
}

function drawCard(ctx, game, motion, images) {
  const venue = VENUES[game.venue];
  drawBackground(ctx, venue.key, venue.spot, images);
  panel(ctx, 260, 50, 760, 620);
  text(ctx, strings.title, W / 2, 108, 44, INK, { align: "center" });
  rule(ctx, 300, 150, 680);
  for (let i = 0; i < VENUES.length; i++) drawCardRow(ctx, game, i);
}

function drawComplete(ctx, game, motion, images) {
  const venue = VENUES[VENUES.length - 1];
  drawBackground(ctx, venue.key, venue.spot, images);
  headline(ctx, strings.tourComplete, W / 2, 200, 140, venue.spot);
  panel(ctx, 340, 320, 600, 230);
  small(ctx, strings.score, W / 2, 358, 24, "center");
  headline(ctx, fmt(game.score), W / 2, 440, 100, venue.spot);
  small(ctx, strings.completeNote, W / 2, 518, 20, "center");
  drawConfetti(ctx, game);
}

function drawNameEntry(ctx, game) {
  text(ctx, strings.nameYourCrowd, W / 2, 395, 34, INK, { align: "center" });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(360, 430, 560, 80);
  const cursor = Math.floor(game.clock * 2) % 2 ? "_" : "";
  text(ctx, game.name + cursor, 384, 472, 50, INK);
  small(ctx, strings.nameHint, W / 2, 548, 18, "center");
}

function drawSaved(ctx, game, spot) {
  stamp(ctx, strings.saved, W / 2, 420, 60, TILT, spot);
  small(ctx, game.rank >= 0 ? `${strings.rankLine} ${game.rank + 1}` : strings.notRanked, W / 2, 510, 28, "center");
}

function drawOver(ctx, game, motion, images) {
  const venue = VENUES[game.venue];
  drawBackground(ctx, venue.key, venue.spot, images);
  panel(ctx, 290, 40, 700, 640);
  headline(ctx, game.completed ? strings.tourComplete : strings.gameOver, W / 2, 120, 76, venue.spot);
  small(ctx, strings.score, W / 2, 190, 20, "center");
  headline(ctx, fmt(game.score), W / 2, 248, 84, venue.spot);
  small(ctx, `${strings.reached} ${strings.venues[game.venue].name}`, W / 2, 318, 24, "center");
  rule(ctx, 330, 350, 620);
  if (game.saved) drawSaved(ctx, game, venue.spot);
  else drawNameEntry(ctx, game);
}


function battleVenue(game) {
  return VENUES[BATTLE_VENUES[game.battle.leg]];
}

function drawDivider(ctx) {
  ctx.fillStyle = INK;
  ctx.fillRect(DIVIDER_X - DIVIDER_W / 2, STAGE_H, DIVIDER_W, FLOOR_Y - STAGE_H);
}

function drawSideBodies(ctx, side, images, spot) {
  const rival = side.index === 1;
  for (const body of side.bodies) drawTrail(ctx, body);
  for (const body of side.bodies) drawBody(ctx, body, images, spot, rival);
  for (const body of side.bodies) drawBodyHint(ctx, body, spot);
}

function drawSideChip(ctx, x, spot, rival) {
  ctx.fillStyle = rival ? INK : spot;
  ctx.fillRect(x, 6, 330, 62);
  ctx.strokeStyle = rival ? spot : INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, 7.5, 327, 59);
}

function drawSideHype(ctx, side, game, venue) {
  const rival = side.index === 1;
  const w = 440;
  const h = 36;
  const x = side.index * (W / 2) + (W / 2 - w) / 2;
  const y = H - 46;
  const ratio = clamp(side.hype / venue.hype, 0, 1);
  const bx = x + 90;
  const bw = w - 104;
  ctx.save();
  if (ratio > HYPE_SHAKE_AT) ctx.translate(Math.sin(game.clock * 80) * 2.5, Math.cos(game.clock * 63) * 2);
  panel(ctx, x, y, w, h);
  text(ctx, strings.hype, x + 16, y + h / 2 + 1, 22, INK);
  ctx.fillStyle = rival ? INK : venue.spot;
  ctx.fillRect(bx, y + 8, bw * ratio, h - 16);
  ctx.strokeStyle = rival ? venue.spot : INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, y + 8, bw, h - 16);
  ctx.restore();
}

function drawSideHud(ctx, side, game, images, venue) {
  const rival = side.index === 1;
  const ox = side.index * (W / 2);
  const face = rival ? PAPER : INK;
  drawSideChip(ctx, ox + 14, venue.spot, rival);
  text(ctx, strings.score, ox + 32, 20, 14, face, { face: FONT_TYPE });
  text(ctx, fmt(side.score), ox + 32, 48, 34, face);
  for (let i = 0; i < ENCORES; i++) {
    ctx.globalAlpha = i < side.encores ? 1 : 0.28;
    drawLighter(ctx, images.lighter, ox + 220 + i * 52, rival ? venue.spot : INK);
  }
  ctx.globalAlpha = 1;
  if (side.combo >= 3) stamp(ctx, `${strings.combo} ${side.combo}  X${side.mult}`, ox + 170, 118, 24, TILT);
  drawSideHype(ctx, side, game, venue);
}

function formatClock(seconds) {
  const left = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

function drawBattleHeader(ctx, game, venue) {
  const { battle } = game;
  text(ctx, strings.venues[BATTLE_VENUES[battle.leg]].name, W / 2, 18, 20, PAPER, { align: "center" });
  text(ctx, formatClock(BATTLE_TIME - battle.t), W / 2, 44, 28, PAPER, { align: "center" });
  ctx.fillStyle = venue.spot;
  ctx.fillRect(W / 2 - 90, 64, 180, 5);
  if (battle.pianoWarn) stamp(ctx, strings.pianoWarning, W / 2, 150, 52, TILT, venue.spot);
}

function drawBattle(ctx, game, motion, images) {
  const venue = battleVenue(game);
  const shake = Math.max(...game.sides.map((side) => side.shake));
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
  drawBackground(ctx, venue.key, venue.spot, images);
  drawCrowd(ctx, motion);
  drawHands(ctx, motion, venue.spot);
  drawStage(ctx, images);
  drawDivider(ctx);
  for (const side of game.sides) drawSideBodies(ctx, side, images, venue.spot);
  for (const side of game.sides) {
    drawConfetti(ctx, side);
    drawPopups(ctx, side, venue.spot);
  }
  ctx.restore();
  for (const side of game.sides) drawSideHud(ctx, side, game, images, venue);
  drawBattleHeader(ctx, game, venue);
}

function popStamp(ctx, str, y, t, rot, fill) {
  const k = 1 + 0.6 * Math.max(0, 1 - t / 0.25);
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(k, k);
  stamp(ctx, str, 0, 0, 70, rot, fill);
  ctx.restore();
}

function drawBattleCard(ctx, game, motion, images) {
  const venue = VENUES[BATTLE_VENUES[0]];
  drawBackground(ctx, venue.key, venue.spot, images);
  panel(ctx, 260, 50, 760, 620);
  text(ctx, strings.battle.title, W / 2, 108, 44, INK, { align: "center" });
  rule(ctx, 300, 150, 680);
  popStamp(ctx, strings.battle.left, 270, game.t, TILT, venue.spot);
  text(ctx, strings.battle.versus, W / 2, 380, 56, INK, { align: "center" });
  popStamp(ctx, strings.battle.right, 490, game.t, -TILT, PAPER);
  small(ctx, strings.battle.cardNote, W / 2, 590, 22, "center");
}

function winnerLabel(winner) {
  if (winner < 0) return strings.battle.draw;
  return winner === 0 ? strings.battle.leftWins : strings.battle.rightWins;
}

function drawResultScore(ctx, side, name, x, spot) {
  small(ctx, name, x, 330, 22, "center");
  headline(ctx, fmt(side.score), x, 400, 72, spot);
  if (side.encores <= 0) small(ctx, strings.battle.knockedOut, x, 460, 20, "center");
}

function drawBattleResult(ctx, game, motion, images) {
  drawBattle(ctx, game, motion, images);
  const venue = battleVenue(game);
  const label = winnerLabel(game.battle.winner);
  panel(ctx, 200, 130, 880, 420);
  stamp(ctx, label, W / 2 + 4, 223, 84, TILT * 1.2, venue.spot);
  stamp(ctx, label, W / 2, 220, 84, TILT * 1.2);
  ctx.fillStyle = INK;
  ctx.fillRect(W / 2 - 2, 310, 4, 170);
  drawResultScore(ctx, game.sides[0], strings.battle.left, W / 2 - 220, venue.spot);
  drawResultScore(ctx, game.sides[1], strings.battle.right, W / 2 + 220, venue.spot);
}


function drawMiniLighter(ctx, x, y, spot, lit) {
  ctx.globalAlpha = lit ? 1 : 0.28;
  ctx.fillStyle = INK;
  ctx.fillRect(x - 6, y - 2, 12, 16);
  ctx.fillRect(x - 7, y - 7, 14, 4);
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x - 4, y - 9);
  ctx.lineTo(x + 4, y - 9);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}


function drawRivalWorld(ctx, rival, bodies, images) {
  const venue = VENUES[rival.venue];
  ctx.save();
  ctx.beginPath();
  ctx.rect(LINK_WIN_X, LINK_WIN_Y, LINK_WIN_W, LINK_WIN_H);
  ctx.clip();
  ctx.translate(LINK_WIN_X, LINK_WIN_Y);
  ctx.scale(LINK_WIN_SCALE, LINK_WIN_SCALE);
  ctx.drawImage(cachedLayer(venue.key, venue.spot), 0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, STAGE_H);
  for (const body of bodies) drawBody(ctx, body, images, venue.spot);
  ctx.restore();
}

function drawRivalHype(ctx, hype, spot) {
  const h = 14;
  const y = LINK_WIN_Y + LINK_WIN_H - h;
  ctx.fillStyle = PAPER;
  ctx.fillRect(LINK_WIN_X, y, LINK_WIN_W, h);
  ctx.fillStyle = spot;
  ctx.fillRect(LINK_WIN_X, y, LINK_WIN_W * clamp(hype, 0, 1), h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(LINK_WIN_X + 1.5, y + 1.5, LINK_WIN_W - 3, h - 3);
}

function drawRivalChips(ctx, rival, spot) {
  const score = fmt(rival.score);
  ctx.font = `34px ${FONT_POSTER}`;
  panel(ctx, LINK_WIN_X, LINK_WIN_Y, ctx.measureText(score).width + 24, 46);
  text(ctx, score, LINK_WIN_X + 12, LINK_WIN_Y + 25, 34, INK);
  const x = LINK_WIN_X + LINK_WIN_W - 96;
  panel(ctx, x, LINK_WIN_Y, 96, 46);
  for (let i = 0; i < ENCORES; i++) drawMiniLighter(ctx, x + 20 + i * 28, LINK_WIN_Y + 32, spot, i < rival.encores);
}

function drawRivalOverlay(ctx, match, spot) {
  const cx = LINK_WIN_X + LINK_WIN_W / 2;
  const cy = LINK_WIN_Y + LINK_WIN_H / 2;
  if (!match.signal) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = PAPER;
    ctx.fillRect(LINK_WIN_X, LINK_WIN_Y, LINK_WIN_W, LINK_WIN_H);
    ctx.globalAlpha = 1;
    stamp(ctx, strings.link.noSignal, cx, cy, 52, TILT, spot);
    return;
  }
  if (match.splatFlash <= 0) return;
  const k = 1 + 0.4 * Math.max(0, 1 - (LINK_SPLAT_FLASH - match.splatFlash) / 0.2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  stamp(ctx, strings.link.rivalSplat, 0, 0, 46, TILT, spot);
  ctx.restore();
}

function drawRivalTab(ctx) {
  ctx.font = `20px ${FONT_POSTER}`;
  panel(ctx, LINK_WIN_X - 3, LINK_WIN_Y - 32, ctx.measureText(strings.link.rival).width + 30, 32);
  text(ctx, strings.link.rival, LINK_WIN_X + 12, LINK_WIN_Y - 15, 20, INK);
}

function drawRivalWindow(ctx, match, images) {
  const { rival } = match;
  const spot = VENUES[rival.venue].spot;
  drawRivalWorld(ctx, rival, match.rivalBodies, images);
  drawRivalHype(ctx, rival.hype, spot);
  drawRivalChips(ctx, rival, spot);
  drawRivalOverlay(ctx, match, spot);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(LINK_WIN_X - 1.5, LINK_WIN_Y - 1.5, LINK_WIN_W + 3, LINK_WIN_H + 3);
  drawRivalTab(ctx);
}

function drawTomato(ctx, splat) {
  const age = splat.t / LINK_TOMATO_TIME;
  const slap = 1 + 0.35 * Math.max(0, 1 - splat.t / 0.12);
  const radius = LINK_TOMATO_RADIUS;
  const rnd = (i) => hash(splat.seed * 7.31, i * 1.7 + 0.3);
  ctx.save();
  ctx.globalAlpha = age < 0.35 ? 1 : 1 - (age - 0.35) / 0.65;
  ctx.translate(splat.x, splat.y);
  ctx.scale(slap, slap);
  ctx.fillStyle = splat.color;
  ctx.strokeStyle = splat.color;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arc(0, 0, radius, 0, TAU);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rnd(i) * 0.5;
    const d = radius * (0.75 + 0.35 * rnd(i + 20));
    const r = radius * (0.38 + 0.25 * rnd(i + 40));
    ctx.moveTo(Math.cos(a) * d + r, Math.sin(a) * d);
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU);
  }
  for (let ring = 0; ring < 3; ring++) {
    const count = 40 - ring * 8;
    for (let i = 0; i < count; i++) {
      const seed = 100 + ring * 50 + i;
      if (rnd(seed) < 0.3) continue;
      const a = (i / count) * TAU + rnd(seed + 200) * 0.1;
      const d = radius * (1.7 + ring * 0.2) * (0.92 + 0.16 * rnd(seed + 400));
      const r = 10 - ring * 3;
      ctx.moveTo(Math.cos(a) * d + r, Math.sin(a) * d);
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU);
    }
  }
  ctx.fill();
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const x = (rnd(80 + i) - 0.5) * radius * 1.5;
    ctx.lineWidth = 22 + 22 * rnd(90 + i);
    ctx.beginPath();
    ctx.moveTo(x, radius * 0.4);
    ctx.lineTo(x, radius * (0.4 + 0.5 + 0.7 * rnd(70 + i)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawIncoming(ctx, match, spot) {
  const bob = Math.abs(Math.sin(match.t * 14)) * 8;
  for (const drop of match.incoming) {
    const y = drop.y + bob;
    ctx.beginPath();
    ctx.moveTo(drop.x, y + 28);
    ctx.lineTo(drop.x - 26, y - 8);
    ctx.lineTo(drop.x + 26, y - 8);
    ctx.closePath();
    ctx.fillStyle = spot;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawNightSlam(ctx, match) {
  const night = Math.floor(match.t / LINK_NIGHT);
  const age = match.t - night * LINK_NIGHT;
  if (night < 1 || night >= LINK_VENUES.length || age >= LINK_TRANSITION) return;
  const before = strings.venues[LINK_VENUES[night - 1]].name;
  const name = strings.venues[LINK_VENUES[night]].name;
  const shake = Math.max(0, 1 - age / 0.4) * 8;
  const k = 1 + 1.2 * Math.max(0, 1 - age / 0.16);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (LINK_TRANSITION - age) / 0.2);
  ctx.translate(W / 2 + Math.sin(age * 90) * shake, 400 + Math.cos(age * 70) * shake);
  stamp(ctx, before, 0, -130, 54, 0);
  const half = ctx.measureText(before).width / 2 + 10;
  strike(ctx, -half, -half + half * 2 * clamp(age / 0.3, 0, 1), -130, night);
  ctx.scale(k, k);
  stamp(ctx, name, 5, 4, 96, TILT * 1.2, VENUES[LINK_VENUES[night]].spot);
  stamp(ctx, name, 0, 0, 96, TILT * 1.2);
  ctx.restore();
}

function drawFinalStamp(ctx, match, spot) {
  const age = match.t - (LINK_TIME - LINK_FINAL);
  if (age < 0 || age >= LINK_FINAL_STAMP) return;
  const k = 1 + 1.2 * Math.max(0, 1 - age / 0.16);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (LINK_FINAL_STAMP - age) / 0.25);
  ctx.translate(W / 2, 400);
  ctx.scale(k, k);
  stamp(ctx, strings.link.final, 5, 4, 100, TILT * 1.2, spot);
  stamp(ctx, strings.link.final, 0, 0, 100, TILT * 1.2);
  ctx.restore();
}

function drawFinalCount(ctx, left, spot) {
  const count = Math.max(0, Math.ceil(left));
  const k = 1 + 0.4 * Math.max(0, 1 - (count - left) / 0.2);
  ctx.save();
  ctx.translate(W / 2, 138);
  ctx.scale(k, k);
  stamp(ctx, String(count), 0, 0, 84, TILT, left <= 3 ? spot : PAPER);
  ctx.restore();
}

function drawLinkHeader(ctx, match, spot, live) {
  const left = LINK_TIME - match.t;
  text(ctx, strings.venues[match.side.venue].name, W / 2, 18, 20, PAPER, { align: "center" });
  ctx.fillStyle = spot;
  ctx.fillRect(W / 2 - 90, 64, 180, 5);
  if (live && left <= LINK_FINAL) drawFinalCount(ctx, left, spot);
  else text(ctx, formatClock(left), W / 2, 44, 28, PAPER, { align: "center" });
}

function drawLinkHud(ctx, game, images, venue, live) {
  const { match } = game;
  const { side } = match;
  text(ctx, strings.score, 24, 18, 14, PAPER, { face: FONT_TYPE });
  text(ctx, fmt(side.score), 24, 48, 34, PAPER);
  for (let i = 0; i < ENCORES; i++) {
    ctx.globalAlpha = i < side.encores ? 1 : 0.28;
    drawLighter(ctx, images.lighter, 270 + i * 50, venue.spot);
  }
  ctx.globalAlpha = 1;
  if (side.combo >= 3) stamp(ctx, `${strings.combo} ${side.combo}  X${side.mult}`, 150, 118, 26, TILT);
  drawLinkHeader(ctx, match, venue.spot, live);
  drawHype(ctx, { hype: side.hype, clock: game.clock }, venue);
  if (!live) return;
  if (match.pianoWarn) stamp(ctx, strings.pianoWarning, W / 2, 250, 52, TILT, venue.spot);
  drawFinalStamp(ctx, match, venue.spot);
  drawNightSlam(ctx, match);
  drawRivalWindow(ctx, match, images);
}

function drawLinkPlay(ctx, game, motion, images, live = true) {
  const { match } = game;
  const { side } = match;
  const venue = VENUES[side.venue];
  ctx.save();
  if (side.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * side.shake, (Math.random() - 0.5) * 2 * side.shake);
  drawBackground(ctx, venue.key, venue.spot, images);
  drawCrowd(ctx, motion);
  drawHands(ctx, motion, venue.spot);
  drawStage(ctx, images);
  for (const body of side.bodies) drawTrail(ctx, body);
  for (const body of side.bodies) drawBody(ctx, body, images, venue.spot);
  drawIncoming(ctx, match, venue.spot);
  for (const splat of match.splats) drawTomato(ctx, splat);
  drawConfetti(ctx, side);
  drawPopups(ctx, side, venue.spot);
  ctx.restore();
  drawLinkHud(ctx, game, images, venue, live);
  for (const body of side.bodies) drawBodyHint(ctx, body, venue.spot);
}

function drawCountdown(ctx, match, spot) {
  const k = 1 + 0.5 * Math.max(0, 1 - match.countAge / 0.25);
  ctx.save();
  ctx.translate(W / 2, 420);
  ctx.scale(k, k);
  headline(ctx, String(match.count), 0, 0, 260, spot);
  ctx.restore();
}

function drawLinkLobby(ctx, game, motion, images) {
  const { match, link } = game;
  const venue = VENUES[BATTLE_VENUES[0]];
  drawBackground(ctx, venue.key, venue.spot, images);
  drawCrowd(ctx, motion);
  drawHands(ctx, motion, venue.spot);
  panel(ctx, 260, 120, 760, 480);
  text(ctx, strings.link.title, W / 2, 180, 44, INK, { align: "center" });
  rule(ctx, 300, 222, 680);
  if (match.count) return drawCountdown(ctx, match, venue.spot);
  drawReadyLine(ctx, match.ready ? strings.link.status.youReady : strings.link.status.youNotReady, 290, match.ready, venue.spot);
  const rival = {
    ready: strings.link.status.rivalReady, notReady: strings.link.status.rivalNotReady, offline: strings.link.status.rivalOffline,
  }[match.rivalStatus];
  drawReadyLine(ctx, rival, 350, match.rivalStatus === "ready", venue.spot);
  stamp(ctx, strings.link.readyPrompt, W / 2, 440, 36, TILT, venue.spot);
  small(ctx, link.connected ? strings.link.connected : strings.link.noSignal, W / 2, 508, 22, "center");
  small(ctx, strings.link.leaveHint, W / 2, 560, 18, "center");
}

function drawReadyLine(ctx, str, y, ready, spot) {
  if (ready) headline(ctx, str, W / 2, y, 42, spot);
  else text(ctx, str, W / 2, y, 42, INK, { align: "center" });
}

function drawLinkResult(ctx, game, motion, images) {
  drawLinkPlay(ctx, game, motion, images, false);
  const { match } = game;
  const venue = VENUES[match.side.venue];
  const label = strings.link.outcomes[match.outcome];
  panel(ctx, 200, 130, 880, 420);
  stamp(ctx, label, W / 2 + 4, 223, 84, TILT * 1.2, venue.spot);
  stamp(ctx, label, W / 2, 220, 84, TILT * 1.2);
  ctx.fillStyle = INK;
  ctx.fillRect(W / 2 - 2, 310, 4, 170);
  drawResultScore(ctx, match.side, strings.link.you, W / 2 - 220, venue.spot);
  drawResultScore(ctx, match.rival, strings.link.rival, W / 2 + 220, venue.spot);
  if (match.rivalRematch) stamp(ctx, strings.link.rivalRematch, W / 2, 512, 30, -TILT, venue.spot);
  stamp(ctx, strings.link.rematchPrompt, W / 2, 604, 34, TILT, venue.spot);
}
