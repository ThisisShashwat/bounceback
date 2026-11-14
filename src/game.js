import {
  W, H, INK, STAGE_H, FLOOR_Y, BODIES, VENUES, ENCORES, RESPAWN_DELAY, CARD_TIME, CLEAR_TIME,
  COMPLETE_TIME, OVER_IDLE, SAVED_HOLD, NAME_MAX, CONFIRM_CLEAR_TIME,
  BOUNCE_POINTS, COMBO_STEP, COMBO_MULT_MAX, CLEAR_BONUS, HYPE_MIN,
  HYPE_MAX, DRAIN_DELAY, GEAR_FIRST_DELAY, GEAR_RAMP, GEAR_RETRY, PIANO_WARNING, HEAVY_MASS,
  HIT_STOP_CELLS, HIT_STOP_TIME, SHAKE_SPLAT, SHAKE_SMASH, SHAKE_DECAY, CONFETTI_MAX, CONFETTI_BASE,
  CONFETTI_PER_POWER, CONFETTI_GRAVITY, CONFETTI_DRAG, RAIN_RATE, SPAWN_VY, FLICK_LABEL_AT,
  FLICK_BURST_BONUS, SENS_MIN, SENS_MAX, SENS_DEFAULT, SENS_FLASH_TIME, SENS_STORAGE_KEY,
  BATTLE_VENUES, BATTLE_TIME, BATTLE_LEG, BATTLE_MAX_BODIES, BATTLE_GEAR_EVERY, BATTLE_PIANO_AT,
  BATTLE_CARD_TIME, BATTLE_RESULT_TIME, LINK_SILENT_MS, LINK_GIVE_UP_MS, LINK_COUNTDOWN,
  LINK_STALE_START, LINK_SPLAT_FLASH, LINK_VENUES, LINK_NIGHT,
  LINK_TIME, LINK_MAX_BODIES, LINK_GEAR_EVERY, LINK_FIRST_GEAR, LINK_PIANO_AT, LINK_FINAL,
  LINK_FINAL_GEAR_SCALE, LINK_WIN_X, LINK_WIN_Y, LINK_WIN_H, LINK_RIVAL_SMOOTH, LINK_STATE_BODIES,
  LINK_EVENTS_KEPT, JUNK_SEND_POINTS, LINK_SEND_FLICK, LINK_SEND_Y, LINK_JUNK_WARN, LINK_JUNK_VY,
  LINK_JUNK_ABOVE, LINK_JUNK_MAX_VX, LINK_TOMATO_EVERY, LINK_TOMATO_X, LINK_TOMATO_Y, LINK_TOMATO_TIME,
  LINK_TOMATO_MAX, LINK_TOMATO_SHAKE,
} from "./config.js";
import { strings } from "./strings.js";
import { createBody, stepBody, crowdBounce, bounceOffDivider, clamp } from "./physics.js";
import { play, setMusicLevel } from "./audio.js";
import { loadScores, saveScore, clearScores } from "./storage.js";
import { relayFromUrl, createLink, pollLink, leaveLink, localStartTime, rivalSilence } from "./link.js";

const TAU = Math.PI * 2;
const KINDS = Object.keys(BODIES);

const UPDATERS = {
  attract: updateAttract,
  card: updateCard,
  show: updateShow,
  clear: updateClear,
  complete: updateComplete,
  over: updateOver,
  battleCard: updateBattleCard,
  battle: updateBattle,
  battleResult: updateBattleResult,
  linkLobby: updateLinkLobby,
  linkPlay: updateLinkPlay,
  linkResult: updateLinkResult,
};

export function createGame() {
  const relay = relayFromUrl();
  return {
    scene: "doors", t: 0, clock: 0, debug: false, mode: "solo", sides: [], battle: null,
    link: relay ? createLink(relay) : null, match: null,
    venue: 0, score: 0, combo: 0, mult: 1, hype: 0, encores: ENCORES, completed: false,
    bodies: [], confetti: [], popups: [],
    shake: 0, hitStop: 0, wind: 0,
    gearTimer: 0, nextGear: null, pianoWarn: false, pianosDone: 0, sinceBounce: 0,
    sensitivity: loadSensitivity(), sensFlash: 0,
    startMeter: 0, scores: [], confirmClear: 0,
    name: "", saved: false, rank: -1, idle: 0,
  };
}

export function update(game, motion, dt) {
  motion.sensitivity = game.sensitivity;
  game.t += dt;
  game.clock += dt;
  game.sensFlash = Math.max(0, game.sensFlash - dt);
  game.shake = Math.max(0, game.shake - SHAKE_DECAY * dt);
  game.confirmClear = Math.max(0, game.confirmClear - dt);
  updateParticles(game, dt);
  if (game.mode === "battle") for (const side of game.sides) updateParticles(side, dt);
  if (game.mode === "link") updateParticles(game.match.side, dt);
  UPDATERS[game.scene]?.(game, motion, dt);
}

export function isTyping(game) {
  return game.scene === "over" && !game.saved;
}

export function handleKey(game, e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTyping(game)) return typeName(game, e);
  const key = e.key.toLowerCase();
  if (key === "d") game.debug = !game.debug;
  else if (key === "n" && game.scene === "show") game.hype = VENUES[game.venue].hype;
  else if (key === "[" || key === "]") stepSensitivity(game, key === "]" ? 1 : -1);
  else if (game.scene === "attract") attractKey(game, e);
  else if (game.scene === "linkLobby") lobbyKey(game, e);
  else if (game.scene === "linkResult") resultKey(game, e);
  else if (game.scene === "battleResult" && e.key === " " && !e.repeat) enterAttract(game);
}

function loadSensitivity() {
  try {
    const value = Math.round(Number(localStorage.getItem(SENS_STORAGE_KEY)));
    return value >= SENS_MIN && value <= SENS_MAX ? value : SENS_DEFAULT;
  } catch {
    return SENS_DEFAULT;
  }
}

function stepSensitivity(game, direction) {
  const next = clamp(game.sensitivity + direction, SENS_MIN, SENS_MAX);
  if (next === game.sensitivity) return;
  game.sensitivity = next;
  game.sensFlash = SENS_FLASH_TIME;
  try {
    localStorage.setItem(SENS_STORAGE_KEY, String(next));
  } catch {
  }
}

export function enterAttract(game) {
  game.scores = loadScores();
  game.startMeter = 0;
  game.confirmClear = 0;
  game.bodies = [];
  if (game.mode === "link") leaveLink(game.link);
  game.mode = "solo";
  game.sides = [];
  game.battle = null;
  game.match = null;
  setMusicLevel(0);
  setScene(game, "attract");
}

function setScene(game, scene) {
  game.scene = scene;
  game.t = 0;
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}


function startRun(game) {
  Object.assign(game, {
    venue: 0, score: 0, combo: 0, mult: 1, encores: ENCORES, completed: false,
    hype: 0, bodies: [], confetti: [], popups: [], confirmClear: 0,
  });
  play("riff");
  startCard(game);
}

function startCard(game) {
  play(`venue_${VENUES[game.venue].key}`);
  setMusicLevel(game.venue);
  setScene(game, "card");
}

function startVenue(game) {
  game.hype = 0;
  game.pianoWarn = false;
  game.pianosDone = 0;
  game.sinceBounce = 0;
  game.bodies = [spawnBody("rockstar")];
  scheduleGear(game, VENUES[game.venue], GEAR_FIRST_DELAY);
  setScene(game, "show");
}

function startOver(game) {
  Object.assign(game, { name: "", saved: false, rank: -1, idle: 0, bodies: [] });
  setScene(game, "over");
}

function clearVenue(game) {
  game.score += CLEAR_BONUS;
  game.pianoWarn = false;
  game.bodies = [];
  for (let i = 0; i < 6; i++) burst(game, rand(W * 0.1, W * 0.9), rand(H * 0.5, H * 0.8), 1, 30);
  play("cheer");
  setScene(game, "clear");
}

function finishClear(game) {
  if (game.venue + 1 < VENUES.length) {
    game.venue++;
    startCard(game);
    return;
  }
  game.completed = true;
  play("tour_complete");
  setScene(game, "complete");
}


function updateAttract(game, motion, dt) {
}

function updateCard(game) {
  if (game.t >= CARD_TIME) startVenue(game);
}

function updateClear(game, motion, dt) {
  rain(game, dt);
  if (game.t >= CLEAR_TIME) finishClear(game);
}

function updateComplete(game, motion, dt) {
  rain(game, dt);
  if (game.t >= COMPLETE_TIME) startOver(game);
}

function updateOver(game, motion, dt) {
  game.idle += dt;
  if (game.idle >= (game.saved ? SAVED_HOLD : OVER_IDLE)) enterAttract(game);
}

function updateShow(game, motion, dt) {
  if (game.hitStop > 0) {
    game.hitStop -= dt;
    return;
  }
  const venue = VENUES[game.venue];
  const windy = game.hype / venue.hype >= venue.windFrom;
  game.wind = windy ? venue.wind * Math.sin(game.t * 0.9) * Math.sin(game.t * 0.37 + 1) : 0;
  for (const body of game.bodies) updateBody(game, body, motion, venue, dt);
  game.bodies = game.bodies.filter((body) => !body.gone);
  drainHype(game, venue, dt);
  if (game.hype >= venue.hype) return clearVenue(game);
  updateGear(game, venue, dt);
  updateRockstar(game);
}

function updateBody(game, body, motion, venue, dt) {
  if (body.splat) {
    body.timer += dt;
    return;
  }
  const hit = crowdBounce(body, motion, venue.gravity, dt);
  if (hit) onBounce(game, body, hit);
  if (stepBody(body, dt, venue.gravity, game.wind)) onFloor(game, body);
}

function updateRockstar(game) {
  const star = game.bodies.find((body) => body.kind === "rockstar");
  if (star && !(star.splat && star.timer >= RESPAWN_DELAY)) return;
  game.bodies = game.bodies.filter((body) => body !== star);
  if (game.encores > 0) game.bodies.push(spawnBody("rockstar"));
  else startOver(game);
}


function spawnBody(kind) {
  const { r } = BODIES[kind];
  const x = rand(r + 120, W - r - 120);
  const vx = (x < W / 2 ? 1 : -1) * rand(80, 200);
  return createBody(kind, x, STAGE_H - 10, vx, SPAWN_VY);
}

function liveBodies(game) {
  return game.bodies.filter((body) => !body.splat).length;
}

function scheduleGear(game, venue, delay) {
  game.nextGear = pick(venue.gear);
  game.gearTimer = delay;
}

function drainHype(game, venue, dt) {
  game.sinceBounce += dt;
  if (game.sinceBounce > DRAIN_DELAY) game.hype = Math.max(0, game.hype - venue.drain * dt);
}

function queuePiano(game, venue, ratio) {
  const at = venue.pianoAt[game.pianosDone];
  if (at === undefined || ratio < at || game.nextGear === "piano") return;
  game.pianosDone++;
  game.nextGear = "piano";
  game.gearTimer = Math.min(game.gearTimer, PIANO_WARNING);
}

function gearSpeed(game, ratio) {
  if (game.nextGear === "piano") return 1;
  return 1 / (1 - GEAR_RAMP * clamp(ratio, 0, 1));
}

function updateGear(game, venue, dt) {
  const ratio = game.hype / venue.hype;
  queuePiano(game, venue, ratio);
  if (ratio < venue.gearFrom) return;
  game.gearTimer -= dt * gearSpeed(game, ratio);
  const warn = game.nextGear === "piano" && game.gearTimer <= PIANO_WARNING;
  if (warn && !game.pianoWarn) play("piano_warning");
  game.pianoWarn = warn;
  if (game.gearTimer > 0) return;
  if (liveBodies(game) >= venue.maxBodies) {
    game.gearTimer = GEAR_RETRY;
    return;
  }
  game.bodies.push(spawnBody(game.nextGear));
  scheduleGear(game, venue, rand(...venue.gearEvery));
}


function onBounce(game, body, hit) {
  game.sinceBounce = 0;
  game.combo++;
  game.mult = Math.min(COMBO_MULT_MAX, 1 + Math.floor(game.combo / COMBO_STEP));
  const weight = Math.sqrt(body.mass);
  const points = Math.round(BOUNCE_POINTS * (1 + hit.power) * weight) * game.mult;
  game.score += points;
  body.flicked = hit.flick;
  game.hype += (HYPE_MIN + (HYPE_MAX - HYPE_MIN) * hit.power) * weight;
  const yeet = hit.flick >= FLICK_LABEL_AT;
  if (hit.cells >= HIT_STOP_CELLS || yeet) game.hitStop = HIT_STOP_TIME;
  burst(game, body.x, body.y + body.r * 0.5, hit.power + (yeet ? FLICK_BURST_BONUS : 0));
  addPopup(game, `+${points}`, body.x, body.y - body.r - 10, false);
  if (yeet) addPopup(game, strings.yeet, body.x, body.y - body.r - 70, true);
  const heavy = body.mass >= HEAVY_MASS;
  play(heavy ? "big_boing" : "boing", {
    volume: 0.6 + 0.4 * hit.power,
    rate: heavy ? Math.max(0.6, 1 - 0.08 * (body.mass - 1)) : 0.95 + 0.3 * hit.power,
  });
}

function onFloor(game, body) {
  game.combo = 0;
  game.mult = 1;
  if (body.kind === "rockstar") splat(game, body);
  else smash(game, body);
}

function splat(game, body) {
  Object.assign(body, { splat: true, timer: 0, vx: 0, vy: 0, spin: 0, angle: 0, squash: 0 });
  game.encores--;
  game.shake = SHAKE_SPLAT;
  burst(game, body.x, FLOOR_Y, 0.6);
  addPopup(game, strings.splat, body.x, FLOOR_Y - 150, true);
  play("splat");
  play("boo");
}

function smash(game, body) {
  body.gone = true;
  game.hype = Math.max(0, game.hype - VENUES[game.venue].smashLoss);
  game.shake = SHAKE_SMASH;
  burst(game, body.x, FLOOR_Y, 0.8);
  addPopup(game, strings.smash, body.x, FLOOR_Y - 150, true);
  play("smash");
}


function burst(game, x, y, power, count = CONFETTI_BASE + Math.round(power * CONFETTI_PER_POWER)) {
  const spot = VENUES[game.venue].spot;
  for (let i = 0; i < count && game.confetti.length < CONFETTI_MAX; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = rand(200, 700) * (0.6 + 0.6 * power);
    game.confetti.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rot: Math.random() * TAU, vr: rand(-7, 7), size: rand(6, 14),
      life: rand(0.9, 1.6), color: Math.random() < 0.5 ? INK : spot,
    });
  }
}

function rain(game, dt) {
  if (Math.random() >= RAIN_RATE * dt || game.confetti.length >= CONFETTI_MAX) return;
  game.confetti.push({
    x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(100, 250),
    rot: Math.random() * TAU, vr: rand(-6, 6), size: rand(6, 14),
    life: 6, color: Math.random() < 0.5 ? INK : VENUES[game.venue].spot,
  });
}

function addPopup(game, text, x, y, stamp) {
  game.popups.push({ text, x, y, t: 0, life: stamp ? 1.1 : 0.8, stamp, rot: -rand(0.03, 0.07) });
}

function updateParticles(game, dt) {
  for (const p of game.confetti) {
    p.vy += CONFETTI_GRAVITY * dt;
    p.vx -= p.vx * CONFETTI_DRAG * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
  }
  game.confetti = game.confetti.filter((p) => p.life > 0 && p.y < H + 20);
  for (const p of game.popups) p.t += dt;
  game.popups = game.popups.filter((p) => p.t < p.life);
}


function attractKey(game, e) {
  if (e.key === "2" && !e.repeat) return startBattle(game);
  if (e.key === "3" && !e.repeat && game.link) return startLink(game);
  if ((e.key === " " || e.key === "1") && !e.repeat) return startRun(game);
  if (game.confirmClear > 0) {
    if (e.key.toLowerCase() === "y") {
      clearScores();
      game.scores = loadScores();
    }
    game.confirmClear = 0;
  } else if (e.key === "Backspace" && e.shiftKey) {
    game.confirmClear = CONFIRM_CLEAR_TIME;
  }
}

function typeName(game, e) {
  game.idle = 0;
  if (e.key === "Enter") return saveRun(game);
  if (e.key === "Escape") return enterAttract(game);
  if (e.key === "Backspace") game.name = game.name.slice(0, -1);
  else if (/^[a-z0-9 ]$/i.test(e.key) && game.name.length < NAME_MAX) game.name += e.key.toUpperCase();
}

function saveRun(game) {
  game.rank = saveScore({
    name: game.name.trim() || strings.anonymous,
    score: game.score,
    venue: strings.venues[game.venue].name,
    date: new Date().toISOString().slice(0, 10),
  });
  game.saved = true;
  game.idle = 0;
}


function createSide(index) {
  return {
    index, venue: BATTLE_VENUES[0], wind: 0,
    score: 0, combo: 0, mult: 1, hype: 0, encores: ENCORES, sinceBounce: 0,
    bodies: [], confetti: [], popups: [], shake: 0, hitStop: 0,
  };
}

function startBattle(game) {
  Object.assign(game, {
    mode: "battle", sides: [createSide(0), createSide(1)], confirmClear: 0,
    battle: { t: 0, leg: 0, gearTimer: 0, nextGear: null, pianoDone: false, pianoWarn: false, winner: -1 },
  });
  play("riff");
  play(`venue_${VENUES[BATTLE_VENUES[0]].key}`);
  setMusicLevel(0);
  setScene(game, "battleCard");
}

function updateBattleCard(game) {
  if (game.t < BATTLE_CARD_TIME) return;
  spawnPair(game, "rockstar");
  scheduleBattleGear(game.battle, GEAR_FIRST_DELAY);
  setScene(game, "battle");
}

function updateBattleResult(game) {
  if (game.t >= BATTLE_RESULT_TIME) enterAttract(game);
}

function updateBattle(game, motion, dt) {
  const { battle, sides } = game;
  battle.t += dt;
  advanceLeg(battle, sides);
  for (const side of sides) updateSide(side, motion, dt);
  updateBattleGear(game, dt);
  if (battle.t >= BATTLE_TIME || sides.some((side) => side.encores <= 0)) endBattle(game);
}

function advanceLeg(battle, sides) {
  const leg = Math.min(BATTLE_VENUES.length - 1, Math.floor(battle.t / BATTLE_LEG));
  if (leg === battle.leg) return;
  battle.leg = leg;
  for (const side of sides) side.venue = BATTLE_VENUES[leg];
  play(`venue_${VENUES[BATTLE_VENUES[leg]].key}`);
  setMusicLevel(leg);
  scheduleBattleGear(battle, nextGearDelay(battle));
}

function updateSide(side, motion, dt) {
  side.shake = Math.max(0, side.shake - SHAKE_DECAY * dt);
  if (side.hitStop > 0) {
    side.hitStop -= dt;
    return;
  }
  const venue = VENUES[side.venue];
  for (const body of side.bodies) {
    updateBody(side, body, motion, venue, dt);
    bounceOffDivider(body, side.index);
  }
  side.bodies = side.bodies.filter((body) => !body.gone);
  drainHype(side, venue, dt);
  side.hype = Math.min(side.hype, venue.hype);
  updateSideRockstar(side);
}

function updateSideRockstar(side, spawn = () => spawnSideBody("rockstar", side.index, sideVx())) {
  const star = side.bodies.find((body) => body.kind === "rockstar");
  if (star && !(star.splat && star.timer >= RESPAWN_DELAY)) return;
  side.bodies = side.bodies.filter((body) => body !== star);
  if (side.encores > 0) side.bodies.push(spawn());
}

function spawnSideBody(kind, index, vx) {
  return createBody(kind, W / 4 + (index * W) / 2, STAGE_H - 10, vx, SPAWN_VY);
}

function sideVx() {
  return rand(80, 200) * (Math.random() < 0.5 ? 1 : -1);
}

function spawnPair(game, kind) {
  const vx = sideVx();
  const [left, right] = game.sides.map((side) => spawnSideBody(kind, side.index, side.index ? -vx : vx));
  right.spin = -left.spin;
  game.sides[0].bodies.push(left);
  game.sides[1].bodies.push(right);
}

function scheduleBattleGear(battle, delay) {
  battle.nextGear = pick(VENUES[BATTLE_VENUES[battle.leg]].gear);
  battle.gearTimer = delay;
}

function nextGearDelay(battle) {
  return rand(...BATTLE_GEAR_EVERY[battle.leg]);
}

function queueBattlePiano(battle) {
  const last = BATTLE_VENUES.length - 1;
  if (battle.pianoDone || battle.leg !== last || battle.t - BATTLE_LEG * last < BATTLE_PIANO_AT) return;
  battle.pianoDone = true;
  battle.nextGear = "piano";
  battle.gearTimer = Math.min(battle.gearTimer, PIANO_WARNING);
}

function updateBattleGear(game, dt) {
  const { battle, sides } = game;
  queueBattlePiano(battle);
  battle.gearTimer -= dt;
  const warn = battle.nextGear === "piano" && battle.gearTimer <= PIANO_WARNING;
  if (warn && !battle.pianoWarn) play("piano_warning");
  battle.pianoWarn = warn;
  if (battle.gearTimer > 0) return;
  if (sides.some((side) => side.bodies.length >= BATTLE_MAX_BODIES[battle.leg])) {
    battle.gearTimer = GEAR_RETRY;
    return;
  }
  spawnPair(game, battle.nextGear);
  scheduleBattleGear(battle, nextGearDelay(battle));
}

function judge([a, b]) {
  if ((a.encores <= 0) !== (b.encores <= 0)) return a.encores <= 0 ? 1 : 0;
  const diff = a.score - b.score || a.encores - b.encores;
  return diff > 0 ? 0 : diff < 0 ? 1 : -1;
}

function endBattle(game) {
  game.battle.winner = judge(game.sides);
  game.battle.pianoWarn = false;
  for (const side of game.sides) side.bodies = side.bodies.filter((body) => body.splat);
  if (game.battle.winner >= 0) play("cheer");
  play(game.battle.winner >= 0 ? "win" : "draw");
  setScene(game, "battleResult");
}


function createMatch(ready = false) {
  return {
    ready, rivalStatus: "offline", rivalRematch: false,
    side: createSide(0), rival: createRival(), signal: true, t: 0, leg: 0, schedule: [], next: 0,
    localStart: 0, pianoWarn: false, finalSeen: false, splatFlash: 0, count: 0, countAge: 0, outcome: "", locked: false,
    outbox: [], sentN: 0, seen: 0, comboSeen: 0, incoming: [], splats: [], rivalBodies: [], sample: null,
  };
}

function createRival() {
  return { phase: "lobby", score: 0, encores: ENCORES, hype: 0, venue: LINK_VENUES[0] };
}

function startLink(game) {
  Object.assign(game, { mode: "link", match: createMatch(), confirmClear: 0 });
  setMusicLevel(0);
  setScene(game, "linkLobby");
}

function ownState(match, phase) {
  const { side, t } = match;
  const hype = clamp(side.hype / VENUES[side.venue].hype, 0, 1);
  return {
    phase, score: side.score, encores: side.encores, hype: Math.round(hype * 100) / 100, t: Math.round(t * 10) / 10,
    venue: side.venue, bodies: packBodies(side.bodies), events: match.outbox,
  };
}

function packBodies(bodies) {
  return bodies.slice(0, LINK_STATE_BODIES).map((body) => [
    KINDS.indexOf(body.kind), Math.round(body.x), Math.round(body.y), Math.round(body.angle * 100),
  ]);
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), s | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, [lo, hi]) {
  return lo + random() * (hi - lo);
}

function gearScale(at) {
  return at >= LINK_TIME - LINK_FINAL ? LINK_FINAL_GEAR_SCALE : 1;
}

function legEvents(random, leg) {
  const start = leg * LINK_NIGHT;
  const gear = VENUES[LINK_VENUES[leg]].gear;
  const every = LINK_GEAR_EVERY[leg];
  const events = [];
  for (let at = leg ? start + between(random, every) : LINK_FIRST_GEAR; at < start + LINK_NIGHT; at += between(random, every) * gearScale(at)) {
    events.push({ at, leg, kind: gear[Math.floor(random() * gear.length)] });
  }
  return events;
}

function buildGearSchedule(seed) {
  const random = seededRandom(seed);
  const last = LINK_VENUES.length - 1;
  const events = LINK_VENUES.flatMap((_, leg) => legEvents(random, leg));
  events.push({ at: LINK_NIGHT * last + LINK_PIANO_AT + PIANO_WARNING, leg: last, kind: "piano" });
  return events.sort((a, b) => a.at - b.at);
}

function secondsToStart(link) {
  const start = localStartTime(link);
  if (start === null) return Infinity;
  const left = (start - performance.now()) / 1000;
  return left < -LINK_STALE_START ? Infinity : left;
}

function rivalStatus(link) {
  if (!link.rival || rivalSilence(link) >= LINK_SILENT_MS) return "offline";
  return link.rival.ready ? "ready" : "notReady";
}

function lobbyKey(game, e) {
  if (e.key === "Escape") return enterAttract(game);
  if (e.key !== " " || e.repeat || secondsToStart(game.link) !== Infinity) return;
  game.match.ready = !game.match.ready;
}

function resultKey(game, e) {
  if (e.key === "Escape") return enterAttract(game);
  if (e.key === " " && !e.repeat) rematch(game);
}

function rematch(game) {
  Object.assign(game.link, { startAt: null, accepted: game.link.seq });
  game.match = createMatch(true);
  setMusicLevel(0);
  setScene(game, "linkLobby");
}

function updateLinkLobby(game) {
  const { link, match } = game;
  pollLink(link, ownState(match, "lobby"), match.ready);
  match.rivalStatus = rivalStatus(link);
  const left = secondsToStart(link);
  if (left <= 0) return beginMatch(game);
  const shown = match.count;
  match.count = left <= LINK_COUNTDOWN ? Math.ceil(left) : 0;
  if (match.count && match.count !== shown) play("tick");
  match.countAge = match.count ? 1 - (left - (match.count - 1)) : 0;
}

function beginMatch(game) {
  const { link, match } = game;
  Object.assign(match, { localStart: localStartTime(link), schedule: buildGearSchedule(link.startAt), count: 0 });
  match.side.bodies.push(spawnBody("rockstar"));
  play("riff");
  play("go");
  play(`venue_${VENUES[LINK_VENUES[0]].key}`);
  setMusicLevel(0);
  setScene(game, "linkPlay");
}

function updateLinkPlay(game, motion, dt) {
  const { link, match } = game;
  match.t = (performance.now() - match.localStart) / 1000;
  pollLink(link, ownState(match, "play"), true);
  readRival(match, link, dt);
  takeSample(match, link.rival?.state);
  smoothRivalBodies(match, dt);
  if (rivalSilence(link) >= LINK_GIVE_UP_MS) return endMatch(game, "none");
  updateLinkSide(match, motion, dt);
  advanceLinkLeg(match);
  checkFinal(match);
  updateLinkGear(match);
  updateIncoming(match);
  checkHeckle(match);
  updateSplats(match, dt);
  const rivalDone = match.rival.phase === "over" || match.rival.encores <= 0;
  if (match.t >= LINK_TIME || match.side.encores <= 0 || rivalDone) endMatch(game, judgeMatch(match));
}

function rivalVenue(venue) {
  return Number.isInteger(venue) && venue >= 0 && venue < VENUES.length ? venue : LINK_VENUES[0];
}

function readRival(match, link, dt) {
  const state = link.rival?.state;
  if (state && state.phase !== "lobby") {
    const next = {
      phase: state.phase, score: state.score, encores: state.encores, hype: state.hype, venue: rivalVenue(state.venue),
    };
    if (next.encores < match.rival.encores) match.splatFlash = LINK_SPLAT_FLASH;
    match.rival = next;
  }
  match.splatFlash = Math.max(0, match.splatFlash - dt);
  match.signal = rivalSilence(link) < LINK_SILENT_MS;
}

function takeSample(match, state) {
  if (!state || state === match.sample) return;
  match.sample = state;
  retargetRivalBodies(match, state.bodies);
  if (state.phase === "play") handleEvents(match, state.events);
}

function unpackBody(entry) {
  if (!Array.isArray(entry) || !KINDS[entry[0]]) return null;
  return { kind: KINDS[entry[0]], tx: Number(entry[1]) || 0, ty: Number(entry[2]) || 0, ta: (Number(entry[3]) || 0) / 100 };
}

function takeNearest(free, sample) {
  let best = -1;
  let bestDist = Infinity;
  free.forEach((body, i) => {
    const dist = body.kind === sample.kind ? Math.hypot(body.tx - sample.tx, body.ty - sample.ty) : Infinity;
    if (dist < bestDist) [best, bestDist] = [i, dist];
  });
  return best < 0 ? null : free.splice(best, 1)[0];
}

function follow(body, { kind, tx, ty, ta }) {
  if (!body) return { kind, r: BODIES[kind].r, x: tx, y: ty, angle: ta, vy: 0, squash: 0, splat: false, tx, ty, ta };
  Object.assign(body, { vy: ty - body.ty, tx, ty, ta });
  return body;
}

function retargetRivalBodies(match, packed) {
  const free = [...match.rivalBodies];
  const samples = Array.isArray(packed) ? packed.slice(0, LINK_STATE_BODIES).map(unpackBody).filter(Boolean) : [];
  match.rivalBodies = samples.map((sample) => follow(takeNearest(free, sample), sample));
}

function smoothRivalBodies(match, dt) {
  const k = Math.min(1, dt / LINK_RIVAL_SMOOTH);
  for (const body of match.rivalBodies) {
    body.x += (body.tx - body.x) * k;
    body.y += (body.ty - body.y) * k;
    body.angle += (body.ta - body.angle) * k;
  }
}

function handleEvents(match, events) {
  if (!Array.isArray(events)) return;
  for (const event of events) {
    if (!(event?.n > match.seen)) continue;
    match.seen = event.n;
    if (event.type === "junk") receiveJunk(match, event);
    else if (event.type === "tomato") receiveTomato(match, event);
  }
}

function pushEvent(match, event) {
  match.outbox.push({ n: ++match.sentN, ...event });
  if (match.outbox.length > LINK_EVENTS_KEPT) match.outbox.shift();
}

function topY(x) {
  return x > LINK_WIN_X - 90 ? LINK_WIN_Y + LINK_WIN_H + 100 : STAGE_H + 50;
}

function settledBodies(side) {
  return side.bodies.filter((body) => !body.arriving).length;
}

function leavesTop(body) {
  return body.kind !== "rockstar" && body.flicked >= LINK_SEND_FLICK && body.y < LINK_SEND_Y && body.vy < 0;
}

function sendJunk(match, body) {
  const { side } = match;
  body.gone = true;
  side.score += JUNK_SEND_POINTS;
  pushEvent(match, { type: "junk", kind: body.kind, x: Math.round(body.x), vx: Math.round(body.vx) });
  addPopup(side, strings.link.sent, body.x, topY(body.x), true);
  addPopup(side, `+${JUNK_SEND_POINTS}`, body.x, topY(body.x) + 52, false);
  burst(side, body.x, 20, 0.6);
  play("whoosh");
  play("big_boing", { rate: 1.3 });
}

function receiveJunk(match, event) {
  if (!KINDS.includes(event.kind) || event.kind === "rockstar") return;
  const { r } = BODIES[event.kind];
  const x = clamp(W - (Number(event.x) || 0), r, W - r);
  const vx = clamp(-(Number(event.vx) || 0), -LINK_JUNK_MAX_VX, LINK_JUNK_MAX_VX);
  const y = topY(x);
  match.incoming.push({ kind: event.kind, x, vx, y, at: match.t + LINK_JUNK_WARN });
  addPopup(match.side, strings.link.incoming, x, y + 70, true);
  play("incoming");
}

function dropJunk({ kind, x, vx }) {
  const body = createBody(kind, x, -BODIES[kind].r - LINK_JUNK_ABOVE, vx, LINK_JUNK_VY);
  body.arriving = true;
  return body;
}

function updateIncoming(match) {
  const due = match.incoming.filter((drop) => match.t >= drop.at);
  if (!due.length) return;
  match.incoming = match.incoming.filter((drop) => match.t < drop.at);
  for (const drop of due) match.side.bodies.push(dropJunk(drop));
}

function sendTomato(match) {
  pushEvent(match, {
    type: "tomato",
    x: Math.round(rand(W * LINK_TOMATO_X[0], W * LINK_TOMATO_X[1])),
    y: Math.round(rand(H * LINK_TOMATO_Y[0], H * LINK_TOMATO_Y[1])),
  });
  addPopup(match.side, strings.link.heckleSent, W / 2, STAGE_H + 140, true);
  play("boing", { rate: 1.4, volume: 0.5 });
}

function checkHeckle(match) {
  const { side } = match;
  for (let combo = match.comboSeen + 1; combo <= side.combo; combo++) {
    if (combo % LINK_TOMATO_EVERY === 0) sendTomato(match);
  }
  match.comboSeen = side.combo;
}

function receiveTomato(match, event) {
  const { side, rival } = match;
  match.splats.push({
    x: clamp(Number(event.x) || W / 2, 0, W), y: clamp(Number(event.y) || H / 2, 0, H),
    seed: event.n, color: VENUES[rival.venue].spot, t: 0,
  });
  if (match.splats.length > LINK_TOMATO_MAX) match.splats.shift();
  side.shake = Math.max(side.shake, LINK_TOMATO_SHAKE);
  addPopup(side, strings.link.heckled, W / 2, H * 0.45, true);
  play("heckle");
}

function updateSplats(match, dt) {
  for (const splat of match.splats) splat.t += dt;
  match.splats = match.splats.filter((splat) => splat.t < LINK_TOMATO_TIME);
}

function updateLinkSide(match, motion, dt) {
  const { side } = match;
  side.shake = Math.max(0, side.shake - SHAKE_DECAY * dt);
  if (side.hitStop > 0) {
    side.hitStop -= dt;
    return;
  }
  const venue = VENUES[side.venue];
  for (const body of side.bodies) {
    updateBody(side, body, motion, venue, dt);
    if (body.arriving && body.y >= body.r) body.arriving = false;
    if (leavesTop(body)) sendJunk(match, body);
  }
  side.bodies = side.bodies.filter((body) => !body.gone);
  drainHype(side, venue, dt);
  side.hype = Math.min(side.hype, venue.hype);
  updateSideRockstar(side, () => spawnBody("rockstar"));
}

function advanceLinkLeg(match) {
  const leg = Math.min(LINK_VENUES.length - 1, Math.floor(match.t / LINK_NIGHT));
  if (leg === match.leg) return;
  match.leg = leg;
  match.side.venue = LINK_VENUES[leg];
  play(`venue_${VENUES[LINK_VENUES[leg]].key}`);
  setMusicLevel(leg);
}

function checkFinal(match) {
  if (match.finalSeen || match.t < LINK_TIME - LINK_FINAL) return;
  match.finalSeen = true;
  play("riff");
}

function pianoComing(match) {
  const piano = match.schedule.find((event, i) => i >= match.next && event.kind === "piano");
  return piano !== undefined && piano.at - match.t <= PIANO_WARNING;
}

function updateLinkGear(match) {
  const { side, schedule } = match;
  while (match.next < schedule.length && schedule[match.next].leg < match.leg) match.next++;
  const warn = pianoComing(match);
  if (warn && !match.pianoWarn) play("piano_warning");
  match.pianoWarn = warn;
  const event = schedule[match.next];
  if (!event || match.t < event.at || settledBodies(side) >= LINK_MAX_BODIES[match.leg]) return;
  side.bodies.push(spawnBody(event.kind));
  match.next++;
}

function judgeMatch(match) {
  const winner = judge([match.side, match.rival]);
  return winner === 0 ? "win" : winner === 1 ? "lose" : "draw";
}

function endMatch(game, outcome) {
  const { match } = game;
  match.outcome = outcome;
  match.locked = outcome === "none";
  match.pianoWarn = false;
  match.incoming = [];
  match.splats = [];
  match.side.bodies = match.side.bodies.filter((body) => body.splat);
  if (outcome === "win") play("cheer");
  if (outcome !== "none") play(outcome);
  setScene(game, "linkResult");
}

function updateLinkResult(game, motion, dt) {
  const { link, match } = game;
  pollLink(link, ownState(match, "over"), false);
  readRival(match, link, dt);
  match.rivalRematch = rivalStatus(link) === "ready" && link.rival.state?.phase === "lobby";
  if (match.locked) return;
  match.outcome = judgeMatch(match);
  match.locked = match.rival.phase === "over";
}
