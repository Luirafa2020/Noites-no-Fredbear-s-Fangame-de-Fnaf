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

export const SECURITY_VIEWS = [
  { pos: [0.10, 2.52, -19.07], look: [0, 1.80, -22.65], fov: 52, roll: -0.012,
    key: [-1.82, 3.21, -20.20], fill: [2.0, 2.88, -21.21], light: 0xffdbab, intensity: 45, fillIntensity: 11.5,
    fillColor: 0xd5ccef,
    tint: [1.0, 0.96, 0.82], gain: 1.04 },
  { pos: [-7.38, 3.04, -14.94], look: [-0.8, 1.35, -17.94], fov: 52, roll: 0.027,
    key: [-3.0, 3.24, -15.82], fill: [-3.6, 2.80, -17.68], light: 0xd4deeb, intensity: 31, fillIntensity: 15,
    tint: [0.83, 0.97, 0.92], gain: 1.07 },
  { pos: [-9.48, 2.95, -14.62], look: [-13.33, 1.34, -18.88], fov: 53, roll: -0.039,
    key: [-11.9, 3.12, -16.84], fill: [-14.95, 2.56, -19.28], light: 0xc4dae5, intensity: 24, tint: [0.86, 0.95, 1.0], gain: 0.98 },
  { pos: [9.50, 2.94, -14.72], look: [13.1, 1.25, -18.85], fov: 52, roll: 0.034,
    key: [11.60, 3.16, -17.05], fill: [14.85, 2.55, -19.60], light: 0xf2dfaf, intensity: 25, tint: [1.0, 0.94, 0.81], gain: 1.0 },
  { pos: [-5.10, 2.87, -11.25], look: [-4.12, 1.37, -4.1], fov: 38, roll: -0.043,
    key: [-4.10, 3.26, -7.0], fill: [-4.30, 2.64, -3.28], light: 0xc3d5f6, intensity: 22, tint: [0.77, 0.96, 1.06], gain: 1.10 },
  { pos: [5.08, 2.83, -11.32], look: [4.13, 1.32, -4.2], fov: 39, roll: 0.035,
    key: [4.13, 3.27, -7.6], fill: [4.53, 2.68, -3.36], light: 0xcbdcd6, intensity: 22, tint: [0.86, 1.04, 0.87], gain: 1.04 },
  { pos: [10.48, 5.21, -3.40], look: [11.10, 4.95, -8.85], fov: 42, roll: -0.027,
    key: [10.55, 5.23, -4.30], fill: [11.57, 5.37, -10.74], light: 0xe3eddd, intensity: 21, tint: [0.87, 1.07, 0.93], gain: 1.15 }
];

export const FREDDY_SPOTS = {
  0: { x: -0.95, y: 0.46, z: -22.57, ry: 0.15, pose: 'STAGE' },
  1: { x: -1.75, y: 0.0,  z: -17.1, ry: -0.76, pose: 'DINING' },
  2: { x: -12.85, y: 0.0, z: -18.94, ry: 0.60, pose: 'WORKBENCH' },
  4: { x: -4.19, y: 0.0, z: -5.25, ry: 2.27, pose: 'WEST_HALL' },
  BLIND_L: { x: -3.50, y: 0.0, z: -1.25, ry: Math.PI / 2 - 0.16, pose: 'BLINDSPOT' }
};

export const BONNIE_SPOTS = {
  0: { x: 0.95,  y: 0.46, z: -22.57, ry: -0.18, pose: 'STAGE' },
  1: { x: 1.28,  y: 0.0,  z: -18.6, ry: -0.80, pose: 'DINING' },
  3: { x: 12.91, y: 0.0, z: -18.58, ry: -0.62, pose: 'KITCHEN' },
  5: { x: 4.28, y: 0.0, z: -5.38, ry: -2.23, pose: 'EAST_HALL' },
  BLIND_R: { x: 3.50, y: 0.0, z: -1.25, ry: -Math.PI / 2 + 0.16, pose: 'BLINDSPOT' },
  6: { x: 11.0,  y: 4.46, z: -7.5,  ry: 0.0, pose: 'VENT_CRAWL' },
  VENT_OFFICE: { x: 0.0, y: 2.22, z: -4.15, ry: 0.0, pose: 'VENT_PEEK' }
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
  jumpscareLookX: 0,
  jumpscareLookY: 0,
  jumpscareDuration: 1.36,
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
