import * as THREE from 'three';
import {
  CAM_TRANSFORMS,
  ROOM_LIGHT_CFGS,
  FREDDY_SPOTS,
  BONNIE_SPOTS,
  saveState,
  persistSave,
  game,
  animState
} from './config.js';
import { audio } from './audio.js';

export function createGameController({ world, officeCamera, refreshMenuStars, showScreen }) {
  const _tmpMouthWorld = new THREE.Vector3();
  const _camFwd = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camUp = new THREE.Vector3();
  const _desiredMouth = new THREE.Vector3();

  function updateRoomLightVisibility() {
    if (game.mode === 'MENU' || game.mode === 'NEWSPAPER') {
      const cfg = ROOM_LIGHT_CFGS[0];
      world.cctvRoomLight.color.setHex(cfg.color);
      world.cctvRoomLight.distance = cfg.dist;
      world.cctvRoomLight.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      world.cctvRoomLight.intensity = cfg.intensity;
    } else if (game.mode === 'PLAYING' && game.monitorOpen) {
      const cfg = ROOM_LIGHT_CFGS[game.activeCam];
      world.cctvRoomLight.color.setHex(cfg.color);
      world.cctvRoomLight.distance = cfg.dist;
      world.cctvRoomLight.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      world.cctvRoomLight.intensity = cfg.intensity;
    } else {
      world.cctvRoomLight.intensity = 0;
    }
  }

  function startJumpscare(who, origin = 'DOOR_L') {
    if (game.mode === 'JUMPSCARE' || game.mode === 'WIN' || game.mode === 'GAMEOVER') return;
    game.mode = 'JUMPSCARE';
    game.monitorOpen = false;
    game.jumpscareWho = who;
    game.jumpscareOrigin = origin;
    game.jumpscareElapsed = 0;
    game.jumpscareBiteDone = false;
    game.biteFlash = 0;
    officeCamera.near = 0.03;
    officeCamera.updateProjectionMatrix();
    updateRoomLightVisibility();
    audio.stopPhoneCall();
    audio.stopAudioLure();
    audio.setFanActive(false);
    audio.setLightBuzz(false);
    audio.setDreadLevel(0);
    audio.playJumpscare();
    world.jumpscareLight.intensity = 9.0;
  }

  function toggleDoor(side) {
    if (game.mode !== 'PLAYING' || game.monitorOpen) return;
    if (side === 'L') {
      game.doorL = !game.doorL;
      audio.playDoorSlam(game.doorL);
      world.panelL.dMat.emissive.setHex(game.doorL ? 0x00ff44 : 0x550000);
      world.panelL.dMat.color.setHex(game.doorL ? 0x11cc44 : 0xaa1111);
      gsap.to(world.doorMeshL.position, { y: game.doorL ? 1.19 : 3.55, duration: 0.16, ease: 'power3.out' });
    } else {
      game.doorR = !game.doorR;
      audio.playDoorSlam(game.doorR);
      world.panelR.dMat.emissive.setHex(game.doorR ? 0x00ff44 : 0x550000);
      world.panelR.dMat.color.setHex(game.doorR ? 0x11cc44 : 0xaa1111);
      gsap.to(world.doorMeshR.position, { y: game.doorR ? 1.19 : 3.55, duration: 0.16, ease: 'power3.out' });
    }
  }

  function toggleLight(side) {
    if (game.mode !== 'PLAYING' || game.monitorOpen) return;
    audio.playClick(760);
    if (side === 'L') {
      game.lightL = !game.lightL;
      if (game.lightL) game.lightR = false;
    } else {
      game.lightR = !game.lightR;
      if (game.lightR) game.lightL = false;
    }
    world.panelL.lMat.emissive.setHex(game.lightL ? 0xffffff : 0x222222);
    world.panelR.lMat.emissive.setHex(game.lightR ? 0xffffff : 0x222222);
    audio.setLightBuzz(game.lightL || game.lightR);

    if (game.lightL && animState.freddy.loc === 'BLIND_L' && !animState.freddy.spottedAtDoor) {
      animState.freddy.spottedAtDoor = true;
      audio.playSpottedSting();
    }
    if (game.lightR && animState.bonnie.loc === 'BLIND_R' && !animState.bonnie.spottedAtDoor) {
      animState.bonnie.spottedAtDoor = true;
      audio.playSpottedSting();
    }
  }

  function toggleVent() {
    if (game.mode !== 'PLAYING' || game.monitorOpen) return;
    game.ventSealed = !game.ventSealed;
    audio.playVentSlam();
    world.ventBtnMat.emissive.setHex(game.ventSealed ? 0x00ff66 : 0x552200);
    world.ventBtnMat.color.setHex(game.ventSealed ? 0x22cc55 : 0xb87414);
    gsap.to(world.ventShutter.position, { x: game.ventSealed ? 0 : -1.32, duration: 0.14, ease: 'power2.out' });
  }

  function toggleMonitor(forceState = null) {
    if (game.mode !== 'PLAYING') return;
    const next = forceState !== null ? forceState : !game.monitorOpen;
    if (next === game.monitorOpen) return;
    game.monitorOpen = next;
    game.staticBurst = 0.65;
    audio.playCamStatic(0.18, -12);
    audio.playClick(next ? 1100 : 620);

    if (next) {
      game.lightL = false;
      game.lightR = false;
      game.flashlightOn = false;
      world.panelL.lMat.emissive.setHex(0x222222);
      world.panelR.lMat.emissive.setHex(0x222222);
      audio.setLightBuzz(false);
    }
    updateRoomLightVisibility();
  }

  function switchCamera(idx) {
    if (game.mode !== 'PLAYING' || !game.monitorOpen || idx === game.activeCam) return;
    game.activeCam = idx;
    game.staticBurst = 0.55;
    audio.playClick(980);
    audio.playCamStatic(0.11, -16);
    updateRoomLightVisibility();
  }

  function triggerAudioLure() {
    if (game.mode !== 'PLAYING' || !game.monitorOpen || game.audioLureCooldown > 0) return;
    const target = game.activeCam;
    game.audioLureCooldown = 7.5;
    game.lurePingCam = target;
    game.lurePingTimer = 2.0;
    audio.playAudioLure();

    const freddyAdj = { 0: [1], 1: [0, 2], 2: [1, 4], 4: [1, 2], BLIND_L: [4] };
    if (freddyAdj[animState.freddy.loc]?.includes(target)) {
      animState.freddy.loc = target;
      animState.freddy.patience = 0;
      animState.freddy.spottedAtDoor = false;
      animState.freddy.moveTimer += 4.5;
      game.camMoveGlitch = 0.5;
      audio.playFootstep(-0.5, true);
    }

    const bonnieAdj = { 0: [1], 1: [0, 3], 3: [1, 5, 6], 5: [1, 3], 6: [3, 5], BLIND_R: [5], VENT_OFFICE: [6] };
    if (bonnieAdj[animState.bonnie.loc]?.includes(target)) {
      animState.bonnie.loc = target;
      animState.bonnie.patience = 0;
      animState.bonnie.spottedAtDoor = false;
      animState.bonnie.spottedAtVent = false;
      animState.bonnie.ventCreep = 0;
      animState.bonnie.moveTimer += 4.5;
      game.camMoveGlitch = 0.5;
      audio.playFootstep(0.5, false);
    }
  }

  function triggerCameraFlash() {
    if (game.mode !== 'PLAYING' || !game.monitorOpen || game.flashCooldown > 0) return;
    game.flashCooldown = 6.0;
    game.camFlashAlpha = 1.0;
    game.power = Math.max(0, game.power - 0.8);
    audio.playFlashBulb();

    const ct = CAM_TRANSFORMS[game.activeCam];
    world.cctvRoomLight.position.set(ct.pos[0], ct.pos[1], ct.pos[2]);
    world.cctvRoomLight.color.setHex(0xffffff);
    world.cctvRoomLight.intensity = 22;

    if (animState.freddy.loc === game.activeCam) {
      animState.freddy.stunTimer = 6.5;
      animState.freddy.twitch = 0.9;
      audio.playServoTwitch(-0.4);
    }
    if (animState.bonnie.loc === game.activeCam) {
      animState.bonnie.stunTimer = 4.5;
      animState.bonnie.twitch = 0.9;
      audio.playServoTwitch(0.4);
    }
  }

  function updateAnimatronics(dt) {
    const f = animState.freddy;
    f.twitch = Math.max(0, f.twitch - dt * 1.4);
    if (f.stunTimer > 0) {
      f.stunTimer -= dt;
    } else if (game.freddyAI > 0) {
      if (f.loc === 'BLIND_L') {
        f.patience += dt * (0.7 + game.freddyAI * 0.045);
        if (game.doorL) {
          if (f.patience > 4.0) {
            audio.playDoorBang(-0.85);
            game.cameraShake = 0.22;
            f.loc = Math.random() < 0.6 ? 4 : 1;
            f.patience = 0;
            f.spottedAtDoor = false;
            f.moveTimer = Math.max(3.5, 9 - game.freddyAI * 0.26);
          }
        } else {
          const threshold = Math.max(3.1, 6.2 - game.freddyAI * 0.14);
          if ((f.patience > threshold && !game.monitorOpen) || f.patience > threshold + 2.4) {
            startJumpscare('freddy', 'DOOR_L');
            return;
          }
        }
      } else {
        f.moveTimer -= dt;
        if (f.moveTimer <= 0) {
          const baseWait = Math.max(2.8, 11.5 - game.freddyAI * 0.42);
          f.moveTimer = baseWait * (0.75 + Math.random() * 0.5);
          if (Math.random() * 20 <= game.freddyAI) {
            const oldLoc = f.loc;
            if (f.loc === 0) f.loc = 1;
            else if (f.loc === 1) f.loc = Math.random() < 0.65 ? 2 : 4;
            else if (f.loc === 2) f.loc = 4;
            else if (f.loc === 4) {
              f.loc = 'BLIND_L';
              f.patience = 0;
              f.spottedAtDoor = false;
              f.darkEyes = Math.random() < 0.50;
            }
            if (f.loc !== oldLoc) {
              audio.playFootstep(-0.75, true);
              if (f.loc === 2 || f.loc === 4) audio.playFredbearLaugh();
              if (typeof f.loc === 'number') {
                game.soundSensorCam = f.loc;
                game.soundSensorTimer = 2.5;
              }
              if (game.monitorOpen && (game.activeCam === oldLoc || game.activeCam === f.loc)) {
                game.camMoveGlitch = 0.9;
                audio.playCamStatic(0.24, -10);
              }
            }
          }
        }
      }
    }

    const b = animState.bonnie;
    b.twitch = Math.max(0, b.twitch - dt * 1.4);
    if (b.stunTimer > 0) {
      b.stunTimer -= dt;
    } else if (game.bonnieAI > 0) {
      if (b.loc === 'BLIND_R') {
        b.patience += dt * (0.75 + game.bonnieAI * 0.048);
        if (game.doorR) {
          if (b.patience > 3.7) {
            audio.playDoorBang(0.85);
            game.cameraShake = 0.22;
            b.loc = Math.random() < 0.55 ? 5 : 3;
            b.patience = 0;
            b.spottedAtDoor = false;
            b.moveTimer = Math.max(3.2, 8.5 - game.bonnieAI * 0.25);
          }
        } else {
          const threshold = Math.max(2.9, 5.8 - game.bonnieAI * 0.13);
          if ((b.patience > threshold && !game.monitorOpen) || b.patience > threshold + 2.2) {
            startJumpscare('bonnie', 'DOOR_R');
            return;
          }
        }
      } else if (b.loc === 'VENT_OFFICE') {
        b.patience += dt * (0.8 + game.bonnieAI * 0.045);
        const ventThresh = Math.max(3.4, 6.8 - game.bonnieAI * 0.14);
        b.ventCreep = THREE.MathUtils.lerp(b.ventCreep, Math.min(1, Math.max(0, b.patience / ventThresh)), dt * 2.5);

        const lookingAtVent = game.flashlightOn && game.lookCurrentY > 0.24 && Math.abs(game.lookCurrentX) < 0.38;
        if (lookingAtVent && !game.ventSealed) {
          if (!b.spottedAtVent) {
            b.spottedAtVent = true;
            audio.playSpottedSting();
          }
          b.patience -= dt * 2.4;
          b.twitch = 0.65;
          if (b.patience < -1.0) {
            audio.playVentScrape();
            b.loc = 6;
            b.patience = 0;
            b.ventCreep = 0;
            b.spottedAtVent = false;
            b.moveTimer = Math.max(3.5, 8.0 - game.bonnieAI * 0.22);
            return;
          }
        }

        if (game.ventSealed) {
          if (b.patience > 3.5) {
            audio.playVentScrape();
            game.cameraShake = 0.16;
            b.loc = 6;
            b.patience = 0;
            b.ventCreep = 0;
            b.spottedAtVent = false;
            b.moveTimer = Math.max(3.5, 8.5 - game.bonnieAI * 0.22);
          }
        } else {
          if ((b.patience > ventThresh && !game.monitorOpen) || b.patience > ventThresh + 2.5) {
            startJumpscare('bonnie', 'VENT');
            return;
          }
        }
      } else {
        b.moveTimer -= dt;
        if (b.moveTimer <= 0) {
          const baseWait = Math.max(2.6, 10.8 - game.bonnieAI * 0.40);
          b.moveTimer = baseWait * (0.75 + Math.random() * 0.5);
          if (Math.random() * 20 <= game.bonnieAI) {
            const oldLoc = b.loc;
            if (b.loc === 0) b.loc = 1;
            else if (b.loc === 1) b.loc = 3;
            else if (b.loc === 3) b.loc = Math.random() < 0.45 ? 6 : 5;
            else if (b.loc === 5) {
              if (Math.random() < 0.35) {
                b.loc = 6;
                audio.playVentScrape();
              } else {
                b.loc = 'BLIND_R';
                b.patience = 0;
                b.spottedAtDoor = false;
                b.darkEyes = Math.random() < 0.50;
              }
            } else if (b.loc === 6) {
              b.loc = 'VENT_OFFICE';
              b.patience = 0;
              b.ventCreep = 0;
              b.spottedAtVent = false;
              audio.playVentScrape();
            }
            if (b.loc !== oldLoc) {
              if (b.loc !== 6 && b.loc !== 'VENT_OFFICE') audio.playFootstep(0.75, false);
              if (typeof b.loc === 'number') {
                game.soundSensorCam = b.loc;
                game.soundSensorTimer = 2.5;
              }
              if (game.monitorOpen && (game.activeCam === oldLoc || game.activeCam === b.loc)) {
                game.camMoveGlitch = 0.9;
                audio.playCamStatic(0.24, -10);
              }
            }
          }
        }
      }
    }

    game.breathTimer -= dt;
    if (game.breathTimer <= 0) {
      if (f.loc === 'BLIND_L' && !game.doorL) {
        audio.playRaspyBreath(-0.85);
        game.breathTimer = 2.2;
      } else if (b.loc === 'BLIND_R' && !game.doorR) {
        audio.playRaspyBreath(0.85);
        game.breathTimer = 2.2;
      } else if (b.loc === 'VENT_OFFICE' && !game.ventSealed) {
        audio.playRaspyBreath(0.0);
        game.breathTimer = 2.0;
      }
    }

    let d = 0;
    if (f.loc === 4) d += 0.22;
    if (f.loc === 'BLIND_L' && !game.doorL) d += 0.58;
    if (b.loc === 5 || b.loc === 6) d += 0.22;
    if (b.loc === 'BLIND_R' && !game.doorR) d += 0.58;
    if (b.loc === 'VENT_OFFICE' && !game.ventSealed) d += 0.65;
    game.dangerLevel = THREE.MathUtils.lerp(game.dangerLevel, Math.min(1, d), dt * 3.2);
    audio.setDreadLevel(game.dangerLevel);

    if (game.dangerLevel > 0.52) {
      game.heartbeatTimer -= dt;
      if (game.heartbeatTimer <= 0) {
        audio.playHeartbeat(1 + game.dangerLevel * 0.65);
        game.heartbeatTimer = Math.max(0.42, 1.1 - game.dangerLevel * 0.58);
      }
      if (Math.random() < dt * 0.08 && game.hallucinationTimer <= 0) {
        const lines = ['SOU EU', 'ELES OUVEM VOCÊ', 'NÃO RESPIRE', 'TRAVAS SOLTAS', '1983'];
        game.hallucinationText = lines[Math.floor(Math.random() * lines.length)];
        game.hallucinationTimer = 0.12;
        audio.playCamStatic(0.09, -15);
      }
    }
  }

  function triggerPowerOutage() {
    game.mode = 'POWEROUT';
    game.monitorOpen = false;
    game.doorL = false;
    game.doorR = false;
    game.lightL = false;
    game.lightR = false;
    game.ventSealed = false;
    game.flashlightOn = false;

    gsap.to(world.doorMeshL.position, { y: 3.55, duration: 0.45 });
    gsap.to(world.doorMeshR.position, { y: 3.55, duration: 0.45 });
    gsap.to(world.ventShutter.position, { x: -1.32, duration: 0.45 });

    world.panelL.dMat.emissive.setHex(0);
    world.panelR.dMat.emissive.setHex(0);
    world.panelL.lMat.emissive.setHex(0);
    world.panelR.lMat.emissive.setHex(0);
    world.ventBtnMat.emissive.setHex(0);

    audio.stopPhoneCall();
    audio.stopAudioLure();
    audio.setFanActive(false);
    audio.setLightBuzz(false);
    audio.setDreadLevel(0.6);
    audio.playDoorSlam(false);
    updateRoomLightVisibility();

    world.officeLamp.intensity = 0;
    world.crtDeskGlow.intensity = 0;
    world.bulbMesh.visible = false;
    world.officeVolCone.visible = false;
    world.crtScreenMat.emissiveIntensity = 0;
    animState.freddy.darkEyes = true;
    animState.freddy.pose = 'BLINDSPOT';
    game.powerOutPhase = 0;
    game.powerOutTimer = 2.0;
    game.musicStep = 0;
    game.powerOutEyeGlow = 0;
  }

  function updatePowerOutage(dt) {
    game.powerOutTimer -= dt;
    if (game.powerOutPhase === 0) {
      if (game.powerOutTimer <= 0) {
        game.powerOutPhase = 1;
        game.powerOutTimer = 0.4;
        game.musicStep = 0;
      }
    } else if (game.powerOutPhase === 1) {
      if (game.powerOutTimer <= 0) {
        audio.playMusicBoxStep(game.musicStep++);
        const flash = game.musicStep % 2 === 0;
        game.powerOutEyeGlow = flash ? 6.8 : 0.15;
        world.hallLightL.intensity = flash ? 2.1 : 0.0;
        game.powerOutTimer = 0.46;
        if (game.musicStep >= 10 + Math.floor(Math.random() * 6)) {
          game.powerOutPhase = 2;
          world.hallLightL.intensity = 0;
          game.powerOutEyeGlow = 0;
          game.powerOutTimer = 1.6 + Math.random() * 2.2;
        }
      }
    } else if (game.powerOutPhase === 2) {
      if (game.powerOutTimer <= 0) {
        game.powerOutEyeGlow = 5.5;
        startJumpscare('freddy', 'DOOR_L');
      }
    }
  }

  function triggerWin6AM() {
    game.mode = 'WIN';
    game.monitorOpen = false;
    audio.stopPhoneCall();
    audio.stopAudioLure();
    audio.setFanActive(false);
    audio.setLightBuzz(false);
    audio.setDreadLevel(0);
    audio.play6AMChime();

    if (!game.isCustom) {
      if (game.night >= saveState.unlockedNight && game.night < 5) saveState.unlockedNight = game.night + 1;
      if (!saveState.stars.includes(game.night)) saveState.stars.push(game.night);
    } else if (game.freddyAI === 20 && game.bonnieAI === 20) {
      if (!saveState.stars.includes(6)) saveState.stars.push(6);
    }
    persistSave();
    refreshMenuStars();

    const winClock = document.getElementById('win-clock');
    const winSub = document.getElementById('win-sub');
    const nextBtn = document.getElementById('btn-next-night');

    winClock.textContent = '5:59 AM';
    winSub.textContent = game.isCustom
      ? `NOITE CUSTOMIZADA (${game.freddyAI}/${game.bonnieAI}) CONCLUÍDA!`
      : `NOITE ${game.night} CONCLUÍDA — TURNO SEGURO`;
    nextBtn.style.display = (!game.isCustom && game.night < 5) ? 'inline-flex' : 'none';

    showScreen('win-screen');
    setTimeout(() => {
      winClock.textContent = '6:00 AM';
      gsap.fromTo(winClock, { scale: 1.3 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    }, 950);
  }

  function syncAnimatronicWorldPositions() {
    if (game.mode === 'MENU' || game.mode === 'NEWSPAPER') {
      world.freddyRig.root.position.set(-0.90, 0.46, -22.6);
      world.freddyRig.root.rotation.set(0, 0.26, 0);
      world.bonnieRig.root.position.set(0.90, 0.46, -22.6);
      world.bonnieRig.root.rotation.set(0, -0.26, 0);
      return;
    }

    if (game.mode === 'POWEROUT') {
      world.freddyRig.root.position.set(-2.15, 0.0, -0.35);
      world.freddyRig.root.rotation.set(0, 1.18, 0);
      world.bonnieRig.root.position.set(20, -10, 20);
      return;
    }

    if (game.mode === 'JUMPSCARE') {
      const attacker = game.jumpscareWho === 'bonnie' ? world.bonnieRig : world.freddyRig;
      const other = game.jumpscareWho === 'bonnie' ? world.freddyRig : world.bonnieRig;
      other.root.position.set(20, -10, 20);

      const p = THREE.MathUtils.clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);

      let dist = 1.65;
      if (p < 0.10) {
        const u = p / 0.10;
        dist = THREE.MathUtils.lerp(1.65, 0.78, 1 - Math.pow(1 - u, 3));
      } else if (p < 0.36) {
        const u = (p - 0.10) / 0.26;
        dist = THREE.MathUtils.lerp(0.78, 0.58, u);
      } else if (p < 0.66) {
        const u = (p - 0.36) / 0.30;
        dist = THREE.MathUtils.lerp(0.58, 0.20, u * u);
      } else {
        dist = 0.20;
      }

      const originBlend = 1 - THREE.MathUtils.clamp(p / 0.16, 0, 1);
      let sideOff = 0;
      let vertOff = 0;
      if (game.jumpscareOrigin === 'DOOR_L') sideOff = -0.58 * originBlend;
      else if (game.jumpscareOrigin === 'DOOR_R') sideOff = 0.58 * originBlend;
      else if (game.jumpscareOrigin === 'VENT') vertOff = 0.48 * originBlend;

      const chompDip = p > 0.52 ? THREE.MathUtils.lerp(0, -0.025, Math.min(1, (p - 0.52) / 0.14)) : 0;

      _camFwd.set(0, 0, -1).applyQuaternion(officeCamera.quaternion);
      _camRight.set(1, 0, 0).applyQuaternion(officeCamera.quaternion);
      _camUp.set(0, 1, 0).applyQuaternion(officeCamera.quaternion);

      attacker.root.rotation.set(0, officeCamera.rotation.y, 0);
      attacker.root.position.set(0, 0, 0);
      attacker.root.updateMatrixWorld(true);

      attacker.mouthAnchor.getWorldPosition(_tmpMouthWorld);

      _desiredMouth.copy(officeCamera.position)
        .addScaledVector(_camFwd, dist)
        .addScaledVector(_camRight, sideOff)
        .addScaledVector(_camUp, vertOff + chompDip);

      attacker.root.position.sub(_tmpMouthWorld).add(_desiredMouth);

      world.jumpscareLight.position.copy(officeCamera.position)
        .addScaledVector(_camFwd, Math.min(0.14, dist * 0.5))
        .addScaledVector(_camUp, 0.08);
      return;
    }

    const fSpot = FREDDY_SPOTS[animState.freddy.loc] || FREDDY_SPOTS[0];
    world.freddyRig.root.position.set(fSpot.x, fSpot.y, fSpot.z);
    world.freddyRig.root.rotation.set(0, fSpot.ry, 0);
    animState.freddy.pose = fSpot.pose;

    const bSpot = BONNIE_SPOTS[animState.bonnie.loc] || BONNIE_SPOTS[0];
    let bZ = bSpot.z;
    if (animState.bonnie.loc === 'VENT_OFFICE') {
      bZ = THREE.MathUtils.lerp(-4.30, -3.55, THREE.MathUtils.clamp(animState.bonnie.ventCreep, 0, 1));
    }
    world.bonnieRig.root.position.set(bSpot.x, bSpot.y, bZ);
    world.bonnieRig.root.rotation.set(0, bSpot.ry, 0);
    animState.bonnie.pose = bSpot.pose;
  }

  return {
    toggleDoor,
    toggleLight,
    toggleVent,
    toggleMonitor,
    switchCamera,
    triggerAudioLure,
    triggerCameraFlash,
    updateRoomLightVisibility,
    updateAnimatronics,
    triggerPowerOutage,
    updatePowerOutage,
    startJumpscare,
    triggerWin6AM,
    syncAnimatronicWorldPositions
  };
}
