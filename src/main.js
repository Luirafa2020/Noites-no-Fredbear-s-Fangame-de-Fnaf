import * as THREE from 'three';
import { CAM_TRANSFORMS, ROOM_LIGHT_CFGS, saveState, game, animState } from './config.js';
import { audio } from './audio.js';
import { buildTextures } from './textures.js';
import { applyAnimatronicPose } from './animatronics.js';
import { setupPostProcessing, volumetricMaterials } from './shaders.js';
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, saveState.quality === 'high' ? 1.25 : 0.9));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = saveState.quality === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020203);
scene.fog = new THREE.FogExp2(0x020203, 0.088);

const officeCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 60);
officeCamera.position.set(0, 1.52, 1.42);

const cctvCamera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 60);

const { composer, bloomPass, crtPass } = setupPostProcessing(renderer, scene, officeCamera);
const textures = buildTextures();
const world = buildWorld(scene, textures);
const hud = createPixiHUD();

let ui = null;
const controller = createGameController({
  world,
  officeCamera,
  refreshMenuStars: () => ui && ui.refreshMenuStars(),
  showScreen: id => ui && ui.showScreen(id)
});

ui = setupUI({
  world,
  hud,
  controller,
  renderer,
  officeCamera,
  cctvCamera,
  composer,
  bloomPass
});

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const elapsed = now / 1000;
  const highQuality = saveState.quality === 'high';

  for (let i = 0; i < volumetricMaterials.length; i++) {
    volumetricMaterials[i].uniforms.uTime.value = elapsed;
  }

  if (game.mode !== 'POWEROUT' && game.mode !== 'PAUSED') {
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
      const dir = new THREE.Vector3(game.mouseNormX * 0.35, game.mouseNormY * 0.30, -1).normalize();
      dir.applyQuaternion(officeCamera.quaternion);
      world.flashlight.target.position.copy(officeCamera.position).addScaledVector(dir, 5.0);
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

    const phoneBox = document.getElementById('phone-box');
    if (game.phoneActive && !game.phoneMuted) {
      game.phoneElapsed += dt;
      const tSec = Math.floor(audio.getPhoneTime());
      const mm = String(Math.floor(tSec / 60)).padStart(2, '0');
      const ss = String(tSec % 60).padStart(2, '0');
      phoneBox.classList.add('active');
      document.getElementById('phone-caller-title').textContent = `☎ CHAMADA DO GERENTE — NOITE ${game.night}`;
      document.getElementById('phone-timer').textContent = `${mm}:${ss}`;
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
  } else if (game.mode === 'JUMPSCARE') {
    game.jumpscareElapsed += dt;
    world.flashVolCone.visible = false;
    world.flashlight.castShadow = false;
    const p = THREE.MathUtils.clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);

    game.lookCurrentX = THREE.MathUtils.lerp(game.lookCurrentX, 0.0, Math.min(1, dt * 16));
    game.lookCurrentY = THREE.MathUtils.lerp(game.lookCurrentY, 0.04, Math.min(1, dt * 16));

    if (p >= 0.68 && !game.jumpscareBiteDone) {
      game.jumpscareBiteDone = true;
      game.biteFlash = 1.0;
      audio.playBiteCrunch();
    }
    game.biteFlash = Math.max(0, game.biteFlash - dt * 2.8);

    let fovKick = 62;
    if (p < 0.36) fovKick = THREE.MathUtils.lerp(62, 68, p / 0.36);
    else if (p < 0.68) fovKick = THREE.MathUtils.lerp(68, 84, (p - 0.36) / 0.32);
    else fovKick = THREE.MathUtils.lerp(84, 58, Math.min(1, (p - 0.68) / 0.14));
    officeCamera.fov = fovKick;
    officeCamera.updateProjectionMatrix();

    const camShake = p < 0.36 ? 0.035 : p < 0.66 ? 0.075 : 0.24;
    officeCamera.rotation.order = 'YXZ';
    officeCamera.rotation.z = (Math.random() - 0.5) * camShake;
    officeCamera.rotation.x = game.lookCurrentY + (Math.random() - 0.5) * camShake * 0.85;
    officeCamera.rotation.y = game.lookCurrentX + (Math.random() - 0.5) * camShake * 0.65;

    world.officeLamp.intensity = 0.25;
    const strobe = Math.random();
    if (p > 0.66 && p < 0.74) {
      world.jumpscareLight.color.setHex(0xff1118);
      world.jumpscareLight.intensity = 13.0;
    } else if (strobe < 0.12) {
      world.jumpscareLight.intensity = 0.4;
    } else {
      world.jumpscareLight.color.setHex(strobe > 0.42 ? 0xfff0d6 : 0xff2228);
      world.jumpscareLight.intensity = 7.5 + Math.random() * 5.5;
    }

    if (game.jumpscareElapsed >= game.jumpscareDuration) {
      game.mode = 'GAMEOVER';
      world.jumpscareLight.intensity = 0;
      officeCamera.rotation.z = 0;
      officeCamera.near = 0.1;
      officeCamera.fov = 62;
      officeCamera.updateProjectionMatrix();
      const whoName = game.jumpscareWho === 'bonnie' ? 'SpringBonnie' : 'SpringFreddy';
      document.getElementById('gameover-report').textContent =
        `RELATÓRIO DE INCIDENTE #83: O vigia foi capturado por ${whoName} às ${game.hour === 0 ? '12' : game.hour}:00 AM. Traumas cranianos compatíveis com mordida hidráulica Springlock.`;
      ui.showScreen('gameover-screen');
    }
  }

  if (game.mode === 'MENU' || game.mode === 'NEWSPAPER') {
    const ct = CAM_TRANSFORMS[0];
    cctvCamera.position.set(ct.pos[0] + Math.sin(elapsed * 0.4) * 0.55, ct.pos[1] - 0.65, ct.pos[2] + 0.8);
    cctvCamera.lookAt(0, 1.55, -22.6);
    const fTwitch = Math.sin(elapsed * 3.1) > 0.92 ? 0.6 : 0.04;
    const bTwitch = Math.sin(elapsed * 2.3) > 0.94 ? 0.7 : 0.05;
    applyAnimatronicPose(world.freddyRig, 'STAGE', elapsed, fTwitch, Math.sin(elapsed * 0.7) > 0.96);
    applyAnimatronicPose(world.bonnieRig, 'STAGE', elapsed + 1.2, bTwitch, Math.cos(elapsed * 0.6) > 0.97);
    world.cctvRoomLight.intensity = 5.4 * game.flickerIntensity;
  } else if (game.mode === 'JUMPSCARE') {
    const jp = THREE.MathUtils.clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);
    applyAnimatronicPose(world.freddyRig, 'JUMPSCARE', elapsed, 0.95, true, null, jp);
    applyAnimatronicPose(world.bonnieRig, 'JUMPSCARE', elapsed, 0.95, true, null, jp);
  } else {
    const camDirF = new THREE.Vector3().subVectors(cctvCamera.position, world.freddyRig.root.position);
    const camDirB = new THREE.Vector3().subVectors(cctvCamera.position, world.bonnieRig.root.position);
    applyAnimatronicPose(world.freddyRig, animState.freddy.pose, elapsed, animState.freddy.twitch, animState.freddy.darkEyes, game.monitorOpen ? camDirF : null);
    applyAnimatronicPose(world.bonnieRig, animState.bonnie.pose, elapsed + 0.8, animState.bonnie.twitch, animState.bonnie.darkEyes, game.monitorOpen ? camDirB : null);
    if (game.mode === 'POWEROUT') {
      world.freddyRig.pupilMat.emissiveIntensity = game.powerOutEyeGlow || 0;
    }
  }

  controller.syncAnimatronicWorldPositions();

  const useCCTV = (game.mode === 'MENU' || game.mode === 'NEWSPAPER' || (game.mode === 'PLAYING' && game.monitorOpen));
  if (game.mode === 'PLAYING' && game.monitorOpen) {
    const ct = CAM_TRANSFORMS[game.activeCam];
    const panOffset = Math.sin(elapsed * 0.55) * 0.35;
    cctvCamera.position.set(ct.pos[0], ct.pos[1], ct.pos[2]);
    cctvCamera.lookAt(ct.look[0] + panOffset, ct.look[1], ct.look[2]);
    const cfg = ROOM_LIGHT_CFGS[game.activeCam];
    if (game.camFlashAlpha > 0.05) {
      world.cctvRoomLight.color.setHex(0xffffff);
      world.cctvRoomLight.intensity = THREE.MathUtils.lerp(cfg.intensity, 22, game.camFlashAlpha);
    } else {
      world.cctvRoomLight.color.setHex(cfg.color);
      world.cctvRoomLight.intensity = cfg.intensity * (game.activeCam >= 2 ? game.flickerIntensity : 1.0);
    }
  }

  const activeCamera = useCCTV ? cctvCamera : officeCamera;

  if (crtPass) {
    crtPass.uniforms.uTime.value = elapsed;
    crtPass.uniforms.uIsCCTV.value = (game.mode === 'PLAYING' && game.monitorOpen) ? 1.0 : 0.0;
    crtPass.uniforms.uGlitch.value = game.mode === 'JUMPSCARE'
      ? (0.55 + game.biteFlash * 0.45)
      : Math.min(1.0, game.staticBurst + game.camMoveGlitch + (game.mode === 'MENU' ? 0.08 : 0));
    crtPass.uniforms.uPowerOut.value = game.mode === 'POWEROUT' ? 1.0 : 0.0;
    crtPass.uniforms.uDanger.value = game.dangerLevel;
    crtPass.uniforms.uBiteFlash.value = game.biteFlash;
  }

  if (composer) {
    composer.passes[0].camera = activeCamera;
    composer.render();
  } else {
    renderer.render(scene, activeCamera);
  }

  hud.updatePixiHUD(dt, elapsed);
}

(function boot() {
  const bar = document.getElementById('loader-bar');
  const sub = document.getElementById('loader-sub');
  const steps = [
    [28, 'COMPILANDO TEXTURAS PBR, NORMAL MAPS & DUTO 3D...'],
    [62, 'ESCULPINDO SPRINGFREDDY & SPRINGBONNIE SPRINGLOCK...'],
    [90, 'CARREGANDO ÁUDIOS (PHONE_GUY N1–N5, JINGLE.MP3 & JUMPSCARE.MP3)...'],
    [100, 'TURNO NOTURNO PRONTO.']
  ];
  let i = 0;
  const timer = setInterval(() => {
    if (i < steps.length) {
      bar.style.width = steps[i][0] + '%';
      sub.textContent = steps[i][1];
      i++;
    } else {
      clearInterval(timer);
      ui.returnToMenu();
      requestAnimationFrame(animate);
    }
  }, 210);
})();
