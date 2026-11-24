import * as THREE from 'three';

function createCanvasTex(w, h, drawFn, repeatX = 1, repeatY = 1, isColor = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createNormalFromHeight(w, h, drawHeightFn, strength = 2.6, repeatX = 1, repeatY = 1) {
  const hc = document.createElement('canvas');
  hc.width = w;
  hc.height = h;
  const hctx = hc.getContext('2d');
  drawHeightFn(hctx, w, h);

  const src = hctx.getImageData(0, 0, w, h).data;
  const nc = document.createElement('canvas');
  nc.width = w;
  nc.height = h;
  const nctx = nc.getContext('2d');
  const out = nctx.createImageData(w, h);
  const dst = out.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t  = sample(x,     y - 1);
      const tr = sample(x + 1, y - 1);
      const l  = sample(x - 1, y);
      const r  = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b  = sample(x,     y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;

      const idx = (y * w + x) * 4;
      dst[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  nctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function makeMottledSuit(baseRgb, darkPatch, lightPatch, grimeRgb) {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    const [rB, gB, bB] = baseRgb;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 38;
      d[i] = Math.max(0, Math.min(255, rB + n));
      d[i + 1] = Math.max(0, Math.min(255, gB + n));
      d[i + 2] = Math.max(0, Math.min(255, bB + n));
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    // Mold, moisture & grease blotches
    for (let i = 0; i < 160; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const rad = 14 + Math.random() * 52;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      g.addColorStop(0, i % 4 === 0 ? lightPatch : i % 3 === 0 ? grimeRgb : darkPatch);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine matted fleece fiber strokes
    for (let i = 0; i < 3600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 3 + Math.random() * 8;
      const ang = (Math.random() - 0.5) * 1.4 + Math.PI * 0.5;
      ctx.strokeStyle = Math.random() > 0.45
        ? `rgba(28, 18, 6, ${0.12 + Math.random() * 0.22})`
        : `rgba(232, 204, 108, ${0.08 + Math.random() * 0.16})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Stitched suit panel seams + subtle rust/blood grime along seams
    ctx.strokeStyle = 'rgba(22, 14, 7, 0.55)';
    ctx.lineWidth = 2.2;
    [128, 384].forEach(sy => {
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      for (let x = 8; x < w; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, sy - 5);
        ctx.lineTo(x + 2, sy + 5);
        ctx.stroke();
      }
    });

    // Hairline cracked rubber/fabric stress fissures
    ctx.strokeStyle = 'rgba(18, 12, 8, 0.42)';
    ctx.lineWidth = 1.1;
    for (let c = 0; c < 18; c++) {
      let cx = Math.random() * w;
      let cy = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 5; s++) {
        cx += (Math.random() - 0.5) * 24;
        cy += (Math.random() - 0.5) * 24;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }, 2, 2, true);
}

export function buildTextures() {
  const floorColor = createCanvasTex(512, 512, (ctx, w, h) => {
    const s = w / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const dark = (x + y) % 2 === 0;
        ctx.fillStyle = dark ? '#0f1013' : '#b2a68a';
        ctx.fillRect(x * s, y * s, s, s);
        // Inner scuff shading per tile
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(40,30,18,0.08)';
        ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.78)';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x * s, y * s, s, s);
      }
    }
    // Dirt, grease & dried spills
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = i % 19 === 0
        ? `rgba(48, 12, 10, ${0.06 + Math.random() * 0.14})`
        : `rgba(12, 9, 7, ${Math.random() * 0.18})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tile corner cracks
    ctx.strokeStyle = 'rgba(12, 10, 8, 0.55)';
    ctx.lineWidth = 1.2;
    for (let c = 0; c < 18; c++) {
      let cx = Math.random() * w, cy = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) {
        cx += (Math.random() - 0.5) * 26; cy += (Math.random() - 0.5) * 26;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }, 7, 7, true);

  const floorRoughness = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#929292';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(24, 24, 24, 0.55)' : 'rgba(220, 220, 220, 0.25)';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 38, 8 + Math.random() * 24, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 7, 7, false);

  const floorNormal = createNormalFromHeight(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b4b4b4';
    ctx.fillRect(0, 0, w, h);
    const s = w / 4;
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 5;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
    }
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1.5;
    for (let c = 0; c < 12; c++) {
      let cx = Math.random() * w, cy = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k < 3; k++) {
        cx += (Math.random() - 0.5) * 28; cy += (Math.random() - 0.5) * 28;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }, 2.4, 14, 14);

  const wallColor = createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#312921';
    ctx.fillRect(0, 0, w, h * 0.62);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = 0; x < w; x += 20) ctx.fillRect(x, 0, 8, h * 0.62);
    // Water drip stains from ceiling
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const dripH = 40 + Math.random() * 190;
      const g = ctx.createLinearGradient(x, 0, x, dripH);
      g.addColorStop(0, 'rgba(8, 6, 4, 0.55)');
      g.addColorStop(1, 'rgba(8, 6, 4, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 3 + Math.random() * 10, dripH);
    }
    // Checkered 1983 dado tile band
    const ty = h * 0.56, ts = 16;
    for (let x = 0; x < w; x += ts) {
      ctx.fillStyle = (x / ts) % 2 === 0 ? '#5c2675' : '#9c7322';
      ctx.fillRect(x, ty, ts, ts);
      ctx.fillStyle = (x / ts) % 2 === 0 ? '#110f14' : '#5c2675';
      ctx.fillRect(x, ty + ts, ts, ts);
    }
    // Dark wood wainscoting
    ctx.fillStyle = '#1b1109';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.44)';
      ctx.fillRect(x, h * 0.62, 4, h * 0.38);
      ctx.fillStyle = 'rgba(110, 72, 34, 0.08)';
      ctx.fillRect(x + 5, h * 0.64, 22, h * 0.34);
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(6, 5, 4, ${Math.random() * 0.28})`;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.5, 4 + Math.random() * 14, 24 + Math.random() * 85);
    }
  }, 2, 1, true);

  const wallNormal = createNormalFromHeight(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 0, w, h);
    const ty = h * 0.56, ts = 8;
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += ts) {
      ctx.strokeRect(x, ty, ts, ts);
      ctx.strokeRect(x, ty + ts, ts, ts);
    }
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = '#444444';
      ctx.fillRect(x, h * 0.62, 2, h * 0.38);
    }
  }, 2.2, 2, 1);

  const woodColor = createCanvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b180d';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const shade = Math.sin(y * 0.09) * 10 + (Math.random() - 0.5) * 14;
      ctx.fillStyle = `rgb(${Math.max(12, 44 + shade)}, ${Math.max(6, 24 + shade * 0.6)}, ${Math.max(4, 13 + shade * 0.3)})`;
      ctx.fillRect(0, y, w, 2);
    }
    // Scratches & coffee mug ring stain
    ctx.strokeStyle = 'rgba(12, 7, 3, 0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) {
      const sx = Math.random() * w, sy = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 18 + Math.random() * 44, sy + (Math.random() - 0.5) * 6); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(18, 9, 5, 0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.58, 22, 0, Math.PI * 2); ctx.stroke();
  }, 1, 1, true);

  const woodNormal = createNormalFromHeight(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = 128 + ((Math.sin(y * 0.14) * 28 + (Math.random() - 0.5) * 32) | 0);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 2);
    }
  }, 1.8, 1, 1);

  const ductWallTex = createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#272c33';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      const g = ctx.createLinearGradient(0, y, 0, y + 64);
      g.addColorStop(0, '#14171b');
      g.addColorStop(0.15, '#3b424c');
      g.addColorStop(0.85, '#262b32');
      g.addColorStop(1, '#101216');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, 64);
    }
    ctx.fillStyle = '#5f6875';
    for (let y = 10; y < h; y += 64) {
      for (let x = 16; x < w; x += 48) {
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = 0; i < 95; i++) {
      ctx.fillStyle = `rgba(5, 6, 8, ${Math.random() * 0.32})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 28, 0, Math.PI * 2); ctx.fill();
    }
    // Deep metallic animatronic claw marks
    ctx.strokeStyle = 'rgba(220, 228, 238, 0.36)';
    ctx.lineWidth = 2.4;
    for (let c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.moveTo(150 + c * 18, 100); ctx.lineTo(255 + c * 14, 360); ctx.stroke();
    }
  }, 2, 2, true);

  const ductNormal = createNormalFromHeight(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = '#383838'; ctx.fillRect(0, y, w, 3);
      ctx.fillStyle = '#b4b4b4'; ctx.fillRect(0, y + 3, w, 2);
    }
    ctx.fillStyle = '#dcdcdc';
    for (let y = 5; y < h; y += 32) {
      for (let x = 8; x < w; x += 24) {
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    for (let c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.moveTo(75 + c * 9, 50); ctx.lineTo(128 + c * 7, 180); ctx.stroke();
    }
  }, 2.4, 2, 2);

  // Plush / corroded springlock fabric maps
  const plushFreddy = makeMottledSuit(
    [156, 124, 28],
    'rgba(34, 22, 6, 0.38)',
    'rgba(208, 174, 62, 0.22)',
    'rgba(56, 22, 10, 0.24)'
  );
  const plushBonnie = makeMottledSuit(
    [146, 128, 36],
    'rgba(28, 30, 10, 0.42)',
    'rgba(198, 178, 66, 0.20)',
    'rgba(44, 24, 8, 0.26)'
  );

  const plushNormal = createNormalFromHeight(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 90 + ((Math.random() * 88) | 0);
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const len = 3 + Math.random() * 7;
      const ang = (Math.random() - 0.5) * 1.6 + Math.PI * 0.5;
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(240,240,240,0.28)' : 'rgba(20,20,20,0.28)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    // Recessed stitch trenches
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 3;
    [128, 384].forEach(sy => {
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    });
  }, 2.8, 2, 2);

  const plushRoughness = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ededed';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w, y = Math.random() * h, rad = 8 + Math.random() * 28;
      const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
      g.addColorStop(0, 'rgba(95, 95, 95, 0.58)');
      g.addColorStop(1, 'rgba(235, 235, 235, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
  }, 2, 2, false);

  // 512px Wet Acrylic Animatronic Eyes (NO baked white specular circle!)
  const buildEyeTexture = (irisInner, irisMid, irisOuter, pupilSize = 42) => createCanvasTex(512, 512, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const sg = ctx.createRadialGradient(cx, cy, 78, cx, cy, 256);
    sg.addColorStop(0, '#dbd8ce');
    sg.addColorStop(0.55, '#a8a296');
    sg.addColorStop(0.85, '#59554f');
    sg.addColorStop(1, '#1a1a1f');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);

    // Fine bloodshot capillaries + age stains on sclera
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(95, 22, 16, 0.42)' : 'rgba(138, 16, 16, 0.52)';
      ctx.lineWidth = 1.2 + Math.random() * 1.2;
      ctx.beginPath();
      const r0 = 114 + Math.random() * 16;
      const r1 = 175 + Math.random() * 24;
      const r2 = 225 + Math.random() * 24;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + 0.08) * r1, cy + Math.sin(a - 0.06) * r1);
      ctx.lineTo(cx + Math.cos(a - 0.05) * r2, cy + Math.sin(a + 0.08) * r2);
      ctx.stroke();
    }

    // Dark recessed limbal shadow ring
    ctx.fillStyle = '#090a0d';
    ctx.beginPath(); ctx.arc(cx, cy, 112, 0, Math.PI * 2); ctx.fill();

    // Rich fibrous iris
    const ig = ctx.createRadialGradient(cx, cy, pupilSize, cx, cy, 105);
    ig.addColorStop(0, irisInner);
    ig.addColorStop(0.45, irisMid);
    ig.addColorStop(0.88, irisOuter);
    ig.addColorStop(1, '#121318');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(cx, cy, 105, 0, Math.PI * 2); ctx.fill();

    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(10, 12, 18, 0.35)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (pupilSize + 3), cy + Math.sin(a) * (pupilSize + 3));
      ctx.lineTo(cx + Math.cos(a + 0.02) * 101, cy + Math.sin(a + 0.02) * 101);
      ctx.stroke();
    }

    // Deep pitch pupil
    ctx.fillStyle = '#020203';
    ctx.beginPath(); ctx.arc(cx, cy, pupilSize, 0, Math.PI * 2); ctx.fill();
  }, 1, 1, true);

  const eyeFreddyTex = buildEyeTexture('#9fb8d4', '#506b8a', '#1b2634', 42);
  const eyeBonnieTex = buildEyeTexture('#b5abc9', '#675a82', '#231c33', 38);

  const teethTex = createCanvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5a4326');
    g.addColorStop(0.24, '#b8a678');
    g.addColorStop(0.75, '#cfc3a1');
    g.addColorStop(1, '#8c7d59');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(38, 22, 10, ${Math.random() * 0.22})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 4 + Math.random() * 24);
    }
    ctx.strokeStyle = 'rgba(25, 16, 8, 0.48)';
    ctx.lineWidth = 1.4;
    for (let c = 0; c < 8; c++) {
      const x = Math.random() * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 16, h * 0.65); ctx.stroke();
    }
  }, 1, 1, true);

  const rustMetal = createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1b1e23';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 620; i++) {
      ctx.fillStyle = Math.random() > 0.6 ? 'rgba(98, 42, 15, 0.30)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 54, 2);
    }
    for (let i = 0; i < 45; i++) {
      const cx = Math.random() * w, cy = Math.random() * h, r = 8 + Math.random() * 24;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      g.addColorStop(0, 'rgba(84, 34, 12, 0.42)');
      g.addColorStop(1, 'rgba(84, 34, 12, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }, 2, 2, true);

  const metalNormal = createNormalFromHeight(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(220,220,220,0.22)' : 'rgba(30,30,30,0.28)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 34, 2);
    }
  }, 2.1, 2, 2);

  const doorTex = createCanvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1b1e23';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#0c0d10';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h * 0.44);
    ctx.strokeRect(10, h * 0.47, w - 20, h * 0.36);
    ctx.fillStyle = '#4e545e';
    for (let y = 20; y < h - 85; y += 44) {
      ctx.beginPath(); ctx.arc(20, y, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 20, y, 3.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, h - 78, w, 78); ctx.clip();
    ctx.fillStyle = '#c49118';
    ctx.fillRect(0, h - 78, w, 78);
    ctx.fillStyle = '#141416';
    for (let x = -100; x < w + 100; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, h - 78); ctx.lineTo(x + 18, h - 78); ctx.lineTo(x - 16, h); ctx.lineTo(x - 34, h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Grime & heavy animatronic claw slashes
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = `rgba(18, 12, 8, ${Math.random() * 0.25})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 24, 6 + Math.random() * 18);
    }
    ctx.strokeStyle = 'rgba(205, 212, 224, 0.34)';
    ctx.lineWidth = 2.4;
    for (let c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.moveTo(64 + c * 17, 200); ctx.lineTo(142 + c * 14, 345); ctx.stroke();
    }
  }, 1, 1, true);

  const doorNormal = createNormalFromHeight(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#929292';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#252525';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h * 0.44);
    ctx.strokeRect(10, h * 0.47, w - 20, h * 0.36);
    ctx.fillStyle = '#e8e8e8';
    for (let y = 20; y < h - 85; y += 44) {
      ctx.beginPath(); ctx.arc(20, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 20, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2.6;
    for (let c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.moveTo(64 + c * 17, 200); ctx.lineTo(142 + c * 14, 345); ctx.stroke();
    }
  }, 2.4, 1, 1);

  const posterCelebrate = createCanvasTex(256, 360, (ctx, w, h) => {
    ctx.fillStyle = '#1a1122';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4a138';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#d4a138';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("FREDBEAR'S", w / 2, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('FAMILY DINER', w / 2, 82);
    // Bear silhouette + face
    ctx.fillStyle = '#b98628';
    ctx.beginPath(); ctx.arc(w * 0.36, 196, 44, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.28, 152, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.44, 152, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6d2e8c';
    ctx.fillRect(w * 0.36 - 18, 122, 36, 26);
    ctx.fillStyle = '#09090b';
    ctx.beginPath(); ctx.arc(w * 0.32, 186, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.40, 186, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9dec0';
    ctx.fillRect(w * 0.36 - 16, 212, 32, 10);
    // Rabbit silhouette + face
    ctx.fillStyle = '#a29834';
    ctx.beginPath(); ctx.arc(w * 0.66, 205, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w * 0.60, 118, 14, 52);
    ctx.fillRect(w * 0.68, 118, 14, 52);
    ctx.fillStyle = '#09090b';
    ctx.beginPath(); ctx.arc(w * 0.62, 195, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.70, 195, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('CELEBRE!', w / 2, 315);
    // Aged grime overlay
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = `rgba(10, 8, 6, ${Math.random() * 0.22})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 12 + Math.random() * 28, 6 + Math.random() * 14);
    }
  }, 1, 1, true);

  const posterRules = createCanvasTex(256, 340, (ctx, w, h) => {
    ctx.fillStyle = '#c5baa4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#8e1b22';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REGRAS DE SEGURANÇA', w / 2, 50);
    ctx.fillStyle = '#1b1a17';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    [
      '1. NÃO CORRA NO SALÃO.',
      '2. NÃO GRITE PERTO DOS TRAJES.',
      '3. NÃO TOQUE NO FREDBEAR.',
      '4. CUIDADO COM AS MOLAS.',
      '5. VIGIE O DUTO DE AR.',
      '6. FIQUE LONGE DA COZINHA.'
    ].forEach((l, i) => ctx.fillText(l, 18, 95 + i * 38));
    // Coffee / blood smudge stain on corner
    const g = ctx.createRadialGradient(210, 290, 4, 210, 290, 48);
    g.addColorStop(0, 'rgba(65, 16, 12, 0.35)');
    g.addColorStop(1, 'rgba(65, 16, 12, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(210, 290, 48, 0, Math.PI * 2); ctx.fill();
  }, 1, 1, true);

  const kidsDrawingTex = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e0d9c4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8861d';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(128, 115, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5c2675';
    ctx.fillRect(108, 45, 40, 24);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(110, 108, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(146, 108, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#991818';
    ctx.lineWidth = 4;
    ctx.strokeRect(100, 130, 56, 20);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MEU AMIGO FREDBEAR', w / 2, 224);
  }, 1, 1, true);

  const kidsDrawingTex2 = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dcd3bd';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8b7b1f';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(128, 125, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(98, 48, 16, 40);
    ctx.strokeRect(140, 42, 16, 44);
    ctx.fillStyle = '#0c0c0e';
    ctx.beginPath(); ctx.arc(114, 116, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(142, 116, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(116, 114, 3, 3);
    ctx.fillRect(140, 114, 3, 3);
    ctx.fillStyle = '#881212';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ELE VEM PELO DUTO', w / 2, 222);
  }, 1, 1, true);

  const crtScreenTex = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#031208';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#24a854';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x += 6) {
      const y = h * 0.58 + Math.sin(x * 0.08) * 32 + (Math.random() - 0.5) * 16;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#48f084';
    ctx.font = '14px monospace';
    ctx.fillText('SYS_1983 // ATIVO', 14, 28);
    ctx.fillText('TRAVA MOLA: CRÍTICO', 14, 50);
    ctx.fillText('DUTO: SENSOR AR', 14, 72);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
  }, 1, 1, true);

  const arcadeTex = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#09091c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4deeea';
    ctx.fillRect(28, 36, 200, 16);
    ctx.fillStyle = '#f000ff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FREDBEAR 83', w / 2, 92);
    ctx.fillStyle = '#ffe700';
    ctx.fillRect(98, 122, 60, 60);
    ctx.fillStyle = '#000';
    ctx.fillRect(110, 136, 10, 10);
    ctx.fillRect(136, 136, 10, 10);
    ctx.fillStyle = '#52ff8f';
    ctx.font = '15px monospace';
    ctx.fillText('INSERT COIN', w / 2, 224);
  }, 1, 1, true);

  const stageMarqueeTex = createCanvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1e0a26';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e6b245';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("FREDBEAR'S FAMILY DINER", w / 2, 78);
  }, 1, 1, true);

  const curtainTex = createCanvasTex(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#27040b');
      g.addColorStop(0.5, '#680e1d');
      g.addColorStop(1, '#1b0206');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, h);
    }
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, w, 1);
    }
  }, 3, 1, true);

  const pizzaBoxTex = createCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cfc3aa';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a32125';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#a32125';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("FREDBEAR'S", w / 2, 92);
    ctx.fillStyle = '#5c2675';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PIZZA!', w / 2, 132);
    ctx.fillStyle = 'rgba(130, 82, 20, 0.28)';
    ctx.beginPath(); ctx.arc(170, 195, 28, 0, Math.PI * 2); ctx.fill();
  }, 1, 1, true);

  const dustSpriteTex = createCanvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 236, 196, 1)');
    g.addColorStop(0.35, 'rgba(255, 224, 172, 0.5)');
    g.addColorStop(1, 'rgba(255, 224, 172, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 1, 1, true);

  return {
    floorColor, floorRoughness, floorNormal,
    wallColor, wallNormal,
    woodColor, woodNormal,
    ductWallTex, ductNormal,
    plushFreddy, plushBonnie, plushNormal, plushRoughness,
    eyeFreddyTex, eyeBonnieTex, teethTex,
    rustMetal, metalNormal, doorTex, doorNormal,
    posterCelebrate, posterRules, kidsDrawingTex, kidsDrawingTex2,
    crtScreenTex, arcadeTex, stageMarqueeTex, curtainTex, pizzaBoxTex, dustSpriteTex
  };
}
