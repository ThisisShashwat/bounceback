import {
  FLOW_FRESH, FLOW_OLD_MIN, FLOW_MIN_AGE, HAND_HEAT, SENS_DEFAULT, SENS_NOISE_MULT,
} from "./config.js";

export const GRID_W = 64, GRID_H = 36;
export const LUMA_W = 96, LUMA_H = 54;
export const NOISE = 12;
export const SCALE = 36;

const CELL_SIZE = 20;
const DECAY_HALF_LIFE = 0.12;

export function createMotion() {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = GRID_W;
  gridCanvas.height = GRID_H;
  const gridCtx = gridCanvas.getContext('2d', { willReadFrequently: true });

  const lumaCanvas = document.createElement('canvas');
  lumaCanvas.width = LUMA_W;
  lumaCanvas.height = LUMA_H;
  const lumaCtx = lumaCanvas.getContext('2d', { willReadFrequently: true });

  return {
    mode: 'off',
    sensitivity: SENS_DEFAULT,
    heat: new Float32Array(GRID_W * GRID_H),
    luma: null,
    video,
    stream: null,
    gridCanvas,
    gridCtx,
    lumaCanvas,
    lumaCtx,
    prevLuma: new Uint8Array(GRID_W * GRID_H),
    hasPrev: false
  };
}

export async function startCamera(motion) {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMouseMode(motion, true);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    motion.stream = stream;
    motion.video.srcObject = stream;
    await motion.video.play();
    motion.mode = 'camera';
    motion.luma = new Uint8Array(LUMA_W * LUMA_H);
    motion.hasPrev = false;

    const tracks = stream.getVideoTracks();
    if (tracks && tracks.length > 0) {
      tracks[0].onended = () => {
        setMouseMode(motion, true);
      };
    }

    motion.video.onerror = () => {
      setMouseMode(motion, true);
    };
  } catch (e) {
    setMouseMode(motion, true);
  }
}

export function setMouseMode(motion, on) {
  if (on) {
    motion.mode = 'mouse';
    motion.luma = null;
    motion.hasPrev = false;
  } else {
    const isCameraActive = Boolean(
      motion.stream &&
      motion.stream.active &&
      motion.video &&
      motion.video.readyState >= 2
    );
    if (isCameraActive) {
      motion.mode = 'camera';
      if (!motion.luma) {
        motion.luma = new Uint8Array(LUMA_W * LUMA_H);
      }
    } else {
      motion.mode = 'off';
      motion.luma = null;
    }
    motion.hasPrev = false;
  }
}

export function updateMotion(motion, dt) {
  const decay = dt > 0 ? Math.exp(-Math.LN2 * (dt / DECAY_HALF_LIFE)) : 1;

  if (motion.mode !== 'camera') {
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      motion.heat[i] *= decay;
    }
    motion.hasPrev = false;
    motion.luma = null;
    return;
  }

  const isVideoReady = Boolean(
    motion.video &&
    motion.video.readyState >= 2 &&
    motion.video.videoWidth > 0
  );

  if (!isVideoReady) {
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      motion.heat[i] *= decay;
    }
    return;
  }

  motion.gridCtx.save();
  motion.gridCtx.scale(-1, 1);
  motion.gridCtx.drawImage(motion.video, -GRID_W, 0, GRID_W, GRID_H);
  motion.gridCtx.restore();

  const frame = motion.gridCtx.getImageData(0, 0, GRID_W, GRID_H).data;
  const currLuma = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const p = i * 4;
    currLuma[i] = (frame[p] * 299 + frame[p + 1] * 587 + frame[p + 2] * 114) / 1000;
  }

  if (motion.hasPrev) {
    const rawMotion = new Float32Array(GRID_W * GRID_H);
    let movedCount = 0;
    const noise = NOISE * SENS_NOISE_MULT[motion.sensitivity - 1];

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const diff = Math.abs(currLuma[i] - motion.prevLuma[i]);
      const m = Math.min(1, Math.max(0, (diff - noise) / SCALE));
      rawMotion[i] = m;
      if (m > 0) {
        movedCount++;
      }
    }

    if (movedCount > (GRID_W * GRID_H * 0.55)) {
      rawMotion.fill(0);
    } else {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const idx = y * GRID_W + x;
          if (rawMotion[idx] <= 0) continue;

          let hasActiveNeighbour = false;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= GRID_H) continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              if (nx < 0 || nx >= GRID_W) continue;
              const nIdx = ny * GRID_W + nx;
              if (motion.heat[nIdx] > 0.3 || rawMotion[nIdx] > 0.3) {
                hasActiveNeighbour = true;
                break;
              }
            }
            if (hasActiveNeighbour) break;
          }

          if (!hasActiveNeighbour) {
            rawMotion[idx] = 0;
          }
        }
      }
    }

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const decayed = motion.heat[i] * decay;
      motion.heat[i] = Math.min(1, Math.max(decayed, rawMotion[i]));
    }
  } else {
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      motion.heat[i] *= decay;
    }
    motion.hasPrev = true;
  }

  motion.prevLuma.set(currLuma);

  motion.lumaCtx.save();
  motion.lumaCtx.scale(-1, 1);
  motion.lumaCtx.drawImage(motion.video, -LUMA_W, 0, LUMA_W, LUMA_H);
  motion.lumaCtx.restore();

  const lumaFrame = motion.lumaCtx.getImageData(0, 0, LUMA_W, LUMA_H).data;
  if (!motion.luma) {
    motion.luma = new Uint8Array(LUMA_W * LUMA_H);
  }
  for (let i = 0; i < LUMA_W * LUMA_H; i++) {
    const p = i * 4;
    motion.luma[i] = (lumaFrame[p] * 299 + lumaFrame[p + 1] * 587 + lumaFrame[p + 2] * 114) / 1000;
  }
}

export function attachMouse(motion, canvas, toLogical) {
  let lastX = null;
  let lastY = null;

  function paintCircle(logicalX, logicalY, speed) {
    const gcx = logicalX / CELL_SIZE;
    const gcy = logicalY / CELL_SIZE;
    const minGx = Math.max(0, Math.floor(gcx - 3));
    const maxGx = Math.min(GRID_W - 1, Math.ceil(gcx + 3));
    const minGy = Math.max(0, Math.floor(gcy - 3));
    const maxGy = Math.min(GRID_H - 1, Math.ceil(gcy + 3));

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const dist = Math.hypot(gx + 0.5 - gcx, gy + 0.5 - gcy);
        if (dist <= 3) {
          const falloff = 1 - (dist / 3.5);
          const heatVal = speed * falloff;
          const idx = gy * GRID_W + gx;
          if (heatVal > motion.heat[idx]) {
            motion.heat[idx] = Math.min(1, heatVal);
          }
        }
      }
    }
  }

  function onPointerMove(e) {
    const pt = toLogical(e.clientX, e.clientY);
    if (!pt) return;

    if (motion.mode !== 'mouse') {
      lastX = pt.x;
      lastY = pt.y;
      return;
    }

    if (lastX === null || lastY === null) {
      lastX = pt.x;
      lastY = pt.y;
      return;
    }

    const dx = pt.x - lastX;
    const dy = pt.y - lastY;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const speed = Math.min(1, dist / 25);
      const steps = Math.max(1, Math.ceil(dist / 10));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        paintCircle(lastX + dx * t, lastY + dy * t, speed);
      }
    }

    lastX = pt.x;
    lastY = pt.y;
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => {
    lastX = null;
    lastY = null;
  });
}

export function sampleHeat(motion, x, y, r) {
  const minGx = Math.max(0, Math.floor((x - r) / CELL_SIZE));
  const maxGx = Math.min(GRID_W - 1, Math.ceil((x + r) / CELL_SIZE));
  const minGy = Math.max(0, Math.floor((y - r) / CELL_SIZE));
  const maxGy = Math.min(GRID_H - 1, Math.ceil((y + r) / CELL_SIZE));
  const r2 = r * r;

  let cells = 0;
  let strength = 0;
  let sumX = 0;
  let sumY = 0;

  for (let gy = minGy; gy <= maxGy; gy++) {
    const cyPos = (gy + 0.5) * CELL_SIZE;
    const dy = cyPos - y;
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cxPos = (gx + 0.5) * CELL_SIZE;
      const dx = cxPos - x;
      if (dx * dx + dy * dy <= r2) {
        const h = motion.heat[gy * GRID_W + gx];
        if (h > HAND_HEAT) {
          cells++;
        }
        strength += h;
        sumX += cxPos * h;
        sumY += cyPos * h;
      }
    }
  }

  let cx = x;
  let cy = y;
  if (strength > 0) {
    cx = sumX / strength;
    cy = sumY / strength;
  }

  return { cells, strength, cx, cy };
}

function addToGroup(group, h, px, py) {
  group.n++;
  group.h += h;
  group.x += px * h;
  group.y += py * h;
}

function flowBetween(fresh, old) {
  const vx = fresh.x / fresh.h - old.x / old.h;
  const vy = fresh.y / fresh.h - old.y / old.h;
  const dist = Math.hypot(vx, vy);
  if (dist === 0) return { dx: 0, dy: 0, speed: 0 };
  const ratio = (old.h / old.n) / (fresh.h / fresh.n);
  const gap = Math.max(FLOW_MIN_AGE, (Math.log(ratio) / Math.log(0.5)) * DECAY_HALF_LIFE);
  return { dx: vx / dist, dy: vy / dist, speed: dist / gap };
}

export function sampleFlow(motion, x, y, r) {
  const minGx = Math.max(0, Math.floor((x - r) / CELL_SIZE));
  const maxGx = Math.min(GRID_W - 1, Math.ceil((x + r) / CELL_SIZE));
  const minGy = Math.max(0, Math.floor((y - r) / CELL_SIZE));
  const maxGy = Math.min(GRID_H - 1, Math.ceil((y + r) / CELL_SIZE));
  const r2 = r * r;
  const fresh = { n: 0, h: 0, x: 0, y: 0 };
  const old = { n: 0, h: 0, x: 0, y: 0 };

  for (let gy = minGy; gy <= maxGy; gy++) {
    const cyPos = (gy + 0.5) * CELL_SIZE;
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cxPos = (gx + 0.5) * CELL_SIZE;
      if ((cxPos - x) ** 2 + (cyPos - y) ** 2 > r2) continue;
      const h = motion.heat[gy * GRID_W + gx];
      if (h >= FLOW_FRESH) addToGroup(fresh, h, cxPos, cyPos);
      else if (h >= FLOW_OLD_MIN) addToGroup(old, h, cxPos, cyPos);
    }
  }

  if (fresh.n < 2 || old.n < 2) return { dx: 0, dy: 0, speed: 0 };
  return flowBetween(fresh, old);
}

export function totalHeat(motion) {
  let sum = 0;
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    sum += motion.heat[i];
  }
  return sum;
}
