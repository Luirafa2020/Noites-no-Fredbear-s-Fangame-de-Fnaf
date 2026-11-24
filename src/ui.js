import * as THREE from 'three';
import { NIGHT_CONFIGS, PHONE_TRACKS, saveState, persistSave, game, animState } from './config.js';
import { audio } from './audio.js';

let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

export function setupUI({ world, hud, controller, renderer, officeCamera, cctvCamera, composer, bloomPass }) {
  const screens = document.querySelectorAll('.screen');
  const dialogs = document.querySelectorAll('dialog.horror-dialog');
  const nightDialog = document.getElementById('night-modal');
  const customDialog = document.getElementById('custom-modal');
  const controlsDialog = document.getElementById('controls-modal');
  const keysDown = new Set();

  function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
  }

  function openDialog(dialog) {
    dialog.removeAttribute('data-closing');
    if (!dialog.open) dialog.showModal();
  }

  async function closeTopLayer(dialog) {
    if (!dialog.open) return;
    if (!supportsTopLayerExit()) {
      dialog.setAttribute('data-closing', '');
      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map(a => a.finished)),
          new Promise(r => setTimeout(r, 400))
        ]);
      }
      if (!dialog.hasAttribute('data-closing')) return;
      dialog.removeAttribute('data-closing');
    }
    dialog.close();
  }

  function closeAllModals() {
    dialogs.forEach(d => {
      if (d.open) closeTopLayer(d);
    });
  }

  // Fallback for browsers without <dialog closedby="any">
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', e => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', e => {
        if (pressedOutside && outside(e, dialog)) closeTopLayer(dialog);
      });
    }
  }

  dialogs.forEach(dialog => {
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeTopLayer(dialog);
    });
  });

  controlsDialog.addEventListener('close', () => {
    controlsDialog.returnValue = '';
    if (game.mode === 'PAUSED') {
      game.mode = 'PLAYING';
      audio.setFanActive(true);
      audio.resumePhoneCall();
    }
  });

  function refreshMenuStars() {
    document.querySelectorAll('#stars-row .star-badge').forEach(el => {
      el.classList.toggle('earned', saveState.stars.includes(Number(el.dataset.star)));
    });
    document.getElementById('continue-tag').textContent = `NOITE ${saveState.unlockedNight}`;

    const grid = document.getElementById('night-grid');
    grid.innerHTML = '';
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-horror';
      const unlocked = n <= saveState.unlockedNight || saveState.stars.includes(n - 1);
      b.disabled = !unlocked && n > 1;
      b.innerHTML = `<span>NOITE ${n}</span><span class="btn-tag">${unlocked || n === 1 ? 'LIBERADA' : 'BLOQ.'}</span>`;
      b.onclick = () => {
        closeAllModals();
        startNight(n, false);
      };
      grid.appendChild(b);
    }
  }

  function startNight(nightNum, custom = false, customF = 10, customB = 10) {
    audio.init();
    audio.stopPhoneCall();
    audio.stopAudioLure();

    game.night = nightNum;
    game.isCustom = custom;
    if (custom) {
      game.freddyAI = customF;
      game.bonnieAI = customB;
    } else {
      const cfg = NIGHT_CONFIGS[nightNum] || NIGHT_CONFIGS[1];
      game.freddyAI = cfg.freddyAI;
      game.bonnieAI = cfg.bonnieAI;
      audio.preparePhoneTrack(nightNum);
    }

    game.hour = 0;
    game.nightElapsed = 0;
    game.power = 100;
    game.flashlightPower = 100;
    game.monitorOpen = false;
    game.activeCam = 0;
    game.doorL = false;
    game.doorR = false;
    game.lightL = false;
    game.lightR = false;
    game.ventSealed = false;
    game.flashlightOn = false;
    game.audioLureCooldown = 0;
    game.flashCooldown = 0;
    game.lurePingTimer = 0;
    game.soundSensorTimer = 0;
    game.dangerLevel = 0;
    game.staticBurst = 0;
    game.camMoveGlitch = 0;
    game.hallucinationTimer = 0;
    game.cameraShake = 0;
    game.biteFlash = 0;
    game.powerOutEyeGlow = 0;
    game.phoneMuted = false;
    game.phoneActive = false;
    game.phoneElapsed = 0;
    officeCamera.near = 0.1;
    officeCamera.fov = 62;
    officeCamera.updateProjectionMatrix();

    world.doorMeshL.position.y = 3.55;
    world.doorMeshR.position.y = 3.55;
    world.ventShutter.position.x = -1.32;
    world.panelL.dMat.emissive.setHex(0x550000);
    world.panelL.dMat.color.setHex(0xaa1111);
    world.panelR.dMat.emissive.setHex(0x550000);
    world.panelR.dMat.color.setHex(0xaa1111);
    world.panelL.lMat.emissive.setHex(0x222222);
    world.panelR.lMat.emissive.setHex(0x222222);
    world.ventBtnMat.emissive.setHex(0x552200);
    world.ventBtnMat.color.setHex(0xb87414);
    world.officeLamp.intensity = 2.25;
    world.crtDeskGlow.intensity = 0.58;
    world.bulbMesh.visible = true;
    world.officeVolCone.visible = true;
    world.crtScreenMat.emissiveIntensity = 1.2;
    world.jumpscareLight.intensity = 0;

    animState.freddy = { loc: 0, moveTimer: 7 + Math.random() * 4, patience: 0, stunTimer: 0, pose: 'STAGE', spottedAtDoor: false, twitch: 0, darkEyes: false };
    animState.bonnie = { loc: 0, moveTimer: 9 + Math.random() * 4, patience: 0, stunTimer: 0, pose: 'STAGE', spottedAtDoor: false, spottedAtVent: false, twitch: 0, darkEyes: false, ventCreep: 0 };

    document.getElementById('splash-night-label').textContent = custom
      ? `NOITE CUSTOMIZADA (${game.freddyAI}/${game.bonnieAI})`
      : `NOITE ${game.night}`;

    game.mode = 'SPLASH';
    showScreen('night-splash');
    audio.playClick(420);

    setTimeout(() => {
      if (game.mode !== 'SPLASH') return;
      showScreen(null);
      game.mode = 'PLAYING';
      audio.setFanActive(true);
      controller.updateRoomLightVisibility();
      if (!custom && PHONE_TRACKS[game.night]) {
        audio.playPhoneBeep();
        audio.startPhoneCall(game.night);
      }
    }, 2100);
  }

  function returnToMenu() {
    game.mode = 'MENU';
    game.monitorOpen = false;
    game.biteFlash = 0;
    game.powerOutEyeGlow = 0;
    officeCamera.near = 0.1;
    officeCamera.fov = 62;
    officeCamera.updateProjectionMatrix();
    audio.stopPhoneCall();
    audio.stopAudioLure();
    audio.setFanActive(false);
    audio.setLightBuzz(false);
    audio.setDreadLevel(0);
    controller.updateRoomLightVisibility();
    refreshMenuStars();
    showScreen('menu-screen');
  }

  function mutePhoneCall() {
    game.phoneMuted = true;
    audio.stopPhoneCall();
    audio.playClick(540);
  }

  function openPauseModal() {
    if (game.mode === 'PLAYING') {
      game.mode = 'PAUSED';
      audio.setFanActive(false);
      audio.setLightBuzz(false);
      audio.setDreadLevel(0);
      audio.pausePhoneCall();
      document.getElementById('controls-modal-heading').textContent = 'TURNO PAUSADO — MANUAL DE SOBREVIVÊNCIA';
      document.getElementById('pause-extra-btns').style.display = 'flex';
      openDialog(controlsDialog);
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointerVec = new THREE.Vector2();

  function hitPixiContainer(c, px, py) {
    if (!c.visible) return false;
    const b = c.getBounds();
    return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
  }

  function handlePointerMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    game.mouseNormX = (e.clientX / w) * 2 - 1;
    game.mouseNormY = -(e.clientY / h) * 2 + 1;

    if (game.mode === 'PLAYING' && !game.monitorOpen) {
      game.lookTargetX = -game.mouseNormX * 0.85;
      game.lookTargetY = THREE.MathUtils.clamp(game.mouseNormY * 0.54 + 0.06, -0.22, 0.62);

      pointerVec.set(game.mouseNormX, game.mouseNormY);
      raycaster.setFromCamera(pointerVec, officeCamera);
      const hits = raycaster.intersectObjects(world.interactables, false);
      game.hoverHint = hits.length > 0 ? hits[0].object.userData.label : '';
    } else {
      game.hoverHint = '';
    }

    let overBtn = Boolean(game.hoverHint);
    if (game.mode === 'PLAYING') {
      const { flipBar, muteBtn, pauseBtn, lureBtn, flashBtn, camNodeButtons } = hud.controls;
      if (hitPixiContainer(flipBar, e.clientX, e.clientY)) overBtn = true;
      if (muteBtn.visible && hitPixiContainer(muteBtn, e.clientX, e.clientY)) overBtn = true;
      if (hitPixiContainer(pauseBtn, e.clientX, e.clientY)) overBtn = true;
      if (game.monitorOpen) {
        if (hitPixiContainer(lureBtn, e.clientX, e.clientY) || hitPixiContainer(flashBtn, e.clientX, e.clientY)) overBtn = true;
        for (const node of camNodeButtons) if (hitPixiContainer(node, e.clientX, e.clientY)) overBtn = true;
      }
    }
    document.body.style.cursor = overBtn ? 'pointer' : 'default';
  }

  function handlePointerDown(e) {
    audio.init();
    if (game.mode === 'NEWSPAPER') {
      startNight(1, false);
      return;
    }
    if (game.mode !== 'PLAYING') return;

    if (e.button === 2) {
      if (!game.monitorOpen && game.flashlightPower > 1) game.flashlightOn = true;
      return;
    }

    const px = e.clientX;
    const py = e.clientY;
    const { flipBar, muteBtn, pauseBtn, lureBtn, flashBtn, camNodeButtons } = hud.controls;
    if (muteBtn.visible && hitPixiContainer(muteBtn, px, py)) { mutePhoneCall(); return; }
    if (hitPixiContainer(pauseBtn, px, py)) { openPauseModal(); return; }
    if (hitPixiContainer(flipBar, px, py)) { controller.toggleMonitor(); return; }

    if (game.monitorOpen) {
      if (hitPixiContainer(lureBtn, px, py)) { controller.triggerAudioLure(); return; }
      if (hitPixiContainer(flashBtn, px, py)) { controller.triggerCameraFlash(); return; }
      for (const node of camNodeButtons) {
        if (hitPixiContainer(node, px, py)) { controller.switchCamera(node._camIdx); return; }
      }
      return;
    }

    pointerVec.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerVec, officeCamera);
    const hits = raycaster.intersectObjects(world.interactables, false);
    if (hits.length > 0) {
      const act = hits[0].object.userData.action;
      if (act === 'doorL') controller.toggleDoor('L');
      else if (act === 'doorR') controller.toggleDoor('R');
      else if (act === 'lightL') controller.toggleLight('L');
      else if (act === 'lightR') controller.toggleLight('R');
      else if (act === 'vent') controller.toggleVent();
      else if (act === 'plush') {
        audio.playPlushBoop();
        gsap.fromTo(world.plushGroup.scale, { y: 0.72, x: 1.18, z: 1.18 }, { y: 1, x: 1, z: 1, duration: 0.25, ease: 'elastic.out(1, 0.4)' });
      }
    }
  }

  function handlePointerUp(e) {
    if (e.button === 2) game.flashlightOn = false;
  }

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keysDown.add(k);

    if (game.mode === 'NEWSPAPER') {
      startNight(1, false);
      return;
    }
    if (e.key === 'Escape') {
      if (!document.querySelector('dialog[open]') && game.mode === 'PLAYING') {
        openPauseModal();
      }
      return;
    }
    if (game.mode !== 'PLAYING') return;

    if (e.code === 'Space' || e.key === 'Tab') { e.preventDefault(); controller.toggleMonitor(); }
    else if (k === 'q') controller.toggleDoor('L');
    else if (k === 'e') controller.toggleDoor('R');
    else if (k === 'z') controller.toggleLight('L');
    else if (k === 'c') controller.toggleLight('R');
    else if (k === 'v') controller.toggleVent();
    else if (k === 'm') mutePhoneCall();
    else if (k === 'f' && !game.monitorOpen && game.flashlightPower > 1) game.flashlightOn = true;
    else if (k === 'r' && game.monitorOpen) controller.triggerAudioLure();
    else if (k === 'x' && game.monitorOpen) controller.triggerCameraFlash();
    else if (game.monitorOpen && k >= '1' && k <= '7') controller.switchCamera(Number(k) - 1);
  });

  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    keysDown.delete(k);
    if (k === 'f') game.flashlightOn = false;
  });

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    officeCamera.aspect = w / h;
    officeCamera.updateProjectionMatrix();
    cctvCamera.aspect = w / h;
    cctvCamera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(Math.floor(w / 2), Math.floor(h / 2));
    hud.layoutPixiUI();
  });

  // UI Button Wiring
  document.getElementById('btn-continue').onclick = () => startNight(saveState.unlockedNight, false);
  document.getElementById('btn-newgame').onclick = () => {
    audio.init();
    game.mode = 'NEWSPAPER';
    showScreen('newspaper-screen');
    audio.playClick(640);
  };
  document.getElementById('btn-select-night').onclick = () => {
    refreshMenuStars();
    openDialog(nightDialog);
  };
  document.getElementById('btn-custom-night').onclick = () => openDialog(customDialog);
  document.getElementById('btn-controls-open').onclick = () => {
    document.getElementById('controls-modal-heading').textContent = 'MANUAL DO VIGIA NOTURNO';
    document.getElementById('pause-extra-btns').style.display = 'none';
    openDialog(controlsDialog);
  };
  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => {
      const dlg = b.closest('dialog');
      if (dlg) closeTopLayer(dlg);
      else closeAllModals();
    };
  });

  const fRange = document.getElementById('ai-freddy-range');
  const bRange = document.getElementById('ai-bonnie-range');
  fRange.oninput = () => { document.getElementById('ai-freddy-val').textContent = fRange.value; };
  bRange.oninput = () => { document.getElementById('ai-bonnie-val').textContent = bRange.value; };

  document.getElementById('preset-2020').onclick = () => {
    fRange.value = 20;
    bRange.value = 20;
    document.getElementById('ai-freddy-val').textContent = '20';
    document.getElementById('ai-bonnie-val').textContent = '20';
  };
  document.getElementById('btn-start-custom').onclick = () => {
    closeAllModals();
    startNight(6, true, Number(fRange.value), Number(bRange.value));
  };

  document.getElementById('btn-resume-game').onclick = () => closeTopLayer(controlsDialog);
  document.getElementById('btn-quit-menu').onclick = () => {
    closeAllModals();
    returnToMenu();
  };
  document.getElementById('btn-next-night').onclick = () => startNight(Math.min(5, game.night + 1), false);
  document.getElementById('btn-win-menu').onclick = returnToMenu;
  document.getElementById('btn-over-menu').onclick = returnToMenu;
  document.getElementById('btn-retry').onclick = () => {
    if (game.isCustom) startNight(6, true, game.freddyAI, game.bonnieAI);
    else startNight(game.night, false);
  };

  document.querySelectorAll('.pill-btn[data-quality]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quality === saveState.quality);
    btn.onclick = () => {
      saveState.quality = btn.dataset.quality;
      persistSave();
      document.querySelectorAll('.pill-btn[data-quality]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const high = saveState.quality === 'high';
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.25 : 0.9));
      renderer.shadowMap.enabled = high;
      world.setQualityShadows(high);
      if (bloomPass) {
        bloomPass.enabled = high;
        bloomPass.strength = high ? 0.42 : 0.0;
      }
    };
  });

  return {
    keysDown,
    showScreen,
    refreshMenuStars,
    returnToMenu
  };
}
