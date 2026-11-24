export const SAVE_KEY = 'noites_fredbears_1983_v6';

export const saveState = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return {
      unlockedNight: Math.min(5, Math.max(1, raw.unlockedNight || 1)),
      stars: Array.isArray(raw.stars) ? raw.stars : [],
      quality: raw.quality === 'medium' ? 'medium' : 'high'
    };
  } catch {
    return { unlockedNight: 1, stars: [], quality: 'high' };
  }
})();

export function persistSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
  } catch {}
}

export const CAMERAS = [
  { id: 0, code: 'CAM 01', name: 'PALCO PRINCIPAL', short: 'PALCO', mapX: 0.48, mapY: 0.14 },
  { id: 1, code: 'CAM 02', name: 'SALÃO DE FESTAS', short: 'SALÃO', mapX: 0.48, mapY: 0.38 },
  { id: 2, code: 'CAM 03', name: 'BASTIDORES (PEÇAS)', short: 'PEÇAS', mapX: 0.16, mapY: 0.34 },
  { id: 3, code: 'CAM 04', name: 'COZINHA & ESTOQUE', short: 'COZINHA', mapX: 0.80, mapY: 0.34 },
  { id: 4, code: 'CAM 05', name: 'CORREDOR OESTE', short: 'OESTE', mapX: 0.25, mapY: 0.63 },
  { id: 5, code: 'CAM 06', name: 'CORREDOR LESTE', short: 'LESTE', mapX: 0.71, mapY: 0.63 },
  { id: 6, code: 'CAM 07', name: 'DUTO DE VENTILAÇÃO', short: 'DUTOS', mapX: 0.57, mapY: 0.77 }
];

export const NIGHT_CONFIGS = {
  1: { freddyAI: 4,  bonnieAI: 3 },
  2: { freddyAI: 7,  bonnieAI: 7 },
  3: { freddyAI: 11, bonnieAI: 10 },
  4: { freddyAI: 15, bonnieAI: 15 },
  5: { freddyAI: 18, bonnieAI: 18 }
};

export const PHONE_TRACKS = {
  1: './Phone_Guy-N1.mp3',
  2: './Phone_Guy-N2.mp3',
  3: './Phone_Guy-N3.mp3',
  4: './Phone_Guy-N4.mp3',
  5: './Phone_Guy-N5.mp3'
};

export const CAM_TRANSFORMS = [
  { pos: [0, 2.68, -17.9], look: [0, 1.56, -22.6] },
  { pos: [-5.8, 2.85, -13.6], look: [1.5, 1.1, -19.5] },
  { pos: [-10.2, 2.75, -15.0], look: [-13.6, 1.15, -19.5] },
  { pos: [10.2, 2.75, -15.0], look: [13.5, 1.05, -19.5] },
  { pos: [-4.2, 2.75, -11.0], look: [-4.1, 1.1, -2.5] },
  { pos: [4.2, 2.75, -11.0], look: [4.1, 1.1, -2.5] },
  { pos: [11.0, 5.25, -3.2], look: [11.0, 4.95, -9.8] }
];

export const ROOM_LIGHT_CFGS = [
  { color: 0xffc472, intensity: 5.5, dist: 17, pos: [0, 3.05, -20.6] },
  { color: 0x90aefc, intensity: 3.4, dist: 19, pos: [0, 3.0, -17.0] },
  { color: 0xd0e4ff, intensity: 3.4, dist: 15, pos: [-12.8, 3.0, -18.0] },
  { color: 0xff4545, intensity: 2.8, dist: 15, pos: [12.8, 3.0, -18.0] },
  { color: 0xbad0ff, intensity: 3.1, dist: 15, pos: [-4.15, 2.8, -6.5] },
  { color: 0xbad0ff, intensity: 3.1, dist: 15, pos: [4.15, 2.8, -6.5] },
  { color: 0x7effa8, intensity: 2.9, dist: 14, pos: [11.0, 5.4, -5.5] }
];

export const FREDDY_SPOTS = {
  0: { x: -0.95, y: 0.46, z: -22.7, ry: 0.15, pose: 'STAGE' },
  1: { x: -1.1,  y: 0.0,  z: -17.5, ry: -0.55, pose: 'STALK' },
  2: { x: -13.0, y: 0.0,  z: -18.0, ry: 0.72, pose: 'PEEK_CAM' },
  4: { x: -4.15, y: 0.0,  z: -5.2,  ry: 0.05, pose: 'STALK' },
  BLIND_L: { x: -3.50, y: 0.0, z: -1.25, ry: Math.PI / 2 - 0.16, pose: 'BLINDSPOT' }
};

export const BONNIE_SPOTS = {
  0: { x: 0.95,  y: 0.46, z: -22.7, ry: -0.18, pose: 'STAGE' },
  1: { x: 1.45,  y: 0.0,  z: -18.6, ry: -0.75, pose: 'STALK' },
  3: { x: 12.8,  y: 0.0,  z: -18.1, ry: -0.68, pose: 'PEEK_CAM' },
  5: { x: 4.15,  y: 0.0,  z: -5.4,  ry: -0.08, pose: 'STALK' },
  BLIND_R: { x: 3.50, y: 0.0, z: -1.25, ry: -Math.PI / 2 + 0.16, pose: 'BLINDSPOT' },
  6: { x: 11.0,  y: 4.52, z: -7.5,  ry: 0.0, pose: 'VENT_CRAWL' },
  VENT_OFFICE: { x: 0.0, y: 2.34, z: -4.15, ry: 0.0, pose: 'VENT_PEEK' }
};

export const game = {
  mode: 'LOADING',
  night: 1,
  isCustom: false,
  freddyAI: 4,
  bonnieAI: 3,
  hour: 0,
  hourDuration: 42,
  nightElapsed: 0,
  power: 100,
  flashlightPower: 100,
  usageLevel: 1,
  monitorOpen: false,
  activeCam: 0,
  doorL: false,
  doorR: false,
  lightL: false,
  lightR: false,
  ventSealed: false,
  flashlightOn: false,
  audioLureCooldown: 0,
  flashCooldown: 0,
  lurePingCam: -1,
  lurePingTimer: 0,
  soundSensorCam: -1,
  soundSensorTimer: 0,
  camFlashAlpha: 0,
  staticBurst: 0,
  hallucinationTimer: 0,
  hallucinationText: '',
  dangerLevel: 0,
  heartbeatTimer: 0,
  breathTimer: 0,
  cameraShake: 0,
  lookTargetX: 0,
  lookTargetY: 0,
  lookCurrentX: 0,
  lookCurrentY: 0,
  mouseNormX: 0,
  mouseNormY: 0,
  hoverHint: '',
  phoneMuted: false,
  phoneActive: false,
  phoneElapsed: 0,
  powerOutPhase: 0,
  powerOutTimer: 0,
  jumpscareWho: null,
  jumpscareOrigin: 'DOOR_L',
  jumpscareElapsed: 0,
  jumpscareDuration: 1.48,
  jumpscareBiteDone: false,
  biteFlash: 0,
  camMoveGlitch: 0,
  flickerTimer: 0,
  flickerIntensity: 1,
  musicStep: 0
};

export const animState = {
  freddy: {
    loc: 0,
    moveTimer: 8,
    patience: 0,
    stunTimer: 0,
    pose: 'STAGE',
    spottedAtDoor: false,
    twitch: 0,
    darkEyes: false
  },
  bonnie: {
    loc: 0,
    moveTimer: 10,
    patience: 0,
    stunTimer: 0,
    pose: 'STAGE',
    spottedAtDoor: false,
    spottedAtVent: false,
    twitch: 0,
    darkEyes: false,
    ventCreep: 0
  }
};
