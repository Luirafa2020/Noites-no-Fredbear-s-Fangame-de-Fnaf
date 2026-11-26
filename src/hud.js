import * as THREE from 'three';
import { CAMERAS, game, animState } from './config.js';

export function createPixiHUD() {
  const pixiCanvas = document.getElementById('pixi-canvas');
  const pixiApp = new PIXI.Application({
    view: pixiCanvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 1.25),
    autoStart: false,
    autoDensity: true
  });

  const officeHudLayer = new PIXI.Container();
  const monitorLayer = new PIXI.Container();
  const fxLayer = new PIXI.Container();
  pixiApp.stage.addChild(monitorLayer, officeHudLayer, fxLayer);

  const snowCanvas = document.createElement('canvas');
  snowCanvas.width = 256;
  snowCanvas.height = 256;
  const sCtx = snowCanvas.getContext('2d');
  const sImg = sCtx.createImageData(256, 256);
  const sBuf = new Uint32Array(sImg.data.buffer);
  for (let i = 0; i < sBuf.length; i++) {
    sBuf[i] = Math.random() > 0.75 ? (Math.random() > 0.5 ? 0x55ffffff : 0x55000000) : 0;
  }
  sCtx.putImageData(sImg, 0, 0);
  const vhsSnowTex = PIXI.Texture.from(snowCanvas);
  const biteStaticTiling = new PIXI.TilingSprite(vhsSnowTex, window.innerWidth, window.innerHeight);
  biteStaticTiling.visible = false;

  const hudStyleMono = (size, color = 0xebe4d6, bold = false) => new PIXI.TextStyle({
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: size,
    fill: color,
    fontWeight: bold ? 'bold' : 'normal',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 2,
    dropShadowBlur: 4
  });

  const powerText = new PIXI.Text('ENERGIA: 100%', hudStyleMono(22, 0xebe4d6, true));
  const usageLabel = new PIXI.Text('USO:', hudStyleMono(17, 0xbdb5a8));
  const usageBarsGfx = new PIXI.Graphics();
  const flashLabel = new PIXI.Text('LANTERNA:', hudStyleMono(14, 0xd9a43b));
  const flashBarGfx = new PIXI.Graphics();

  const clockText = new PIXI.Text('12:00 AM', hudStyleMono(34, 0xffffff, true));
  clockText.anchor.set(1, 0);
  const nightHudText = new PIXI.Text('NOITE 1', hudStyleMono(18, 0xd9a43b, true));
  nightHudText.anchor.set(1, 0);

  const ecgGfx = new PIXI.Graphics();
  const ecgLabel = new PIXI.Text('PULSO: 72 BPM', hudStyleMono(13, 0x52ff8f));
  ecgLabel.anchor.set(1, 0);

  const makeHudPill = (text, color = 0xd9a43b) => {
    const c = new PIXI.Container();
    const bg = new PIXI.Graphics();
    const lbl = new PIXI.Text(text, hudStyleMono(14, color, true));
    lbl.position.set(12, 7);
    const w = lbl.width + 24;
    const h = 30;
    bg.lineStyle(1, color, 0.62);
    bg.beginFill(0x09080c, 0.88);
    bg.drawRoundedRect(0, 0, w, h, 3);
    bg.endFill();
    c.addChild(bg, lbl);
    c._w = w;
    c._lbl = lbl;
    return c;
  };

  const muteBtn = makeHudPill('[M] SILENCIAR CHAMADA', 0xd9a43b);
  const pauseBtn = makeHudPill('[ESC] MANUAL / PAUSA', 0xcfc8bc);

  const flipBar = new PIXI.Container();
  const flipBarBg = new PIXI.Graphics();
  const flipBarText = new PIXI.Text('▲  [ ESPAÇO ]  ABRIR MONITOR DE CÂMERAS  ▲', hudStyleMono(16, 0xebe4d6, true));
  flipBarText.anchor.set(0.5);
  flipBar.addChild(flipBarBg, flipBarText);

  const hoverTag = new PIXI.Container();
  const hoverTagBg = new PIXI.Graphics();
  const hoverTagText = new PIXI.Text('', hudStyleMono(14, 0xffd166, true));
  hoverTag.addChild(hoverTagBg, hoverTagText);
  hoverTag.visible = false;

  officeHudLayer.addChild(
    powerText, usageLabel, usageBarsGfx, flashLabel, flashBarGfx,
    clockText, nightHudText, ecgGfx, ecgLabel, pauseBtn, flipBar, hoverTag
  );

  const monitorHeader = new PIXI.Graphics();
  const crtBezelGfx = new PIXI.Graphics();
  const recDotGfx = new PIXI.Graphics();
  const recLabel = new PIXI.Text('REC   14.11.83   00:00:00', hudStyleMono(12, 0xe7beac, true));
  const camTitleText = new PIXI.Text('CAM 01 // PALCO PRINCIPAL', hudStyleMono(19, 0xe0e9de, true));
  const camSubText = new PIXI.Text('SINAL ESTÁVEL', hudStyleMono(12, 0x9fb7a7));
  const signalBars = new PIXI.Graphics();

  const mapContainer = new PIXI.Container();
  const mapBgGfx = new PIXI.Graphics();
  const mapSonarGfx = new PIXI.Graphics();
  const mapLabel = new PIXI.Text('PLANTA / CANAIS 01–07', hudStyleMono(10, 0xa5b9ae, true));
  const mapYouLbl = new PIXI.Text('SALA', new PIXI.TextStyle({
    fontFamily: 'Share Tech Mono, monospace', fontSize: 10, fill: 0xd9a43b, fontWeight: 'bold'
  }));
  mapYouLbl.anchor.set(0.5);
  mapContainer.addChild(mapBgGfx, mapLabel, mapSonarGfx, mapYouLbl);

  const camNodeButtons = [];
  CAMERAS.forEach((cam, idx) => {
    const node = new PIXI.Container();
    const box = new PIXI.Graphics();
    const label = new PIXI.Text(cam.code + '\n' + cam.short, new PIXI.TextStyle({
      fontFamily: 'Share Tech Mono, monospace', fontSize: 11, fill: 0xd9f5df, align: 'center'
    }));
    label.anchor.set(0.5);
    node.addChild(box, label);
    node._box = box;
    node._label = label;
    node._camIdx = idx;
    mapContainer.addChild(node);
    camNodeButtons.push(node);
  });

  const lureBtn = makeHudPill('[R] TOCAR JINGLE — COZINHA', 0xb3dbc1);
  const flashBtn = makeHudPill('[X] FLASH IR — RECARREGANDO', 0xdab174);

  const fxFlashGfx = new PIXI.Graphics();
  const fxWarningText = new PIXI.Text('', new PIXI.TextStyle({
    fontFamily: 'Oswald, sans-serif', fontSize: 58, fill: 0xff2222, fontWeight: 'bold', letterSpacing: 6
  }));
  fxWarningText.anchor.set(0.5);
  fxLayer.addChild(biteStaticTiling, fxFlashGfx, fxWarningText, muteBtn);

  monitorLayer.addChild(
    crtBezelGfx, monitorHeader, recDotGfx, recLabel, camTitleText, camSubText,
    signalBars, mapContainer, lureBtn, flashBtn
  );

  const ecgHistory = new Array(56).fill(0);
  let ecgPhase = 0;

  let width, height, mapW, mapH, compact;
  let monitorLayout = null;
  let drawnCam = -1;
  let drawnSignal = -1;
  let drawnUsage = -1;
  let drawnBattery = -1;
  let ecgNext = 0;

  recDotGfx.beginFill(0xf27862);
  recDotGfx.drawCircle(0, 0, 3.3);
  recDotGfx.endFill();

  function layoutControls(monitor) {
    const w = width;
    const h = height;
    monitorLayout = monitor;
    const inset = compact ? 16 : 28;
    const hudBase = monitor ? (compact ? h - 124 : h - 148) : h - 102;
    powerText.position.set(inset, hudBase);
    usageLabel.position.set(inset + (monitor ? (compact ? 124 : 148) : 0), hudBase + (monitor ? 4 : 30));
    usageBarsGfx.position.set(usageLabel.x + (compact ? 39 : 52), usageLabel.y + 1);
    flashLabel.position.set(inset, h - 38);
    flashBarGfx.position.set(inset + 86, h - 34);
    flashLabel.visible = flashBarGfx.visible = !monitor;

    clockText.position.set(w - inset, monitor ? 28 : 18);
    nightHudText.position.set(w - inset, monitor ? (compact ? 48 : 60) : (compact ? 49 : 58));
    ecgLabel.position.set(w - inset, compact ? 75 : 86);
    ecgGfx.position.set(w - inset - 166, compact ? 92 : 108);
    ecgLabel.visible = ecgGfx.visible = !monitor;

    muteBtn.scale.set(compact ? 0.68 : 1);
    muteBtn.position.set(inset, monitor ? 108 : 22);
    pauseBtn.scale.set(compact ? 0.70 : 1);
    pauseBtn.position.set(w - pauseBtn._w * pauseBtn.scale.x - inset, compact ? 108 : h - 44);

    const barW = Math.min(450, compact ? w - 2 * inset : w * 0.52);
    flipBar.position.set(w / 2, h - 27);
    flipBarText.style.fontSize = compact ? 12 : 15;
    flipBarBg.clear();
    flipBarBg.lineStyle(1, monitor ? 0x8da99a : 0xd9a43b, 0.7);
    flipBarBg.beginFill(monitor ? 0x0b1514 : 0x0c0b10, 0.88);
    flipBarBg.drawRoundedRect(-barW / 2, -18, barW, 36, 4);
    flipBarBg.endFill();
  }

  function layoutPixiUI() {
    const w = width = window.innerWidth;
    const h = height = window.innerHeight;
    compact = w < 720;
    pixiApp.renderer.resize(w, h);
    biteStaticTiling.width = w;
    biteStaticTiling.height = h;

    powerText.style.fontSize = compact ? 16 : 21;
    usageLabel.style.fontSize = compact ? 13 : 16;
    clockText.style.fontSize = compact ? 20 : 31;
    nightHudText.style.fontSize = compact ? 11 : 16;
    layoutControls(game.monitorOpen);

    const edge = compact ? 8 : 17;
    crtBezelGfx.clear();
    crtBezelGfx.lineStyle(1, 0xa4bbab, 0.31);
    crtBezelGfx.drawRect(edge, edge, w - edge * 2, h - edge * 2);
    crtBezelGfx.lineStyle(2, 0xc1d3c5, 0.56);
    const bracket = compact ? 15 : 24;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx > 0 ? edge : w - edge;
      const y = sy > 0 ? edge : h - edge;
      crtBezelGfx.moveTo(x, y + sy * bracket);
      crtBezelGfx.lineTo(x, y);
      crtBezelGfx.lineTo(x + sx * bracket, y);
    }

    const left = compact ? 16 : 28;
    const titleWidth = compact ? Math.min(300, w - 117) : 340;
    monitorHeader.clear();
    monitorHeader.lineStyle(1, 0x88a092, 0.46);
    monitorHeader.beginFill(0x0b1314, 0.89);
    monitorHeader.drawRoundedRect(left, 27, titleWidth, 73, 3);
    monitorHeader.endFill();
    monitorHeader.lineStyle(0);
    monitorHeader.beginFill(0x74988a, 0.80);
    monitorHeader.drawRect(left, 31, 2, 64);
    monitorHeader.endFill();

    recDotGfx.position.set(left + 14, 42);
    recLabel.style.fontSize = w < 370 ? 10 : 12;
    recLabel.position.set(left + 24, 35);
    camTitleText.style.fontSize = compact ? 14 : 19;
    camTitleText.position.set(left + 12, 52);
    camSubText.style.fontSize = compact ? 10 : 12;
    camSubText.position.set(left + 12, 78);
    signalBars.position.set(left + titleWidth - 37, 39);

    mapW = Math.min(324, compact ? w - 32 : w * 0.36);
    mapH = Math.min(238, Math.max(h < 490 ? 125 : 150, h * (compact ? 0.30 : 0.37)));
    mapContainer.position.set(w - mapW - left, h - mapH - (compact ? 137 : 66));

    mapBgGfx.clear();
    mapBgGfx.lineStyle(1.25, 0x859c8d, 0.62);
    mapBgGfx.beginFill(0x0a1313, 0.91);
    mapBgGfx.drawRoundedRect(0, 0, mapW, mapH, 3);
    mapBgGfx.endFill();
    mapBgGfx.lineStyle(1, 0x30423d, 0.56);
    for (let x = 12; x < mapW - 8; x += 12) {
      mapBgGfx.moveTo(x, 8);
      mapBgGfx.lineTo(x, mapH - 8);
    }
    for (let y = 8; y < mapH - 6; y += 12) {
      mapBgGfx.moveTo(8, y);
      mapBgGfx.lineTo(mapW - 8, y);
    }
    mapLabel.position.set(8, mapH - 16);

    // Room floorplan blueprints
    mapBgGfx.lineStyle(1.5, 0x2a6942, 0.6);
    mapBgGfx.beginFill(0x09180d, 0.45);
    mapBgGfx.drawRect(mapW * 0.36, mapH * 0.05, mapW * 0.24, mapH * 0.17); // Stage
    mapBgGfx.drawRect(mapW * 0.30, mapH * 0.24, mapW * 0.36, mapH * 0.24); // Dining
    mapBgGfx.drawRect(mapW * 0.06, mapH * 0.24, mapW * 0.20, mapH * 0.20); // Parts
    mapBgGfx.drawRect(mapW * 0.70, mapH * 0.24, mapW * 0.22, mapH * 0.20); // Kitchen
    mapBgGfx.endFill();

    mapBgGfx.lineStyle(2, 0x296b42, 0.75);
    mapBgGfx.moveTo(mapW * 0.48, mapH * 0.14); mapBgGfx.lineTo(mapW * 0.48, mapH * 0.38);
    mapBgGfx.moveTo(mapW * 0.16, mapH * 0.34); mapBgGfx.lineTo(mapW * 0.80, mapH * 0.34);
    mapBgGfx.moveTo(mapW * 0.25, mapH * 0.38); mapBgGfx.lineTo(mapW * 0.25, mapH * 0.88);
    mapBgGfx.moveTo(mapW * 0.71, mapH * 0.38); mapBgGfx.lineTo(mapW * 0.71, mapH * 0.88);
    mapBgGfx.moveTo(mapW * 0.25, mapH * 0.88); mapBgGfx.lineTo(mapW * 0.71, mapH * 0.88);
    mapBgGfx.lineStyle(1.5, 0x998033, 0.75);
    mapBgGfx.moveTo(mapW * 0.71, mapH * 0.63); mapBgGfx.lineTo(mapW * 0.57, mapH * 0.77); mapBgGfx.lineTo(mapW * 0.48, mapH * 0.88);

    mapBgGfx.lineStyle(1.5, 0xd9a43b, 0.9);
    mapBgGfx.beginFill(0x211809, 0.95);
    mapBgGfx.drawRect(mapW * 0.39, mapH * 0.84, mapW * 0.18, mapH * 0.12);
    mapBgGfx.endFill();
    mapYouLbl.position.set(mapW * 0.48, mapH * 0.90);

    camNodeButtons.forEach((node, idx) => {
      const cam = CAMERAS[idx];
      node.position.set(mapW * cam.mapX, mapH * cam.mapY);
    });

    const actionScale = compact ? Math.min(0.73, (w - 43) / (lureBtn._w + flashBtn._w)) : 1;
    lureBtn.scale.set(actionScale);
    flashBtn.scale.set(actionScale);
    lureBtn.position.set(left, compact ? h - 91 : h - 112);
    flashBtn.position.set(compact ? w - flashBtn._w * actionScale - left : left, compact ? h - 91 : h - 73);
    drawnCam = -1;
    drawnBattery = -1;
    drawnUsage = -1;
    drawnSignal = -1;
    fxWarningText.position.set(w / 2, h / 2);
  }

  function updatePixiHUD(dt, elapsed) {
    const playing = game.mode === 'PLAYING' || game.mode === 'POWEROUT' || game.mode === 'JUMPSCARE';
    const paused = game.mode === 'PAUSED';
    const monitor = (game.mode === 'PLAYING' || paused) && game.monitorOpen;
    officeHudLayer.visible = (playing && game.mode !== 'JUMPSCARE') || paused;
    monitorLayer.visible = monitor;
    fxLayer.visible = playing;
    if (!playing && !paused) return;
    if (monitorLayout !== monitor) layoutControls(monitor);

    const w = width;
    const h = height;
    powerText.text = `ENERGIA: ${Math.max(0, Math.ceil(game.power))}%`;
    powerText.style.fill = game.power < 16 ? 0xff444d : 0xebe4d6;

    if (drawnUsage !== game.usageLevel) {
      drawnUsage = game.usageLevel;
      usageBarsGfx.clear();
      for (let i = 0; i < 5; i++) {
        const active = i < game.usageLevel;
        const col = i < 2 ? 0x7cbd95 : i < 4 ? 0xf5a623 : 0xff505b;
        usageBarsGfx.beginFill(active ? col : 0x303536, active ? 0.95 : 0.72);
        usageBarsGfx.drawRect(i * (compact ? 11 : 15), 0, compact ? 8 : 11, compact ? 11 : 14);
        usageBarsGfx.endFill();
      }
    }

    const battery = Math.ceil(game.flashlightPower);
    if (!monitor && drawnBattery !== battery) {
      drawnBattery = battery;
      flashBarGfx.clear();
      flashBarGfx.lineStyle(1, 0xd9a43b, 0.6);
      flashBarGfx.beginFill(0x111114, 0.8);
      flashBarGfx.drawRect(0, 0, 110, 10);
      flashBarGfx.endFill();
      flashBarGfx.lineStyle(0);
      flashBarGfx.beginFill(battery < 20 ? 0xff444d : 0xffd166, 0.95);
      flashBarGfx.drawRect(1, 1, 108 * battery / 100, 8);
      flashBarGfx.endFill();
    }

    clockText.text = `${game.hour === 0 ? '12' : game.hour}:00 AM`;
    nightHudText.text = game.isCustom ? `CUSTOM (${game.freddyAI}/${game.bonnieAI})` : `NOITE ${game.night}`;

    const bpm = Math.round(68 + game.dangerLevel * 86);
    ecgLabel.text = `PULSO: ${bpm} BPM`;
    ecgLabel.style.fill = bpm > 115 ? 0xff444d : bpm > 90 ? 0xf5a623 : 0x52ff8f;

    ecgPhase += dt * (bpm / 60) * Math.PI * 2;
    if (!monitor && elapsed >= ecgNext) {
      ecgNext = elapsed + 1 / 24;
      let beat = 0;
      const mod = ecgPhase % (Math.PI * 2);
      if (mod < 0.35) beat = Math.sin((mod / 0.35) * Math.PI) * 14;
      else if (mod < 0.55) beat = -Math.sin(((mod - 0.35) / 0.2) * Math.PI) * 8;
      else beat = (Math.random() - 0.5) * 1.4;
      ecgHistory.push(beat);
      if (ecgHistory.length > 56) ecgHistory.shift();

      ecgGfx.clear();
      ecgGfx.lineStyle(1.5, bpm > 115 ? 0xff444d : 0x52ff8f, 0.85);
      for (let i = 0; i < ecgHistory.length; i++) {
        const px = i * 3;
        const py = 12 - ecgHistory[i];
        if (i === 0) ecgGfx.moveTo(px, py);
        else ecgGfx.lineTo(px, py);
      }
    }

    muteBtn.visible = game.phoneActive && !game.phoneMuted && game.mode === 'PLAYING';
    flipBar.visible = game.mode === 'PLAYING' || paused;
    flipBarText.text = monitor ? '▼  [ESPAÇO]  FECHAR MONITOR' : '▲  [ESPAÇO]  ABRIR CÂMERAS';

    if (game.hoverHint && !game.monitorOpen && game.mode === 'PLAYING') {
      hoverTag.visible = true;
      if (hoverTagText.text !== game.hoverHint) {
        hoverTagText.text = game.hoverHint;
        hoverTagBg.clear();
        hoverTagBg.lineStyle(1, 0xffd166, 0.85);
        hoverTagBg.beginFill(0x08070a, 0.90);
        hoverTagBg.drawRoundedRect(-hoverTagText.width / 2 - 10, -14, hoverTagText.width + 20, 26, 4);
        hoverTagBg.endFill();
        hoverTagText.position.set(-hoverTagText.width / 2, -9);
      }
      const mx = (game.mouseNormX * 0.5 + 0.5) * w;
      const my = (-game.mouseNormY * 0.5 + 0.5) * h;
      hoverTag.position.set(Math.min(w - 120, Math.max(120, mx)), Math.max(40, my - 28));
    } else {
      hoverTag.visible = false;
    }

    if (monitorLayer.visible) {
      const cam = CAMERAS[game.activeCam];
      const signal = game.staticBurst + game.camMoveGlitch;
      const moving = animState.freddy.loc === game.activeCam || animState.bonnie.loc === game.activeCam;
      const unstable = signal > 0.38;
      const bars = unstable ? 1 : signal > 0.13 ? 2 : 4;
      recDotGfx.alpha = elapsed % 1.4 < 0.96 ? 1 : 0.27;
      const shiftSeconds = Math.floor(game.nightElapsed / game.hourDuration * 3600);
      const hours = String(Math.floor(shiftSeconds / 3600) || 12).padStart(2, '0');
      const minutes = String(Math.floor(shiftSeconds / 60) % 60).padStart(2, '0');
      const seconds = String(shiftSeconds % 60).padStart(2, '0');
      recLabel.text = `REC  14.11.83  ${hours}:${minutes}:${seconds}`;
      camTitleText.text = `${cam.code} · ${w < 520 ? cam.short : cam.name}`;
      camSubText.text = unstable ? 'SINCRONIZANDO SINAL' : moving ? 'MOVIMENTO DETECTADO' : 'SINAL ESTÁVEL';
      camSubText.style.fill = unstable ? 0xd8b37e : moving ? 0xf28e6f : 0xa6bfb0;

      if (bars !== drawnSignal) {
        drawnSignal = bars;
        signalBars.clear();
        for (let i = 0; i < 4; i++) {
          signalBars.beginFill(i < bars ? 0xa8c9b5 : 0x40524b);
          signalBars.drawRect(i * 6, 10 - i * 2, 4, 3 + i * 2);
          signalBars.endFill();
        }
      }

      if (drawnCam !== game.activeCam) {
        drawnCam = game.activeCam;
        const halfW = Math.min(31, mapW * 0.102);
        camNodeButtons.forEach((node, idx) => {
          const active = idx === game.activeCam;
          const b = node._box;
          b.clear();
          b.lineStyle(1, active ? 0xd4e6da : 0x709487, active ? 1 : 0.7);
          b.beginFill(active ? 0xb4d0bc : 0x132522, active ? 1 : 0.96);
          b.drawRoundedRect(-halfW, -13, halfW * 2, 26, 2);
          b.endFill();
          node._label.style.fontSize = mapW < 230 ? 9 : 10;
          node._label.style.fill = active ? 0x091b16 : 0xb7cebd;
        });
      }

      mapSonarGfx.clear();
      if (game.lurePingTimer > 0 && game.lurePingCam >= 0) {
        const targetCam = CAMERAS[game.lurePingCam];
        const progress = 1 - game.lurePingTimer / 2.0;
        mapSonarGfx.lineStyle(2, 0x52ff8f, 1 - progress);
        mapSonarGfx.drawCircle(mapW * targetCam.mapX, mapH * targetCam.mapY, 12 + progress * 46);
      }

      if (game.soundSensorTimer > 0 && game.soundSensorCam >= 0 && game.soundSensorCam <= 6) {
        const sCam = CAMERAS[game.soundSensorCam];
        const pulse = Math.abs(Math.sin(elapsed * 14));
        mapSonarGfx.lineStyle(2, 0xf5a623, pulse * (game.soundSensorTimer / 2.5));
        mapSonarGfx.drawCircle(mapW * sCam.mapX, mapH * sCam.mapY, 24);
      }

      const lureWait = Math.ceil(game.audioLureCooldown);
      const flashWait = Math.ceil(game.flashCooldown);
      lureBtn._lbl.text = lureWait ? `[R] JINGLE · ${lureWait}s` : '[R] TOCAR JINGLE';
      flashBtn._lbl.text = flashWait ? `[X] FLASH IR · ${flashWait}s` : '[X] FLASH IR';
      lureBtn.alpha = lureWait ? 0.62 : 1;
      flashBtn.alpha = flashWait ? 0.62 : 1;
    }

    fxFlashGfx.clear();
    biteStaticTiling.visible = false;
    if (game.camFlashAlpha > 0.01) {
      fxFlashGfx.beginFill(0xffffff, game.camFlashAlpha * 0.32);
      fxFlashGfx.drawRect(0, 0, w, h);
      fxFlashGfx.endFill();
    }
    if (game.mode === 'JUMPSCARE') {
      const p = THREE.MathUtils.clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);
      if (game.biteFlash > 0.01) {
        fxFlashGfx.beginFill(0xb00a10, game.biteFlash * 0.27);
        fxFlashGfx.drawRect(0, 0, w, h);
        fxFlashGfx.endFill();
      }
      if (p > 0.85) {
        const cutU = THREE.MathUtils.smoothstep(p, 0.85, 0.99);
        biteStaticTiling.visible = true;
        biteStaticTiling.tilePosition.x = Math.random() * 256;
        biteStaticTiling.tilePosition.y = Math.random() * 256;
        biteStaticTiling.alpha = 0.22 + cutU * 0.61;
        fxFlashGfx.beginFill(0x000000, cutU * 0.92);
        fxFlashGfx.drawRect(0, 0, w, h);
        fxFlashGfx.endFill();
      }
    } else if (game.hallucinationTimer > 0) {
      fxFlashGfx.beginFill(0x000000, 0.78);
      fxFlashGfx.drawRect(0, 0, w, h);
      fxFlashGfx.endFill();
      fxWarningText.text = game.hallucinationText;
      fxWarningText.alpha = 0.75 + Math.random() * 0.25;
    } else {
      fxWarningText.text = '';
    }
  }

  return {
    pixiApp,
    layoutPixiUI,
    updatePixiHUD,
    controls: { flipBar, muteBtn, pauseBtn, lureBtn, flashBtn, camNodeButtons }
  };
}
