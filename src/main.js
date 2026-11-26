import * as THREE from 'three';
import { SECURITY_VIEWS, saveState, game, animState } from './config.js';
import { audio } from './audio.js';
import { buildTextures } from './textures.js';
import { applyAnimatronicPose, trackAnimatronicPose, BITE_PROGRESS } from './animatronic-motion.js';
import { createJumpscareSequence } from './jumpscare.js';
import { createViewRenderer, volumetricMaterials } from './shaders.js';
import { buildWorld } from './world.js';
import { createPixiHUD } from './hud.js';
import { createGameController } from './ai.js';
import { setupUI } from './ui.js';

const threeCanvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: false,
  powerPreference: 'high-performance'
});
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020203);
scene.fog = new THREE.FogExp2(0x020203, 0.088);

const officeCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 60);
officeCamera.position.set(0, 1.52, 1.42);

const securityCameras = SECURITY_VIEWS.map(view => {
  const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.055, 38);
  camera.position.fromArray(view.pos);
  camera.lookAt(...view.look);
  camera.rotateZ(view.roll);
  return camera;
});
const menuFov = 52;
const menuCamera = new THREE.PerspectiveCamera(menuFov, 1, 0.08, 38);
const viewRenderer = createViewRenderer(renderer, scene);
const textures = buildTextures();
const world = buildWorld(scene, textures);
const jumpscareSequence = createJumpscareSequence(officeCamera, world);
const hud = createPixiHUD();

let ui = null;
const controller = createGameController({
  world,
  officeCamera,
  refreshMenuStars: () => ui && ui.refreshMenuStars(),
  showScreen: id => ui && ui.showScreen(id)
});

let graphicsDirty = true;
function resizeGraphics() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const aspect = width / height;
  const high = saveState.quality === 'high';
  viewRenderer.resize(width, height, high);
  renderer.shadowMap.enabled = high;
  officeCamera.aspect = aspect;
  officeCamera.updateProjectionMatrix();
  const portraitScale = Math.min(1.45, Math.max(1, 1.34 / aspect));
  menuCamera.aspect = aspect;
  menuCamera.fov = menuFov * portraitScale;
  menuCamera.updateProjectionMatrix();
  securityCameras.forEach((camera, i) => {
    camera.aspect = aspect;
    camera.fov = SECURITY_VIEWS[i].fov * portraitScale;
    camera.updateProjectionMatrix();
  });
  hud.layoutPixiUI();
  graphicsDirty = true;
}

ui = setupUI({ world, hud, controller, officeCamera, resizeGraphics });
resizeGraphics();

const flashlightDirection = new THREE.Vector3();
const phoneBox = document.getElementById('phone-box');
const phoneTitle = document.getElementById('phone-caller-title');
const phoneTimer = document.getElementById('phone-timer');
const frame = {};
let lastTime = performance.now();
let lastDraw = -1;
let lastMode = '';
let lastCamera = null;
let litView = null;

function setViewLighting(view, camera, monitor, high, elapsed) {
  const cctv = Boolean(view);
  world.officeLamp.visible = !cctv && game.mode !== 'POWEROUT';
  world.officeLamp.castShadow = high && world.officeLamp.visible && game.mode !== 'JUMPSCARE';
  world.crtDeskGlow.visible = !cctv;
  world.hallLightL.visible = !cctv && world.hallLightL.intensity > 0;
  world.hallLightR.visible = !cctv && world.hallLightR.intensity > 0;
  world.flashlight.visible = !cctv && world.flashlight.intensity > 0 && game.mode !== 'JUMPSCARE' && game.mode !== 'POWEROUT';
  world.jumpscareLight.visible = world.jumpscareRim.visible = game.mode === 'JUMPSCARE';
  world.securityKey.visible = cctv;
  world.securityFill.visible = cctv;
  world.securityIR.visible = monitor && game.camFlashAlpha > 0.02;
  world.securityKey.castShadow = high && cctv;
  world.dustParticles.visible = high && (!monitor || game.activeCam < 2);
  scene.fog.density = cctv ? (monitor && game.activeCam === 6 ? 0.074 : 0.052) : 0.077;
  for (const cone of world.stageCones) cone.visible = high && cctv && (!monitor || game.activeCam === 0);

  if (view !== litView) {
    litView = view;
    if (view) {
      world.securityKey.position.fromArray(view.key);
      world.securityKey.target.position.fromArray(view.look);
      world.securityKey.color.setHex(view.light);
      world.securityFill.position.fromArray(view.fill);
      world.securityFill.color.setHex(view.fillColor ?? view.light);
      world.securityFill.intensity = view.fillIntensity ?? 5.1;
    }
  }

  if (!view) return;
  world.securityKey.intensity = view.intensity * (0.97 + 0.03 * Math.sin(elapsed * 29));
  if (monitor && game.activeCam > 1) world.securityKey.intensity *= 0.60 + 0.40 * game.flickerIntensity;
  if (world.securityIR.visible) {
    world.securityIR.position.copy(camera.position);
    world.securityIR.target.position.fromArray(view.look);
    world.securityIR.intensity = 98 * game.camFlashAlpha;
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const elapsed = now / 1000;
  const highQuality = saveState.quality === 'high';
  const still = ['SPLASH', 'PAUSED', 'WIN', 'GAMEOVER'].includes(game.mode);
  if (still && game.mode === lastMode && !graphicsDirty) return;

  for (let i = 0; i < volumetricMaterials.length; i++) {
    volumetricMaterials[i].uniforms.uTime.value = elapsed;
  }

  if (game.mode !== 'POWEROUT' && !still) {
    world.fanBlades.rotation.z += dt * 19.0;
    world.ductFan.rotation.z -= dt * 8.0;
    world.officeVentFan.rotation.z -= dt * 7.2;
    world.lampPivot.rotation.z = Math.sin(elapsed * 0.9) * 0.022;
    world.lampPivot.rotation.x = Math.cos(elapsed * 0.7) * 0.015;
    world.dustParticles.rotation.y = Math.sin(elapsed * 0.08) * 0.04;
    world.dustParticles.position.y = Math.sin(elapsed * 0.35) * 0.04;
  }

  // Spinning cassette deck reels while Phone Guy's tape plays
  const tapeSpinning = game.mode === 'PLAYING' && game.phoneActive && !game.phoneMuted;
  if (tapeSpinning) {
    world.tapeReelL.rotation.y += dt * 3.8;
    world.tapeReelR.rotation.y += dt * 5.2;
    world.tapeLedMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 6) * 0.35;
  } else {
    world.tapeLedMat.emissiveIntensity = 0;
  }

  game.flickerTimer -= dt;
  if (game.flickerTimer <= 0) {
    if (Math.random() < 0.08) {
      game.flickerIntensity = 0.08;
      game.flickerTimer = 0.10 + Math.random() * 0.12;
    } else {
      game.flickerIntensity = 1.0;
      game.flickerTimer = 0.4 + Math.random() * 1.8;
    }
  }

  if (game.mode === 'PLAYING') {
    game.nightElapsed += dt;
    const newHour = Math.floor(game.nightElapsed / game.hourDuration);
    if (newHour > game.hour && newHour < 6) {
      game.hour = newHour;
      audio.playClick(640);
    }
    if (game.nightElapsed >= game.hourDuration * 6) {
      controller.triggerWin6AM();
      return;
    }

    game.audioLureCooldown = Math.max(0, game.audioLureCooldown - dt);
    game.flashCooldown = Math.max(0, game.flashCooldown - dt);
    game.lurePingTimer = Math.max(0, game.lurePingTimer - dt);
    game.soundSensorTimer = Math.max(0, game.soundSensorTimer - dt);
    game.camFlashAlpha = Math.max(0, game.camFlashAlpha - dt * 3.5);
    game.staticBurst = Math.max(0, game.staticBurst - dt * 2.2);
    game.camMoveGlitch = Math.max(0, game.camMoveGlitch - dt * 1.4);
    game.hallucinationTimer = Math.max(0, game.hallucinationTimer - dt);
    game.cameraShake = Math.max(0, game.cameraShake - dt * 1.2);

    if (!game.monitorOpen) {
      if (ui.keysDown.has('a') || ui.keysDown.has('arrowleft')) game.lookTargetX = Math.min(0.85, game.lookTargetX + dt * 1.8);
      if (ui.keysDown.has('d') || ui.keysDown.has('arrowright')) game.lookTargetX = Math.max(-0.85, game.lookTargetX - dt * 1.8);
      if (ui.keysDown.has('w') || ui.keysDown.has('arrowup')) game.lookTargetY = Math.min(0.62, game.lookTargetY + dt * 1.5);
      if (ui.keysDown.has('s') || ui.keysDown.has('arrowdown')) game.lookTargetY = Math.max(-0.22, game.lookTargetY - dt * 1.5);
    }

    game.lookCurrentX = THREE.MathUtils.lerp(game.lookCurrentX, game.lookTargetX, dt * 8.5);
    game.lookCurrentY = THREE.MathUtils.lerp(game.lookCurrentY, game.lookTargetY, dt * 8.5);
    const shakeX = (Math.random() - 0.5) * game.cameraShake * 0.08;
    const shakeY = (Math.random() - 0.5) * game.cameraShake * 0.08;
    officeCamera.rotation.order = 'YXZ';
    officeCamera.rotation.y = game.lookCurrentX + shakeX;
    officeCamera.rotation.x = game.lookCurrentY + Math.sin(elapsed * 1.4) * 0.005 + shakeY;

    if (game.dangerLevel > 0.55) {
      world.plushHead.rotation.y = THREE.MathUtils.lerp(world.plushHead.rotation.y, -0.35, dt * 2.0);
      world.plushPupilL.position.x = -0.032;
      world.plushPupilR.position.x = 0.044;
    } else {
      world.plushHead.rotation.y = THREE.MathUtils.lerp(world.plushHead.rotation.y, 0.0, dt * 2.0);
      world.plushPupilL.position.x = -0.038;
      world.plushPupilR.position.x = 0.038;
    }

    if (game.flashlightOn && !game.monitorOpen && game.flashlightPower > 0) {
      game.flashlightPower = Math.max(0, game.flashlightPower - dt * 4.5);
      if (game.flashlightPower <= 0) game.flashlightOn = false;
      world.flashlight.intensity = 15.0;
      world.flashlight.castShadow = highQuality;
      flashlightDirection.set(game.mouseNormX * 0.35, game.mouseNormY * 0.30, -1).normalize().applyQuaternion(officeCamera.quaternion);
      world.flashlight.target.position.copy(officeCamera.position).addScaledVector(flashlightDirection, 5.0);
      world.flashVolCone.visible = true;
      world.flashVolCone.position.copy(world.flashlight.position);
      world.flashVolCone.lookAt(world.flashlight.target.position);
    } else {
      world.flashlight.intensity = 0;
      world.flashlight.castShadow = false;
      world.flashVolCone.visible = false;
      game.flashlightPower = Math.min(100, game.flashlightPower + dt * 1.9);
    }

    world.hallLightL.intensity = game.lightL ? (Math.random() > 0.06 ? 8.4 : 1.2) : 0;
    world.hallLightL.castShadow = highQuality && game.lightL;
    world.hallLightR.intensity = game.lightR ? (Math.random() > 0.06 ? 8.4 : 1.2) : 0;
    world.hallLightR.castShadow = highQuality && game.lightR;
    world.officeLamp.intensity = (2.15 + Math.sin(elapsed * 17) * 0.06) * (game.dangerLevel > 0.7 ? game.flickerIntensity : 1.0);

    let usage = 1;
    if (game.doorL) usage++;
    if (game.doorR) usage++;
    if (game.ventSealed) usage++;
    if (game.lightL || game.lightR) usage++;
    if (game.monitorOpen) usage++;
    game.usageLevel = Math.min(5, usage);

    game.power -= (0.13 + (usage - 1) * 0.24) * dt;
    if (game.power <= 0) {
      game.power = 0;
      controller.triggerPowerOutage();
      return;
    }

    if (game.phoneActive && !game.phoneMuted) {
      game.phoneElapsed += dt;
      const tSec = Math.floor(audio.getPhoneTime());
      const mm = String(Math.floor(tSec / 60)).padStart(2, '0');
      const ss = String(tSec % 60).padStart(2, '0');
      phoneBox.classList.add('active');
      const phoneLabel = `☎ CHAMADA DO GERENTE — NOITE ${game.night}`;
      const timeLabel = `${mm}:${ss}`;
      if (phoneTitle.textContent !== phoneLabel) phoneTitle.textContent = phoneLabel;
      if (phoneTimer.textContent !== timeLabel) phoneTimer.textContent = timeLabel;
    } else {
      phoneBox.classList.remove('active');
    }

    controller.updateAnimatronics(dt);
  } else if (game.mode === 'POWEROUT') {
    game.lookCurrentX = THREE.MathUtils.lerp(game.lookCurrentX, 0.52, dt * 1.6);
    game.lookCurrentY = THREE.MathUtils.lerp(game.lookCurrentY, 0.02, dt * 1.6);
    officeCamera.rotation.order = 'YXZ';
    officeCamera.rotation.y = game.lookCurrentX;
    officeCamera.rotation.x = game.lookCurrentY;
    world.flashVolCone.visible = false;
    world.flashlight.castShadow = false;
    world.hallLightL.castShadow = false;
    world.hallLightR.castShadow = false;
    controller.updatePowerOutage(dt);
  }

  if (game.mode === 'JUMPSCARE') {
    game.jumpscareElapsed += dt;
    world.flashVolCone.visible = false;
    world.flashlight.castShadow = false;
    const progress = jumpscareSequence.update(game);
    game.biteFlash = Math.max(0, game.biteFlash - dt * 5.2);
    if (progress >= BITE_PROGRESS && !game.jumpscareBiteDone) {
      game.jumpscareBiteDone = true;
      game.biteFlash = 0.86;
      audio.playBiteCrunch();
    }
    world.officeLamp.intensity = 0.43;

    if (progress >= 1) {
      game.mode = 'GAMEOVER';
      world.jumpscareLight.intensity = 0;
      world.jumpscareRim.intensity = 0;
      jumpscareSequence.reset();
      const whoName = game.jumpscareWho === 'bonnie' ? 'SpringBonnie' : 'SpringFreddy';
      document.getElementById('gameover-report').textContent =
        `RELATÓRIO DE INCIDENTE #83: O vigia foi capturado por ${whoName} às ${game.hour === 0 ? '12' : game.hour}:00 AM. Traumas cranianos compatíveis com mordida hidráulica Springlock.`;
      ui.showScreen('gameover-screen');
    }
  }

  const menu = game.mode === 'MENU' || game.mode === 'NEWSPAPER';
  const monitor = game.monitorOpen && (game.mode === 'PLAYING' || game.mode === 'PAUSED');
  const camera = menu ? menuCamera : monitor ? securityCameras[game.activeCam] : officeCamera;
  const view = menu ? SECURITY_VIEWS[0] : monitor ? SECURITY_VIEWS[game.activeCam] : null;
  const flash = monitor ? game.camFlashAlpha : 0;
  const changed = graphicsDirty || camera !== lastCamera || game.mode !== lastMode;
  if (!changed && (monitor || menu) && now - lastDraw < 31 && flash <= frame.flash + 0.16) return;

  if (menu) {
    menuCamera.position.set(0.39 + Math.sin(elapsed * 0.35) * 0.34, 2.07, -19.08);
    menuCamera.lookAt(menuCamera.aspect < 1.1 ? 0 : -0.28, 1.81, -22.64);
  }

  const jumpscare = game.mode === 'JUMPSCARE';
  const freddy = world.freddyRig;
  const bonnie = world.bonnieRig;
  if (!jumpscare) controller.syncAnimatronicWorldPositions();
  freddy.root.visible = menu || (monitor ? animState.freddy.loc === game.activeCam
    : jumpscare ? game.jumpscareWho === 'freddy' : game.mode === 'POWEROUT' || animState.freddy.loc === 'BLIND_L');
  bonnie.root.visible = menu || (monitor ? animState.bonnie.loc === game.activeCam
    : jumpscare ? game.jumpscareWho === 'bonnie'
      : game.mode !== 'POWEROUT' && (animState.bonnie.loc === 'BLIND_R' || animState.bonnie.loc === 'VENT_OFFICE'));

  if (menu) {
    applyAnimatronicPose(freddy, 'STAGE', elapsed, 0.09, false, menuCamera.position);
    applyAnimatronicPose(bonnie, 'STAGE', elapsed, 0.12, false, menuCamera.position);
  } else if (!jumpscare && (!still || changed)) {
    const freddyPose = game.mode === 'POWEROUT' ? 'POWEROUT' : animState.freddy.pose;
    trackAnimatronicPose(freddy, freddyPose, elapsed);
    trackAnimatronicPose(bonnie, animState.bonnie.pose, elapsed);
    if (freddy.root.visible) {
      applyAnimatronicPose(freddy, freddyPose, elapsed, animState.freddy.twitch,
        animState.freddy.darkEyes, camera.position);
      if (game.mode === 'POWEROUT') freddy.pupilMat.emissiveIntensity = game.powerOutEyeGlow || 0;
    }
    if (bonnie.root.visible) {
      applyAnimatronicPose(bonnie, animState.bonnie.pose, elapsed, animState.bonnie.twitch, animState.bonnie.darkEyes, camera.position);
    }
  }

  setViewLighting(view, camera, monitor, highQuality, elapsed);
  frame.time = elapsed;
  frame.high = highQuality;
  frame.cctv = monitor;
  frame.view = view;
  frame.channel = game.activeCam;
  frame.flash = flash;
  frame.glitch = jumpscare ? 0.06 + game.biteFlash * 0.62 : Math.min(1, game.staticBurst + game.camMoveGlitch);
  frame.powerOut = game.mode === 'POWEROUT';
  frame.danger = game.dangerLevel;
  frame.bite = game.biteFlash;
  viewRenderer.render(camera, frame);

  document.body.classList.toggle('cctv-open', monitor);
  hud.updatePixiHUD(Math.min(0.1, (now - lastDraw) / 1000), elapsed);
  hud.pixiApp.render();
  lastDraw = now;
  lastCamera = camera;
  lastMode = game.mode;
  graphicsDirty = false;
}

document.getElementById('loader-bar').style.width = '100%';
document.getElementById('loader-sub').textContent = 'TURNO NOTURNO PRONTO.';
requestAnimationFrame(now => {
  ui.returnToMenu();
  animate(now);
});
