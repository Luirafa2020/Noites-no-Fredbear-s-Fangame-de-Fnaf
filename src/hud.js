import * as THREE from 'three';
import { CAMERAS, game, animState } from './config.js';

export function createPixiHUD() {
  const pixiCanvas = document.getElementById('pixi-canvas');
  const pixiApp = new PIXI.Application({
    view: pixiCanvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true
  });

  const pixiGlitchFrag = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float uTime;
    uniform float uGlitch;
    float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(void) {
      vec2 uv = vTextureCoord;
      float jitter = (rand(vec2(floor(uv.y * 45.0), floor(uTime * 24.0))) - 0.5) * uGlitch * 0.045;
      uv.x += jitter;
      vec4 col = texture2D(uSampler, uv);
      if (uGlitch > 0.02) {
        float r = texture2D(uSampler, uv + vec2(uGlitch * 0.01, 0.0)).r;
        float b = texture2D(uSampler, uv - vec2(uGlitch * 0.01, 0.0)).b;
        col.r = mix(col.r, r, 0.72);
        col.b = mix(col.b, b, 0.72);
      }
      gl_FragColor = col;
    }
  `;
  const pixiGlitchFilter = new PIXI.Filter(null, pixiGlitchFrag, { uTime: 0, uGlitch: 0 });

  const dustLayer = new PIXI.Container();
  const officeHudLayer = new PIXI.Container();
  const monitorLayer = new PIXI.Container();
  const fxLayer = new PIXI.Container();
  pixiApp.stage.addChild(dustLayer, officeHudLayer, monitorLayer, fxLayer);

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
  const vhsSnowTiling = new PIXI.TilingSprite(vhsSnowTex, window.innerWidth, window.innerHeight);
  vhsSnowTiling.alpha = 0.08;

  const biteStaticTiling = new PIXI.TilingSprite(vhsSnowTex, window.innerWidth, window.innerHeight);
  biteStaticTiling.visible = false;

  const moteGfx = new PIXI.Graphics();
  moteGfx.beginFill(0xffe8b8, 0.9); moteGfx.drawCircle(8, 8, 3.5);
  moteGfx.beginFill(0xffe8b8, 0.22); moteGfx.drawCircle(8, 8, 8);
  moteGfx.endFill();
  const moteTex = pixiApp.renderer.generateTexture(moteGfx);

  const motes = [];
  for (let i = 0; i < 42; i++) {
    const sp = new PIXI.Sprite(moteTex);
    sp.x = Math.random() * window.innerWidth;
    sp.y = Math.random() * window.innerHeight;
    sp.scale.set(0.18 + Math.random() * 0.44);
    sp.alpha = 0.08 + Math.random() * 0.24;
    sp.vx = (Math.random() - 0.5) * 14;
    sp.vy = -5 - Math.random() * 14;
    dustLayer.addChild(sp);
    motes.push(sp);
  }

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
    c._h = h;
    c._bg = bg;
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

  const crtStaticGfx = new PIXI.Graphics();
  const crtBezelGfx = new PIXI.Graphics();
  const recDotGfx = new PIXI.Graphics();
  const recLabel = new PIXI.Text('REC // 14 NOV 1983', hudStyleMono(15, 0xff444d, true));
  const camTitleText = new PIXI.Text('CAM 01 // PALCO PRINCIPAL', hudStyleMono(22, 0x52ff8f, true));
  const camSubText = new PIXI.Text('SINAL IR ESTÁVEL — MICROFONE ATIVO', hudStyleMono(13, 0x99d9ad));

  const mapContainer = new PIXI.Container();
  const mapBgGfx = new PIXI.Graphics();
  const mapSonarGfx = new PIXI.Graphics();
  const mapYouLbl = new PIXI.Text('SALA', new PIXI.TextStyle({
    fontFamily: 'Share Tech Mono, monospace', fontSize: 10, fill: 0xd9a43b, fontWeight: 'bold'
  }));
  mapYouLbl.anchor.set(0.5);
  mapContainer.addChild(mapBgGfx, mapSonarGfx, mapYouLbl);

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

  const lureBtn = makeHudPill('[R] TOCAR JINGLE (CÂMERA)', 0x52ff8f);
  const flashBtn = makeHudPill('[X] FLASH IR DE CÂMERA', 0xf5a623);

  const fxFlashGfx = new PIXI.Graphics();
  const fxWarningText = new PIXI.Text('', new PIXI.TextStyle({
    fontFamily: 'Oswald, sans-serif', fontSize: 58, fill: 0xff2222, fontWeight: 'bold', letterSpacing: 6
  }));
  fxWarningText.anchor.set(0.5);
  fxLayer.addChild(biteStaticTiling, fxFlashGfx, fxWarningText, muteBtn);

  monitorLayer.addChild(
    vhsSnowTiling, crtStaticGfx, crtBezelGfx, recDotGfx, recLabel,
    camTitleText, camSubText, mapContainer, lureBtn, flashBtn
  );

  const ecgHistory = new Array(56).fill(0);
  let ecgPhase = 0;

  function layoutPixiUI() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    pixiApp.renderer.resize(w, h);
    vhsSnowTiling.width = w;
    vhsSnowTiling.height = h;
    biteStaticTiling.width = w;
    biteStaticTiling.height = h;

    powerText.position.set(24, h - 98);
    usageLabel.position.set(24, h - 68);
    usageBarsGfx.position.set(76, h - 67);
    flashLabel.position.set(24, h - 38);
    flashBarGfx.position.set(110, h - 34);

    clockText.position.set(w - 24, 18);
    nightHudText.position.set(w - 24, 58);
    ecgLabel.position.set(w - 24, 86);
    ecgGfx.position.set(w - 196, 108);

    muteBtn.position.set(24, 22);
    pauseBtn.position.set(w - pauseBtn._w - 20, h - 48);

    const barW = Math.min(460, w * 0.56);
    const barH = 38;
    flipBar.position.set(w / 2, h - 26);
    flipBarBg.clear();
    flipBarBg.lineStyle(1.5, 0xd9a43b, 0.72);
    flipBarBg.beginFill(0x0c0b10, 0.80);
    flipBarBg.drawRoundedRect(-barW / 2, -barH / 2, barW, barH, 6);
    flipBarBg.endFill();

    crtBezelGfx.clear();
    crtBezelGfx.lineStyle(4, 0x26292e, 0.95);
    crtBezelGfx.drawRect(14, 14, w - 28, h - 28);
    crtBezelGfx.lineStyle(1.5, 0x52ff8f, 0.35);
    crtBezelGfx.drawRect(22, 22, w - 44, h - 44);
    // Corner viewfinder brackets
    crtBezelGfx.lineStyle(2, 0x52ff8f, 0.65);
    const bLen = 28;
    [[34, 34, 1, 1], [w - 34, 34, -1, 1], [34, h - 34, 1, -1], [w - 34, h - 34, -1, -1]].forEach(([bx, by, sx, sy]) => {
      crtBezelGfx.moveTo(bx, by + sy * bLen);
      crtBezelGfx.lineTo(bx, by);
      crtBezelGfx.lineTo(bx + sx * bLen, by);
    });

    recDotGfx.position.set(44, 72);
    recLabel.position.set(60, 63);
    camTitleText.position.set(38, 88);
    camSubText.position.set(38, 116);

    const mapW = Math.min(350, w * 0.38);
    const mapH = Math.min(255, h * 0.37);
    mapContainer.position.set(w - mapW - 34, h - mapH - 64);

    mapBgGfx.clear();
    mapBgGfx.lineStyle(1.5, 0x52ff8f, 0.55);
    mapBgGfx.beginFill(0x040b06, 0.85);
    mapBgGfx.drawRect(0, 0, mapW, mapH);
    mapBgGfx.endFill();

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

    lureBtn.position.set(38, h - 98);
    flashBtn.position.set(38, h - 60);
    fxWarningText.position.set(w / 2, h / 2);
  }

  layoutPixiUI();

  function updatePixiHUD(dt, elapsed) {
    const playing = ['PLAYING', 'POWEROUT', 'JUMPSCARE'].includes(game.mode);
    dustLayer.visible = game.mode !== 'LOADING';
    officeHudLayer.visible = playing && game.mode !== 'JUMPSCARE';
    monitorLayer.visible = game.mode === 'PLAYING' && game.monitorOpen;
    fxLayer.visible = playing;

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const sp of motes) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      if (sp.y < -16) { sp.y = h + 16; sp.x = Math.random() * w; }
      if (sp.x < -16) sp.x = w + 16;
      if (sp.x > w + 16) sp.x = -16;
    }

    if (!playing) {
      fxFlashGfx.clear();
      fxWarningText.text = '';
      biteStaticTiling.visible = false;
      muteBtn.visible = false;
      return;
    }

    powerText.text = `ENERGIA: ${Math.max(0, Math.ceil(game.power))}%`;
    powerText.style.fill = game.power < 16 ? 0xff444d : 0xebe4d6;

    usageBarsGfx.clear();
    for (let i = 0; i < 5; i++) {
      const active = i < game.usageLevel;
      const col = i < 2 ? 0x52ff8f : i < 4 ? 0xf5a623 : 0xff2b38;
      usageBarsGfx.beginFill(active ? col : 0x2a2a2e, active ? 0.95 : 0.45);
      usageBarsGfx.drawRect(i * 18, 0, 14, 18);
      usageBarsGfx.endFill();
    }

    flashBarGfx.clear();
    flashBarGfx.lineStyle(1, 0xd9a43b, 0.6);
    flashBarGfx.beginFill(0x111114, 0.8);
    flashBarGfx.drawRect(0, 0, 110, 10);
    flashBarGfx.endFill();
    flashBarGfx.beginFill(game.flashlightPower < 20 ? 0xff444d : 0xffd166, 0.95);
    flashBarGfx.drawRect(1, 1, Math.max(0, 108 * (game.flashlightPower / 100)), 8);
    flashBarGfx.endFill();

    clockText.text = `${game.hour === 0 ? '12' : game.hour}:00 AM`;
    nightHudText.text = game.isCustom ? `CUSTOM (${game.freddyAI}/${game.bonnieAI})` : `NOITE ${game.night}`;

    const bpm = Math.round(68 + game.dangerLevel * 86);
    ecgLabel.text = `PULSO: ${bpm} BPM`;
    ecgLabel.style.fill = bpm > 115 ? 0xff444d : bpm > 90 ? 0xf5a623 : 0x52ff8f;

    ecgPhase += dt * (bpm / 60) * Math.PI * 2;
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

    muteBtn.visible = game.phoneActive && !game.phoneMuted && game.mode === 'PLAYING';
    flipBar.visible = game.mode === 'PLAYING';
    flipBarText.text = game.monitorOpen
      ? '▼  [ ESPAÇO ]  FECHAR MONITOR DE CÂMERAS  ▼'
      : '▲  [ ESPAÇO ]  ABRIR MONITOR DE CÂMERAS  ▲';

    if (game.hoverHint && !game.monitorOpen && game.mode === 'PLAYING') {
      hoverTag.visible = true;
      hoverTagText.text = game.hoverHint;
      hoverTagBg.clear();
      hoverTagBg.lineStyle(1, 0xffd166, 0.85);
      hoverTagBg.beginFill(0x08070a, 0.90);
      hoverTagBg.drawRoundedRect(-hoverTagText.width / 2 - 10, -14, hoverTagText.width + 20, 26, 4);
      hoverTagBg.endFill();
      hoverTagText.position.set(-hoverTagText.width / 2, -9);
      const mx = (game.mouseNormX * 0.5 + 0.5) * w;
      const my = (-game.mouseNormY * 0.5 + 0.5) * h;
      hoverTag.position.set(Math.min(w - 120, Math.max(120, mx)), Math.max(40, my - 28));
    } else {
      hoverTag.visible = false;
    }

    if (monitorLayer.visible) {
      const gLevel = Math.min(1, game.staticBurst + game.camMoveGlitch);
      if (gLevel > 0.03) {
        monitorLayer.filters = [pixiGlitchFilter];
        pixiGlitchFilter.uniforms.uTime = elapsed;
        pixiGlitchFilter.uniforms.uGlitch = gLevel;
      } else {
        monitorLayer.filters = null;
      }

      vhsSnowTiling.tilePosition.x = Math.random() * 256;
      vhsSnowTiling.tilePosition.y = Math.random() * 256;
      vhsSnowTiling.alpha = 0.09 + gLevel * 0.35;

      const hr = game.hour === 0 ? '12' : String(game.hour).padStart(2, '0');
      const sec = String(Math.floor(game.nightElapsed % 60)).padStart(2, '0');
      recLabel.text = `REC // 14 NOV 1983 // ${hr}:${sec} AM`;

      const cam = CAMERAS[game.activeCam];
      camTitleText.text = `${cam.code} // ${cam.name}`;
      const fHere = animState.freddy.loc === game.activeCam;
      const bHere = animState.bonnie.loc === game.activeCam;
      if (fHere || bHere) {
        camSubText.text = '⚠ MOVIMENTO DETECTADO NESTA CÂMERA!';
        camSubText.style.fill = 0xff444d;
      } else {
        camSubText.text = 'SINAL IR ESTÁVEL — MICROFONE ATIVO';
        camSubText.style.fill = 0x99d9ad;
      }

      recDotGfx.clear();
      if (Math.sin(elapsed * 5) > 0) {
        recDotGfx.beginFill(0xff333d, 1);
        recDotGfx.drawCircle(0, 0, 6);
        recDotGfx.endFill();
      }

      crtStaticGfx.clear();
      if (gLevel > 0.12) {
        for (let i = 0; i < 14; i++) {
          crtStaticGfx.beginFill(0xffffff, 0.16);
          crtStaticGfx.drawRect(22, Math.random() * h, w - 44, 2 + Math.random() * 14);
          crtStaticGfx.endFill();
        }
      }

      camNodeButtons.forEach((node, idx) => {
        const active = idx === game.activeCam;
        const b = node._box;
        b.clear();
        b.lineStyle(1.5, active ? 0x52ff8f : 0x80a88b, active ? 1 : 0.75);
        b.beginFill(active ? 0x164d27 : 0x0b160e, 0.92);
        b.drawRect(-30, -15, 60, 30);
        b.endFill();
        node._label.style.fill = active ? 0xffffff : 0xbbe0c5;
      });

      mapSonarGfx.clear();
      const mapW = Math.min(350, w * 0.38);
      const mapH = Math.min(255, h * 0.37);

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

      lureBtn._lbl.text = game.audioLureCooldown > 0
        ? `[R] JINGLE RECARREGANDO (${Math.ceil(game.audioLureCooldown)}s)`
        : `[R] TOCAR JINGLE (${CAMERAS[game.activeCam].short})`;
      lureBtn.alpha = game.audioLureCooldown > 0 ? 0.5 : 1;

      flashBtn._lbl.text = game.flashCooldown > 0
        ? `[X] FLASH RECARREGANDO (${Math.ceil(game.flashCooldown)}s)`
        : `[X] FLASH IR DE CÂMERA`;
      flashBtn.alpha = game.flashCooldown > 0 ? 0.5 : 1;
    }

    fxFlashGfx.clear();
    biteStaticTiling.visible = false;
    if (game.camFlashAlpha > 0.01) {
      fxFlashGfx.beginFill(0xffffff, game.camFlashAlpha * 0.65);
      fxFlashGfx.drawRect(0, 0, w, h);
      fxFlashGfx.endFill();
    }
    if (game.mode === 'JUMPSCARE') {
      const p = THREE.MathUtils.clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);
      if (game.biteFlash > 0.01) {
        fxFlashGfx.beginFill(0xb00a10, game.biteFlash * 0.45);
        fxFlashGfx.drawRect(0, 0, w, h);
        fxFlashGfx.endFill();
      }
      if (p > 0.85) {
        const cutU = (p - 0.85) / 0.15;
        biteStaticTiling.visible = true;
        biteStaticTiling.tilePosition.x = Math.random() * 256;
        biteStaticTiling.tilePosition.y = Math.random() * 256;
        biteStaticTiling.alpha = 0.85;
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
