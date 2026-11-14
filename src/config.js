export const W = 1280;
export const H = 720;

export const PAPER = "#efe8d8";
export const INK = "#16130f";
export const FONT_POSTER = '"Poster", Impact, sans-serif';
export const FONT_TYPE = '"Type", "Courier New", monospace';

export const STAGE_H = 74;
export const FLOOR_Y = H - 56;

export const BODIES = {
  rockstar: { mass: 1, r: 46 },
  guitar: { mass: 1, r: 52 },
  amp: { mass: 2.5, r: 64 },
  drums: { mass: 4, r: 80 },
  piano: { mass: 6, r: 96 },
};

export const VENUES = [
  {
    key: "divebar", spot: "#e8402a", gravity: 1500, hype: 16,
    gear: ["guitar"], gearFrom: 0.5, gearEvery: [10, 14], pianoAt: [],
    wind: 0, windFrom: 0, maxBodies: 2, drain: 0.4, smashLoss: 3,
  },
  {
    key: "stadium", spot: "#1f5fd6", gravity: 1750, hype: 24,
    gear: ["guitar", "amp", "drums"], gearFrom: 0, gearEvery: [6, 9], pianoAt: [],
    wind: 0, windFrom: 0, maxBodies: 3, drain: 0.7, smashLoss: 4,
  },
  {
    key: "clouds", spot: "#d9338f", gravity: 1100, hype: 28,
    gear: ["guitar", "drums"], gearFrom: 0, gearEvery: [6, 9], pianoAt: [],
    wind: 700, windFrom: 0, maxBodies: 3, drain: 0.9, smashLoss: 6,
  },
  {
    key: "moon", spot: "#e0a400", gravity: 800, hype: 34,
    gear: ["guitar", "amp", "drums"], gearFrom: 0, gearEvery: [5, 8], pianoAt: [0.3, 0.7],
    wind: 0, windFrom: 0, maxBodies: 4, drain: 1.2, smashLoss: 7,
  },
];

export const NEED_PER_MASS = 6;
export const SENSE_SCALE = 1.1;
export const HAND_HEAT = 0.6;

export const SENS_MIN = 1;
export const SENS_MAX = 9;
export const SENS_DEFAULT = 5;
export const SENS_NOISE_MULT = [1.6, 1.4, 1.2, 1.1, 1, 0.9, 0.8, 0.65, 0.5];
export const SENS_NEED_MULT = [1.6, 1.4, 1.25, 1.1, 1, 0.9, 0.8, 0.7, 0.6];
export const SENS_FLASH_TIME = 1;
export const SENS_STORAGE_KEY = "bounceback-sensitivity";
export const BOUNCE_MIN_VY = -150;
export const BOUNCE_H_MIN = 0.45;
export const BOUNCE_H_MAX = 0.75;
export const POWER_RANGE = 2;
export const PUSH = 6;
export const MAX_VX = 1000;
export const BOUNCE_COOLDOWN = 0.15;
export const SPIN_MAX = 4;
export const SQUASH_DECAY = 5;
export const HEAVY_MASS = 2;
export const ASSIST_DRAG = 2.5;
export const NEED_MORE_TIME = 0.35;

export const FLICK_SCALE = 2.6;
export const FLICK_MIN_SPEED = 200;
export const FLICK_FULL_SPEED = 900;
export const FLICK_POWER = 2100;
export const FLICK_MIN_UP = 450;
export const MAX_FLICK_VX = 1900;
export const FLICK_COOLDOWN = 0.3;
export const FLOW_FRESH = 0.7;
export const FLOW_OLD_MIN = 0.2;
export const FLOW_MIN_AGE = 0.03;
export const FLICK_LABEL_AT = 0.5;
export const FLICK_BURST_BONUS = 0.4;
export const FLICK_TRAIL_SPEED = 1450;
export const FLICK_TRAIL_LINES = 4;
export const FLICK_TRAIL_LEN = 90;
export const FLICK_TRAIL_SPACING = 0.45;

export const WALL_BOUNCE = 0.6;
export const AIR_DRAG = 0.2;
export const SPAWN_VY = -420;
export const SPAWN_GRACE = 0.5;

export const ENCORES = 3;
export const RESPAWN_DELAY = 1.2;
export const CARD_TIME = 1.8;
export const CLEAR_TIME = 2.6;
export const COMPLETE_TIME = 5;
export const OVER_IDLE = 20;
export const SAVED_HOLD = 2.5;
export const NAME_MAX = 12;
export const CONFIRM_CLEAR_TIME = 4;

export const START_HEAT = 20;
export const START_FILL = 1;
export const START_DRAIN = 0.6;
export const ATTRACT_LOCK = 2;

export const BOUNCE_POINTS = 100;
export const COMBO_STEP = 3;
export const COMBO_MULT_MAX = 5;
export const CLEAR_BONUS = 1000;
export const HYPE_MIN = 0.8;
export const HYPE_MAX = 1.8;
export const HYPE_SHAKE_AT = 0.85;
export const DRAIN_DELAY = 1.5;

export const GEAR_FIRST_DELAY = 7;
export const GEAR_RAMP = 0.5;
export const GEAR_RETRY = 1;
export const PIANO_WARNING = 1;

export const HIT_STOP_CELLS = 12;
export const HIT_STOP_TIME = 0.04;
export const SHAKE_SPLAT = 16;
export const SHAKE_SMASH = 11;
export const SHAKE_DECAY = 40;
export const CONFETTI_MAX = 300;
export const CONFETTI_BASE = 6;
export const CONFETTI_PER_POWER = 22;
export const CONFETTI_GRAVITY = 900;
export const CONFETTI_DRAG = 1.2;
export const RAIN_RATE = 45;
export const CROWD_ALPHA = 0.6;

export const BATTLE_VENUES = [0, 1, 3];
export const BATTLE_TIME = 90;
export const BATTLE_LEG = BATTLE_TIME / BATTLE_VENUES.length;
export const BATTLE_MAX_BODIES = [1, 2, 3];
export const BATTLE_GEAR_EVERY = [[9, 12], [6, 9], [4, 6]];
export const BATTLE_PIANO_AT = 10;
export const BATTLE_CARD_TIME = 1.8;
export const BATTLE_RESULT_TIME = 8;
export const DIVIDER_X = W / 2;
export const DIVIDER_W = 14;

export const LINK_ROOM = "haven";
export const LINK_POST_MS = 100;
export const LINK_TIMEOUT_MS = 1500;
export const LINK_CONNECTED_MS = 2000;
export const LINK_SILENT_MS = 3000;
export const LINK_GIVE_UP_MS = 10000;
export const LINK_RTT_SLACK_MS = 40;
export const LINK_RTT_CREEP_MS = 0.5;
export const LINK_OFFSET_BLEND = 0.2;
export const LINK_COUNTDOWN = 3;
export const LINK_STALE_START = 1;
export const LINK_SPLAT_FLASH = 1;
export const LINK_RESULT_TIME = 8;
export const LINK_NO_CONTEST_TIME = 3;

export const LINK_VENUES = [0, 1, 2, 3];
export const LINK_NIGHT = 20;
export const LINK_TIME = LINK_NIGHT * LINK_VENUES.length;
export const LINK_MAX_BODIES = [1, 2, 3, 4];
export const LINK_GEAR_EVERY = [[7, 9], [5, 7], [4, 6], [3, 5]];
export const LINK_FIRST_GEAR = 3;
export const LINK_PIANO_AT = 8;
export const LINK_TRANSITION = 0.9;
export const LINK_FINAL = 10;
export const LINK_FINAL_GEAR_SCALE = 0.5;
export const LINK_FINAL_STAMP = 1.4;

export const LINK_WIN_SCALE = 5 / 16;
export const LINK_WIN_W = W * LINK_WIN_SCALE;
export const LINK_WIN_H = H * LINK_WIN_SCALE;
export const LINK_WIN_X = W - LINK_WIN_W - 16;
export const LINK_WIN_Y = 40;
export const LINK_RIVAL_SMOOTH = 0.1;

export const LINK_STATE_BODIES = 4;
export const LINK_EVENTS_KEPT = 8;

export const JUNK_SEND_POINTS = 500;
export const LINK_SEND_FLICK = 0.5;
export const LINK_SEND_Y = -60;
export const LINK_JUNK_WARN = 0.6;
export const LINK_JUNK_VY = 500;
export const LINK_JUNK_ABOVE = 20;
export const LINK_JUNK_MAX_VX = 300;

export const LINK_TOMATO_EVERY = 6;
export const LINK_TOMATO_X = [0.25, 0.75];
export const LINK_TOMATO_Y = [0.3, 0.65];
export const LINK_TOMATO_TIME = 2.5;
export const LINK_TOMATO_RADIUS = 170;
export const LINK_TOMATO_MAX = 4;
export const LINK_TOMATO_SHAKE = 8;

export const MUSIC_VOLUME = 0.5;

const IMAGE_KEYS = [
  "rockstar", "rockstar_bounce", "rockstar_splat", "guitar", "amp", "drums", "piano",
  "lighter", "stage", "venue_divebar", "venue_stadium", "venue_clouds", "venue_moon", "title",
];

const SOUND_KEYS = [
  "boing", "big_boing", "splat", "smash", "cheer", "boo", "riff", "piano_warning",
  "venue_divebar", "venue_stadium", "venue_clouds", "venue_moon", "tour_complete", "music",
];

function paths(dir, keys) {
  return Object.fromEntries(keys.map((key) => [key, `${dir}/${key}`]));
}

export const MANIFEST = {
  images: paths("assets/img", IMAGE_KEYS),
  sounds: paths("assets/sfx", SOUND_KEYS),
};
