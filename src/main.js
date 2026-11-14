import { W, H, PAPER, MANIFEST, MUSIC_VOLUME } from "./config.js";
import { createMotion, startCamera, updateMotion, attachMouse, setMouseMode } from "./camera.js";
import { loadImages } from "./images.js";
import { unlockAudio, loadSounds, playLoop } from "./audio.js";
import { createGame, update, handleKey, isTyping, enterAttract } from "./game.js";
import { render } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const motion = createMotion();
const game = createGame();
let images = {};
let last = 0;

function fit() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * ratio);
  canvas.height = Math.round(H * scale * ratio);
}

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
}

function enterFullscreen() {
  document.documentElement.requestFullscreen().catch(() => {});
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else enterFullscreen();
}

function openDoors() {
  if (game.scene !== "doors") return;
  unlockAudio();
  startCamera(motion);
  enterFullscreen();
  playLoop("music", MUSIC_VOLUME);
  enterAttract(game);
}

function onKeyDown(e) {
  if (e.key === " " || e.key === "Backspace") e.preventDefault();
  if (game.scene === "doors") {
    if (e.key === " " || e.key === "Enter") openDoors();
    return;
  }
  const key = e.key.toLowerCase();
  if (!isTyping(game) && key === "f") toggleFullscreen();
  else if (!isTyping(game) && key === "m") setMouseMode(motion, motion.mode !== "mouse");
  else handleKey(game, e);
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateMotion(motion, dt);
  update(game, motion, dt);
  render(ctx, game, motion, images);
  requestAnimationFrame(frame);
}

async function boot() {
  fit();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  window.addEventListener("resize", fit);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("click", openDoors);
  attachMouse(motion, canvas, toLogical);
  const fonts = Promise.allSettled([
    document.fonts.load('40px "Poster"'),
    document.fonts.load('20px "Type"'),
  ]);
  const [loaded] = await Promise.all([loadImages(MANIFEST.images), fonts, loadSounds(MANIFEST.sounds)]);
  images = loaded;
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
}

boot();
