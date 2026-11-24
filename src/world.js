import * as THREE from 'three';
import { saveState } from './config.js';
import { createVolumetricConeMat } from './shaders.js';
import { buildAnimatronic } from './animatronics.js';

export function buildWorld(scene, textures) {
  const interactables = [];

  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.floorColor,
    roughnessMap: textures.floorRoughness,
    normalMap: textures.floorNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.56,
    metalness: 0.12
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.wallColor,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.88,
    metalness: 0.03
  });

  const frontWallMat = wallMat.clone();
  frontWallMat.map = textures.wallColor.clone();
  frontWallMat.map.repeat.set(1, 1);
  frontWallMat.map.needsUpdate = true;

  const darkCeilingMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.96 });
  const metalMat = new THREE.MeshStandardMaterial({
    map: textures.rustMetal,
    normalMap: textures.metalNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.44,
    metalness: 0.86
  });
  const ductWallMat = new THREE.MeshStandardMaterial({
    map: textures.ductWallTex,
    normalMap: textures.ductNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.48,
    metalness: 0.80
  });
  const woodDeskMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    normalMap: textures.woodNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.58,
    metalness: 0.06
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8ea2a2,
    transparent: true,
    opacity: 0.24,
    roughness: 0.12,
    metalness: 0.12,
    clearcoat: 0.8
  });
  const wireMatDark = new THREE.MeshStandardMaterial({ color: 0x151619, roughness: 0.72 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0x997028, roughness: 0.35, metalness: 0.86 });

  function freezeStatic(m) {
    m.updateMatrix();
    m.matrixAutoUpdate = false;
    return m;
  }

  function mkBox(w, h, d, mat, x, y, z, shadow = false, isDynamic = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    scene.add(m);
    return isDynamic ? m : freezeStatic(m);
  }

  function mkAlignedFrontWallBox(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(norm.getZ(i)) > 0.5) {
        const wx = pos.getX(i) + x;
        const wy = pos.getY(i) + y;
        uv.setXY(i, (wx + 2.9) / 2.9, wy / 3.4);
      }
    }
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, frontWallMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(freezeStatic(m));
    return m;
  }

  function addCeilingCable(x1, y1, z1, x2, y2, z2, sag = 0.25) {
    const mid = new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2 - sag, (z1 + z2) / 2);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x1, y1, z1), mid, new THREE.Vector3(x2, y2, z2)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.014, 5, false), wireMatDark);
    scene.add(freezeStatic(m));
  }

  // Main Floor & Ceiling
  const mainFloor = new THREE.Mesh(new THREE.PlaneGeometry(42, 46), floorMat);
  mainFloor.rotation.x = -Math.PI / 2;
  mainFloor.position.set(0, 0, -14);
  mainFloor.receiveShadow = true;
  scene.add(freezeStatic(mainFloor));

  const mainCeiling = new THREE.Mesh(new THREE.PlaneGeometry(42, 46), darkCeilingMat);
  mainCeiling.rotation.x = Math.PI / 2;
  mainCeiling.position.set(0, 3.4, -14);
  scene.add(freezeStatic(mainCeiling));

  // Deep horror ambient contrast
  scene.add(new THREE.AmbientLight(0x0e111a, 0.16));
  scene.add(new THREE.HemisphereLight(0x1f2538, 0x090705, 0.24));

  // =========================================================================
  // A. OFFICE WITH HOLLOW CUT-OUT OVERHEAD VENT TUNNEL
  // =========================================================================
  mkAlignedFrontWallBox(2.28, 3.40, 0.25, -1.76, 1.70, -2.35);
  mkAlignedFrontWallBox(2.28, 3.40, 0.25,  1.76, 1.70, -2.35);
  mkAlignedFrontWallBox(1.24, 2.22, 0.25,  0.00, 1.11, -2.35);
  mkAlignedFrontWallBox(1.24, 0.30, 0.25,  0.00, 3.25, -2.35);

  mkBox(5.8, 3.4, 0.25, wallMat, 0, 1.7, 2.65);
  mkBox(5.6, 0.14, 0.06, metalMat, 0, 0.07, -2.21);
  mkBox(5.6, 0.10, 0.10, metalMat, 0, 3.25, -2.20);
  // Wall conduit pipes & electrical breaker box
  mkBox(0.05, 3.2, 0.05, metalMat, -2.55, 1.6, -2.21);
  mkBox(0.05, 3.2, 0.05, metalMat,  2.55, 1.6, -2.21);
  mkBox(0.38, 0.52, 0.10, metalMat, -2.42, 1.55, -2.18);
  addCeilingCable(-2.6, 3.3, -2.0, -0.68, 2.95, -2.15, 0.28);
  addCeilingCable(2.6, 3.3, -2.0, 0.68, 2.95, -2.15, 0.32);
  addCeilingCable(-2.5, 3.35, 0.8, 2.5, 3.35, 0.4, 0.30);

  // Left & Right Side Walls + Window Frames + Mullions + Doorways
  [-1, 1].forEach(sx => {
    const wx = sx * 2.85;
    mkBox(0.25, 3.4, 0.55, wallMat, wx, 1.7, -2.1);
    mkBox(0.25, 1.15, 1.0, wallMat, wx, 0.575, -1.32);
    mkBox(0.25, 1.05, 1.0, wallMat, wx, 2.88, -1.32);
    mkBox(0.25, 1.2, 1.0, glassMat, wx, 1.75, -1.32);
    mkBox(0.28, 0.06, 1.04, metalMat, wx, 1.75, -1.32);
    mkBox(0.28, 0.06, 1.04, metalMat, wx, 1.15, -1.32);
    mkBox(0.28, 0.06, 1.04, metalMat, wx, 2.35, -1.32);
    mkBox(0.27, 1.2, 0.04, metalMat, wx, 1.75, -1.32);
    mkBox(0.25, 3.4, 0.2, metalMat, wx, 1.7, -0.75);
    mkBox(0.25, 1.05, 1.2, wallMat, wx, 2.88, -0.05);
    mkBox(0.25, 3.4, 2.05, wallMat, wx, 1.7, 1.62);
    mkBox(0.20, 2.4, 0.09, metalMat, wx, 1.2, -0.64);
    mkBox(0.20, 2.4, 0.09, metalMat, wx, 1.2, 0.54);
    mkBox(0.22, 0.14, 1.28, metalMat, wx, 2.42, -0.05);
  });

  const doorMatL = new THREE.MeshStandardMaterial({
    map: textures.doorTex,
    normalMap: textures.doorNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.42,
    metalness: 0.80
  });
  const doorMatR = doorMatL.clone();
  const doorMeshL = mkBox(0.14, 2.38, 1.22, doorMatL, -2.85, 3.55, -0.05, true, true);
  const doorMeshR = mkBox(0.14, 2.38, 1.22, doorMatR, 2.85, 3.55, -0.05, true, true);

  // 3D Overhead Ventilation Shaft + Bent Grates
  mkBox(1.42, 0.10, 0.34, metalMat, 0, 3.13, -2.30);
  mkBox(1.42, 0.10, 0.34, metalMat, 0, 2.19, -2.30);
  mkBox(0.10, 1.02, 0.34, metalMat, -0.66, 2.66, -2.30);
  mkBox(0.10, 1.02, 0.34, metalMat,  0.66, 2.66, -2.30);

  const boltMat = new THREE.MeshStandardMaterial({ color: 0x6c7480, roughness: 0.35, metalness: 0.9 });
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6);
  [[-0.66, 3.13], [0.66, 3.13], [-0.66, 2.19], [0.66, 2.19], [0, 3.13], [0, 2.19]].forEach(b => {
    const m = new THREE.Mesh(boltGeo, boltMat);
    m.position.set(b[0], b[1], -2.12);
    m.rotation.x = Math.PI / 2;
    scene.add(freezeStatic(m));
  });

  mkBox(1.28, 0.08, 3.35, ductWallMat, 0, 2.18, -3.95);
  mkBox(1.28, 0.08, 3.35, ductWallMat, 0, 3.14, -3.95);
  mkBox(0.08, 0.98, 3.35, ductWallMat, -0.64, 2.66, -3.95);
  mkBox(0.08, 0.98, 3.35, ductWallMat,  0.64, 2.66, -3.95);
  mkBox(1.28, 0.98, 0.10, ductWallMat,  0, 2.66, -5.62);

  [-2.75, -3.45, -4.15, -4.85].forEach(rz => {
    mkBox(1.22, 0.04, 0.05, metalMat, 0, 2.23, rz);
    mkBox(1.22, 0.04, 0.05, metalMat, 0, 3.09, rz);
    mkBox(0.04, 0.90, 0.05, metalMat, -0.59, 2.66, rz);
    mkBox(0.04, 0.90, 0.05, metalMat,  0.59, 2.66, rz);
  });

  const officeVentFanGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.68),
    new THREE.MeshBasicMaterial({ color: 0x0f3219 })
  );
  officeVentFanGlow.position.set(0, 2.66, -5.54);
  scene.add(freezeStatic(officeVentFanGlow));

  const officeVentFan = new THREE.Group();
  officeVentFan.position.set(0, 2.66, -5.42);
  scene.add(officeVentFan);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.02), wireMatDark);
    blade.position.y = 0.17;
    const p = new THREE.Group();
    p.rotation.z = (i * Math.PI) / 2;
    p.add(blade);
    officeVentFan.add(p);
  }

  addCeilingCable(-0.56, 3.09, -2.55, -0.38, 2.98, -3.15, 0.12);
  addCeilingCable(0.54, 3.09, -2.65, 0.42, 2.95, -3.35, 0.14);

  [-0.22, 0.0, 0.22].forEach((dy, idx) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.022, 0.04), metalMat);
    bar.position.set(0, 2.66 + dy, -2.24);
    bar.rotation.z = idx === 1 ? -0.035 : idx === 2 ? 0.02 : 0;
    bar.castShadow = true;
    scene.add(freezeStatic(bar));
  });
  [-0.36, 0.36].forEach(dx => mkBox(0.024, 0.88, 0.04, metalMat, dx, 2.66, -2.24, true));

  const ventShutter = mkBox(1.24, 0.90, 0.05, doorMatL, -1.32, 2.66, -2.14, true, true);

  const ventBtnMat = new THREE.MeshStandardMaterial({ color: 0xb87414, emissive: 0x552200, emissiveIntensity: 1.0, roughness: 0.35 });
  const ventBtnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), ventBtnMat);
  ventBtnMesh.position.set(0, 1.98, -2.19);
  ventBtnMesh.userData = { action: 'vent', label: 'TRAVAR DUTO [V]' };
  scene.add(freezeStatic(ventBtnMesh));
  mkBox(0.34, 0.22, 0.04, metalMat, 0, 1.98, -2.22);
  interactables.push(ventBtnMesh);

  function buildSwitchPanel(x, z, rotY, tagDoor, tagLight) {
    const grp = new THREE.Group();
    grp.position.set(x, 1.38, z);
    grp.rotation.y = rotY;
    scene.add(grp);
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.50, 0.07), metalMat));
    // Conduit running up the wall from switch box
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.85, 8), metalMat);
    pipe.position.set(0, 1.15, -0.01);
    grp.add(pipe);

    const dMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0x440000, emissiveIntensity: 1.15, roughness: 0.3 });
    const dBtn = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.05), dMat);
    dBtn.position.set(0, 0.10, 0.04);
    dBtn.userData = { action: tagDoor, label: tagDoor === 'doorL' ? 'PORTA ESQ [Q]' : 'PORTA DIR [E]' };
    grp.add(dBtn);
    interactables.push(dBtn);

    const lMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x222222, emissiveIntensity: 0.85, roughness: 0.3 });
    const lBtn = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.05), lMat);
    lBtn.position.set(0, -0.10, 0.04);
    lBtn.userData = { action: tagLight, label: tagLight === 'lightL' ? 'LUZ ESQ [Z]' : 'LUZ DIR [C]' };
    grp.add(lBtn);
    interactables.push(lBtn);
    return { dMat, lMat };
  }
  const panelL = buildSwitchPanel(-2.68, 0.72, Math.PI / 2, 'doorL', 'lightL');
  const panelR = buildSwitchPanel(2.68, 0.72, -Math.PI / 2, 'doorR', 'lightR');

  // Office Wood Desk with Trim & Props
  mkBox(3.04, 0.09, 1.00, woodDeskMat, 0, 0.86, -1.62, true);
  mkBox(3.08, 0.04, 1.04, metalMat, 0, 0.84, -1.62);
  mkBox(0.12, 0.84, 0.88, woodDeskMat, -1.36, 0.42, -1.62);
  mkBox(0.12, 0.84, 0.88, woodDeskMat,  1.36, 0.42, -1.62);
  mkBox(2.7, 0.72, 0.06, woodDeskMat, 0, 0.42, -2.02);
  mkBox(0.65, 0.22, 0.04, woodDeskMat, -0.98, 0.68, -1.18);
  mkBox(0.16, 0.02, 0.03, brassMat, -0.98, 0.68, -1.15);

  const crtScreenMat = new THREE.MeshStandardMaterial({
    map: textures.crtScreenTex,
    emissive: 0x22bb58,
    emissiveMap: textures.crtScreenTex,
    emissiveIntensity: 1.2,
    roughness: 0.22
  });
  const buildCRT = (x, y, z, ry, sc = 1) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.scale.setScalar(sc);
    scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.40, 0.42), new THREE.MeshStandardMaterial({ color: 0x35322c, roughness: 0.72 }));
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.04), wireMatDark);
    bezel.position.set(0, 0.01, 0.205);
    g.add(bezel);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), crtScreenMat);
    scr.position.set(0, 0.01, 0.228);
    g.add(scr);
    freezeStatic(g);
  };
  buildCRT(-0.92, 1.10, -1.72, 0.28, 1.0);
  buildCRT(-0.90, 1.47, -1.72, 0.24, 0.85);
  buildCRT(0.95, 1.08, -1.72, -0.32, 0.95);

  // Subtle green CRT spill light on desk
  const crtDeskGlow = new THREE.PointLight(0x36e676, 0.58, 2.3, 1.8);
  crtDeskGlow.position.set(-0.55, 1.15, -1.35);
  scene.add(crtDeskGlow);

  // Keyboard + Desk Cassette Player (Spins during Phone Guy calls!)
  mkBox(0.46, 0.04, 0.16, new THREE.MeshStandardMaterial({ color: 0x4b473e, roughness: 0.8 }), -0.05, 0.92, -1.32);

  const tapeDeck = new THREE.Group();
  tapeDeck.position.set(0.68, 0.935, -1.34);
  tapeDeck.rotation.y = -0.18;
  scene.add(tapeDeck);
  tapeDeck.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.20), new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.48 })));
  const tapeWindow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.014, 0.09), glassMat);
  tapeWindow.position.set(-0.02, 0.032, -0.02);
  tapeDeck.add(tapeWindow);
  const reelGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 8);
  const reelMat = new THREE.MeshStandardMaterial({ color: 0xc2b8a3, roughness: 0.5 });
  const tapeReelL = new THREE.Mesh(reelGeo, reelMat);
  tapeReelL.position.set(-0.06, 0.030, -0.02);
  tapeDeck.add(tapeReelL);
  const tapeReelR = new THREE.Mesh(reelGeo, reelMat);
  tapeReelR.position.set(0.02, 0.030, -0.02);
  tapeDeck.add(tapeReelR);
  const tapeLedMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 0.0 });
  const tapeLed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), tapeLedMat);
  tapeLed.position.set(0.10, 0.034, 0.06);
  tapeDeck.add(tapeLed);

  // Detailed Metal Cage Desk Fan
  const fanGroup = new THREE.Group();
  fanGroup.position.set(0.38, 0.90, -1.55);
  fanGroup.rotation.y = -0.25;
  scene.add(fanGroup);
  const fanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.135, 0.06, 14), metalMat);
  fanBase.castShadow = true;
  fanGroup.add(fanBase);
  const fanStand = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.22, 8), metalMat);
  fanStand.position.y = 0.13;
  fanGroup.add(fanStand);
  const fanMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.13, 12), metalMat);
  fanMotor.rotation.x = Math.PI / 2;
  fanMotor.position.set(0, 0.28, -0.04);
  fanMotor.castShadow = true;
  fanGroup.add(fanMotor);
  [0.195, 0.135, 0.075].forEach((r, idx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 6, 20), metalMat);
    ring.position.set(0, 0.28, 0.03 + idx * 0.012);
    fanGroup.add(ring);
  });
  for (let s = 0; s < 4; s++) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.39, 5), metalMat);
    strut.position.set(0, 0.28, 0.035);
    strut.rotation.z = (s * Math.PI) / 4;
    fanGroup.add(strut);
  }
  const fanBlades = new THREE.Group();
  fanBlades.position.set(0, 0.28, 0.03);
  fanGroup.add(fanBlades);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.155, 0.01), metalMat);
    b.position.y = 0.078;
    b.rotation.y = 0.45;
    const piv = new THREE.Group();
    piv.rotation.z = (i * Math.PI) / 2;
    piv.add(b);
    fanBlades.add(piv);
  }

  // Upgraded Desk Fredbear Plushie
  const plushGroup = new THREE.Group();
  plushGroup.position.set(-0.36, 0.90, -1.48);
  plushGroup.rotation.y = 0.22;
  scene.add(plushGroup);
  const pGold = new THREE.MeshPhysicalMaterial({ map: textures.plushFreddy, normalMap: textures.plushNormal, roughness: 0.92, sheen: 0.5 });
  const pPurp = new THREE.MeshStandardMaterial({ color: 0x521d6d, roughness: 0.78 });
  const pBlack = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.26 });
  const pBody = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), pGold);
  pBody.position.y = 0.09;
  pBody.scale.set(1, 1.12, 0.92);
  pBody.castShadow = true;
  plushGroup.add(pBody);
  const plushHead = new THREE.Group();
  plushHead.position.y = 0.235;
  plushGroup.add(plushHead);
  const pHeadMesh = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 12), pGold);
  pHeadMesh.castShadow = true;
  plushHead.add(pHeadMesh);
  const pSnout = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.9 }));
  pSnout.position.set(0, -0.02, 0.082);
  pSnout.scale.set(1.24, 0.72, 0.9);
  plushHead.add(pSnout);
  const pEar1 = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), pGold);
  pEar1.position.set(-0.088, 0.09, 0);
  plushHead.add(pEar1);
  const pEar2 = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), pGold);
  pEar2.position.set(0.088, 0.09, 0);
  plushHead.add(pEar2);
  const pHatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 12), pPurp);
  pHatBrim.position.set(0, 0.105, 0);
  plushHead.add(pHatBrim);
  const pHat = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.068, 12), pPurp);
  pHat.position.set(0, 0.138, 0);
  plushHead.add(pHat);
  const pBow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.026, 0.02), pPurp);
  pBow.position.set(0, 0.148, 0.085);
  plushGroup.add(pBow);
  const pNose = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), pBlack);
  pNose.position.set(0, -0.005, 0.128);
  plushHead.add(pNose);
  const pEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pEyeSocketMat = new THREE.MeshBasicMaterial({ color: 0x060608 });
  const pEyeSock1 = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), pEyeSocketMat);
  pEyeSock1.position.set(-0.038, 0.02, 0.092);
  plushHead.add(pEyeSock1);
  const pEyeSock2 = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), pEyeSocketMat);
  pEyeSock2.position.set(0.038, 0.02, 0.092);
  plushHead.add(pEyeSock2);
  const plushPupilL = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), pEyeMat);
  plushPupilL.position.set(-0.038, 0.02, 0.106);
  plushHead.add(plushPupilL);
  const plushPupilR = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), pEyeMat);
  plushPupilR.position.set(0.038, 0.02, 0.106);
  plushHead.add(plushPupilR);

  const plushHit = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  plushHit.position.set(0, 0.20, 0);
  plushHit.userData = { action: 'plush', label: '*APERTE O NARIZ DO FREDBEAR*' };
  plushGroup.add(plushHit);
  interactables.push(plushHit);

  // Cup with straw + crumpled paper + tilted sticky notes
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.036, 0.135, 12), new THREE.MeshStandardMaterial({ color: 0xd0c9ba, roughness: 0.4 }));
  cup.position.set(0.08, 0.97, -1.36);
  cup.castShadow = true;
  scene.add(freezeStatic(cup));
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), new THREE.MeshStandardMaterial({ color: 0xb82228, roughness: 0.4 }));
  straw.position.set(0.085, 1.055, -1.36);
  straw.rotation.z = -0.18;
  scene.add(freezeStatic(straw));

  const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8d0be, roughness: 0.95 });
  [[-0.56, 0.93, -1.25], [0.88, 0.93, -1.20], [-1.05, 0.03, -0.75]].forEach(p => {
    const ball = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), paperMat);
    ball.position.set(p[0], p[1], p[2]);
    scene.add(freezeStatic(ball));
  });
  const noteMat = new THREE.MeshStandardMaterial({ color: 0xd9c24e, roughness: 0.85 });
  const sticky1 = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), noteMat);
  sticky1.position.set(-0.74, 1.32, -1.49);
  sticky1.rotation.set(0, 0.28, -0.14);
  scene.add(freezeStatic(sticky1));

  // Posters & Drawings
  const makePoster = (tex, w, h, x, y, z, ry, rz = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 }));
    m.position.set(x, y, z);
    m.rotation.set(0, ry, rz);
    scene.add(freezeStatic(m));
  };
  makePoster(textures.posterCelebrate, 0.95, 1.32, -1.72, 1.85, -2.21, 0, 0.03);
  makePoster(textures.posterRules, 0.90, 1.20, 1.72, 1.85, -2.21, 0, -0.02);
  makePoster(textures.kidsDrawingTex, 0.42, 0.42, -1.05, 1.45, -2.21, 0, -0.06);
  makePoster(textures.kidsDrawingTex2, 0.38, 0.38, 1.08, 1.65, -2.21, 0, 0.08);

  // Hanging Office Lamp + Volumetric Shaft
  const lampPivot = new THREE.Group();
  lampPivot.position.set(0, 3.4, -0.65);
  scene.add(lampPivot);
  const lampCord = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.55, 6), wireMatDark);
  lampCord.position.y = -0.27;
  lampPivot.add(lampCord);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 14, 1, true), metalMat);
  lampShade.position.y = -0.55;
  lampPivot.add(lampShade);
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd79b }));
  bulbMesh.position.y = -0.58;
  lampPivot.add(bulbMesh);
  const officeVolCone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.95, 2.7, 22, 1, true), createVolumetricConeMat(0xffcb82, 0.095));
  officeVolCone.position.y = -1.92;
  lampPivot.add(officeVolCone);

  const officeLamp = new THREE.PointLight(0xffc67a, 2.25, 9.2, 1.65);
  officeLamp.position.set(0, -0.62, 0);
  officeLamp.shadow.mapSize.set(1024, 1024);
  officeLamp.shadow.bias = -0.0006;
  officeLamp.shadow.normalBias = 0.03;
  officeLamp.castShadow = saveState.quality === 'high';
  lampPivot.add(officeLamp);

  // Hall Spotlights & Flashlight (Dynamic Shadow Casters in High Mode!)
  const hallLightL = new THREE.SpotLight(0xcfe2ff, 0, 12, Math.PI / 3.3, 0.45, 1.5);
  hallLightL.position.set(-2.3, 2.4, -0.5);
  hallLightL.target.position.set(-4.4, 1.1, -0.5);
  hallLightL.shadow.mapSize.set(512, 512);
  hallLightL.shadow.bias = -0.0006;
  scene.add(hallLightL);
  scene.add(hallLightL.target);

  const hallLightR = new THREE.SpotLight(0xcfe2ff, 0, 12, Math.PI / 3.3, 0.45, 1.5);
  hallLightR.position.set(2.3, 2.4, -0.5);
  hallLightR.target.position.set(4.4, 1.1, -0.5);
  hallLightR.shadow.mapSize.set(512, 512);
  hallLightR.shadow.bias = -0.0006;
  scene.add(hallLightR);
  scene.add(hallLightR.target);

  const flashlight = new THREE.SpotLight(0xfff1d0, 0, 16, Math.PI / 5.0, 0.40, 1.2);
  flashlight.position.set(0.18, 1.25, 1.25);
  flashlight.shadow.mapSize.set(512, 512);
  flashlight.shadow.bias = -0.0005;
  scene.add(flashlight);
  scene.add(flashlight.target);

  const flashVolGeo = new THREE.CylinderGeometry(0.03, 0.92, 4.2, 16, 1, true);
  flashVolGeo.translate(0, -2.1, 0);
  flashVolGeo.rotateX(Math.PI / 2);
  const flashVolCone = new THREE.Mesh(flashVolGeo, createVolumetricConeMat(0xfff2cc, 0.15));
  flashVolCone.position.copy(flashlight.position);
  flashVolCone.visible = false;
  scene.add(flashVolCone);

  const jumpscareLight = new THREE.PointLight(0xfff0d4, 0, 6.0, 1.0);
  jumpscareLight.position.set(0, 1.65, 1.1);
  scene.add(jumpscareLight);

  // =========================================================================
  // B. STATIC DINER ROOMS (ENHANCED PROPS & ATMOSPHERE)
  // =========================================================================
  // West & East Hallways
  mkBox(0.25, 3.4, 15.0, wallMat, -5.45, 1.7, -5.5);
  mkBox(0.25, 3.4, 9.8, wallMat, -2.85, 1.7, -7.2);
  makePoster(textures.posterRules, 0.9, 1.2, -5.3, 1.8, -4.8, Math.PI / 2, -0.04);
  makePoster(textures.posterCelebrate, 0.9, 1.2, -5.3, 1.8, -8.5, Math.PI / 2, 0.03);
  makePoster(textures.kidsDrawingTex2, 0.5, 0.5, -5.3, 1.9, -2.2, Math.PI / 2, 0.05);
  addCeilingCable(-4.1, 3.35, -3.5, -4.1, 3.35, -8.5, 0.42);
  // West Corridor Conduit & Trash Bin
  mkBox(0.06, 0.06, 13.0, metalMat, -5.25, 3.15, -6.5);
  mkBox(0.45, 0.65, 0.45, metalMat, -5.05, 0.325, -7.0);

  mkBox(0.25, 3.4, 15.0, wallMat, 5.45, 1.7, -5.5);
  mkBox(0.25, 3.4, 9.8, wallMat, 2.85, 1.7, -7.2);
  makePoster(textures.posterCelebrate, 0.9, 1.2, 5.3, 1.8, -4.5, -Math.PI / 2, 0.04);
  makePoster(textures.posterRules, 0.9, 1.2, 5.3, 1.8, -8.8, -Math.PI / 2, -0.05);
  makePoster(textures.kidsDrawingTex, 0.5, 0.5, 5.3, 1.9, -2.2, -Math.PI / 2, -0.04);
  addCeilingCable(4.1, 3.35, -4.0, 4.1, 3.35, -9.2, 0.45);
  mkBox(0.06, 0.06, 13.0, metalMat, 5.25, 3.15, -6.5);
  mkBox(0.45, 0.65, 0.45, metalMat, 5.05, 0.325, -6.4);

  // Main Dining Hall + Party Tables + Arcades
  mkBox(17.5, 3.4, 0.25, wallMat, 0, 1.7, -24.5);
  mkBox(0.25, 3.4, 12.2, wallMat, -8.5, 1.7, -18.5);
  mkBox(0.25, 3.4, 12.2, wallMat, 8.5, 1.7, -18.5);

  const tableClothMat = new THREE.MeshStandardMaterial({ color: 0xd9d0b8, roughness: 0.78 });
  const partyHatMat1 = new THREE.MeshStandardMaterial({ color: 0x6d2e8c, roughness: 0.5 });
  const partyHatMat2 = new THREE.MeshStandardMaterial({ color: 0xd4a138, roughness: 0.5 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x26282e, roughness: 0.6, metalness: 0.5 });
  const balloonMat1 = new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.25, metalness: 0.1 });
  const balloonMat2 = new THREE.MeshStandardMaterial({ color: 0xe09f1f, roughness: 0.25, metalness: 0.1 });
  const pizzaMat = new THREE.MeshStandardMaterial({ map: textures.pizzaBoxTex, roughness: 0.85 });
  const hatGeo = new THREE.ConeGeometry(0.11, 0.26, 8);
  const chairGeo = new THREE.BoxGeometry(0.42, 0.45, 0.42);

  [-3.4, 3.4].forEach((tx, tIdx) => {
    mkBox(2.2, 0.08, 5.4, tableClothMat, tx, 0.78, -17.5);
    mkBox(0.14, 0.75, 0.14, metalMat, tx - 0.8, 0.37, -15.4);
    mkBox(0.14, 0.75, 0.14, metalMat, tx + 0.8, 0.37, -19.6);
    mkBox(0.55, 0.06, 0.55, pizzaMat, tx + (tIdx === 0 ? 0.35 : -0.35), 0.85, -17.4);
    for (let z = -19.2; z <= -15.6; z += 1.2) {
      const hat = new THREE.Mesh(hatGeo, Math.abs(z) % 2 > 1 ? partyHatMat1 : partyHatMat2);
      hat.position.set(tx + Math.sin(z) * 0.4, 0.95, z);
      scene.add(freezeStatic(hat));
      const chair = new THREE.Mesh(chairGeo, chairMat);
      chair.position.set(tx + (tIdx === 0 ? -1.35 : 1.35), 0.23, z);
      if (Math.abs(z + 16.8) < 0.3 && tIdx === 1) {
        chair.rotation.z = 1.25;
        chair.position.y = 0.21;
      }
      scene.add(freezeStatic(chair));
    }
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), tIdx === 0 ? balloonMat1 : balloonMat2);
    b1.scale.y = 1.2;
    b1.position.set(tx, 2.25, -16.2);
    scene.add(freezeStatic(b1));
    mkBox(0.01, 1.4, 0.01, wireMatDark, tx, 1.5, -16.2);
  });

  const arcScreenMat = new THREE.MeshStandardMaterial({
    map: textures.arcadeTex,
    emissive: 0x2288aa,
    emissiveMap: textures.arcadeTex,
    emissiveIntensity: 1.05
  });
  for (let a = 0; a < 3; a++) {
    const az = -15.4 - a * 1.45;
    mkBox(0.82, 1.85, 0.85, new THREE.MeshStandardMaterial({ color: a % 2 === 0 ? 0x1b1529 : 0x291519, roughness: 0.65 }), 7.9, 0.92, az);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.46), arcScreenMat);
    scr.position.set(7.48, 1.25, az);
    scr.rotation.y = -Math.PI / 2;
    scene.add(freezeStatic(scr));
  }

  // Main Show Stage (CAM 01)
  const stageMat = new THREE.MeshStandardMaterial({ map: textures.woodColor, normalMap: textures.woodNormal, roughness: 0.72 });
  mkBox(7.2, 0.46, 3.2, stageMat, 0, 0.23, -22.8);
  mkBox(7.25, 0.07, 3.25, brassMat, 0, 0.45, -22.8);
  const curtainMat = new THREE.MeshStandardMaterial({ map: textures.curtainTex, roughness: 0.9 });
  mkBox(1.6, 3.0, 0.25, curtainMat, -3.15, 1.7, -21.4);
  mkBox(1.6, 3.0, 0.25, curtainMat, 3.15, 1.7, -21.4);
  mkBox(7.4, 0.68, 0.32, curtainMat, 0, 3.08, -21.4);

  // Vintage Microphone Stand in front of Fredbear on Stage
  const micStand = new THREE.Group();
  micStand.position.set(-0.62, 0.46, -21.85);
  micStand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 12), metalMat));
  const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.38, 8), metalMat);
  micPole.position.y = 0.69;
  micStand.add(micPole);
  const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8f96a3, roughness: 0.25, metalness: 0.9 }));
  micHead.position.set(0, 1.40, 0.03);
  micStand.add(micHead);
  scene.add(freezeStatic(micStand));

  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.80, 0.12),
    new THREE.MeshStandardMaterial({
      map: textures.stageMarqueeTex,
      emissive: 0xd49b2a,
      emissiveMap: textures.stageMarqueeTex,
      emissiveIntensity: 1.05
    })
  );
  marquee.position.set(0, 2.75, -24.3);
  scene.add(freezeStatic(marquee));
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdc7a });
  const bulbGeo = new THREE.SphereGeometry(0.035, 6, 6);
  for (let bx = -2.1; bx <= 2.1; bx += 0.42) {
    const m1 = new THREE.Mesh(bulbGeo, bulbMat); m1.position.set(bx, 3.15, -24.22); scene.add(freezeStatic(m1));
    const m2 = new THREE.Mesh(bulbGeo, bulbMat); m2.position.set(bx, 2.35, -24.22); scene.add(freezeStatic(m2));
  }
  const stageConeL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.35, 3.0, 18, 1, true), createVolumetricConeMat(0xffbe5c, 0.105));
  stageConeL.position.set(-0.9, 1.9, -22.6);
  scene.add(freezeStatic(stageConeL));
  const stageConeR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.35, 3.0, 18, 1, true), createVolumetricConeMat(0xc592ff, 0.095));
  stageConeR.position.set(0.9, 1.9, -22.6);
  scene.add(freezeStatic(stageConeR));

  // Backstage / Parts & Service (CAM 03)
  mkBox(7.0, 3.4, 0.25, wallMat, -12.5, 1.7, -21.0);
  mkBox(7.0, 3.4, 0.25, wallMat, -12.5, 1.7, -14.0);
  mkBox(0.25, 3.4, 7.2, wallMat, -16.0, 1.7, -17.5);
  mkBox(3.8, 0.10, 1.1, metalMat, -13.2, 0.88, -19.8);
  mkBox(0.14, 0.86, 0.9, metalMat, -14.9, 0.43, -19.8);
  mkBox(0.14, 0.86, 0.9, metalMat, -11.5, 0.43, -19.8);

  const spareMaskGroup = new THREE.Group();
  spareMaskGroup.position.set(-13.8, 1.12, -19.7);
  spareMaskGroup.rotation.y = 0.24;
  spareMaskGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), new THREE.MeshStandardMaterial({ map: textures.plushFreddy, normalMap: textures.plushNormal, roughness: 0.9 })));
  const spareSnout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ map: textures.plushFreddy, roughness: 0.9 }));
  spareSnout.position.set(0, -0.05, 0.17);
  spareSnout.scale.set(1.2, 0.65, 0.85);
  spareMaskGroup.add(spareSnout);
  const spareEyeMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const se1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), spareEyeMat); se1.position.set(-0.075, 0.04, 0.18); spareMaskGroup.add(se1);
  const se2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), spareEyeMat); se2.position.set(0.075, 0.04, 0.18); spareMaskGroup.add(se2);
  const sePin1 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), pEyeMat); sePin1.position.set(-0.075, 0.04, 0.215); spareMaskGroup.add(sePin1);
  const sePin2 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), pEyeMat); sePin2.position.set(0.075, 0.04, 0.215); spareMaskGroup.add(sePin2);
  scene.add(freezeStatic(spareMaskGroup));

  const spareEndo = new THREE.Group();
  spareEndo.position.set(-12.3, 1.10, -19.8);
  spareEndo.rotation.y = -0.2;
  spareEndo.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), metalMat));
  const endoJaw = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.08, 0.18), metalMat);
  endoJaw.position.set(0, -0.15, 0.02);
  spareEndo.add(endoJaw);
  const endPin1 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), pEyeMat); endPin1.position.set(-0.06, 0.04, 0.12); spareEndo.add(endPin1);
  const endPin2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), pEyeMat); endPin2.position.set(0.06, 0.04, 0.12); spareEndo.add(endPin2);
  scene.add(freezeStatic(spareEndo));
  addCeilingCable(-14.6, 3.35, -18.5, -13.2, 2.2, -19.5, 0.45);

  // Kitchen & Storage (CAM 04)
  mkBox(7.0, 3.4, 0.25, wallMat, 12.5, 1.7, -21.0);
  mkBox(7.0, 3.4, 0.25, wallMat, 12.5, 1.7, -14.0);
  mkBox(0.25, 3.4, 7.2, wallMat, 16.0, 1.7, -17.5);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x767c85, normalMap: textures.metalNormal, roughness: 0.32, metalness: 0.88 });
  mkBox(4.0, 0.90, 1.1, steelMat, 13.4, 0.45, -19.6);
  mkBox(0.68, 0.12, 0.68, pizzaMat, 12.6, 0.97, -19.6);
  mkBox(0.68, 0.12, 0.68, pizzaMat, 12.65, 1.09, -19.6);
  mkBox(0.68, 0.12, 0.68, pizzaMat, 12.58, 1.21, -19.6);
  mkBox(3.4, 0.05, 0.05, metalMat, 13.4, 2.5, -19.6);
  const potGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.18, 10);
  for (let px = 12.1; px <= 14.5; px += 0.6) {
    const pot = new THREE.Mesh(potGeo, steelMat);
    pot.position.set(px, 2.22, -19.6);
    scene.add(freezeStatic(pot));
  }

  // Secondary Vent Shaft (CAM 07)
  mkBox(1.8, 0.12, 9.0, ductWallMat, 11.0, 4.4, -7.0);
  mkBox(1.8, 0.12, 9.0, ductWallMat, 11.0, 5.75, -7.0);
  mkBox(0.12, 1.45, 9.0, ductWallMat, 10.1, 5.08, -7.0);
  mkBox(0.12, 1.45, 9.0, ductWallMat, 11.9, 5.08, -7.0);
  mkBox(1.8, 1.45, 0.12, ductWallMat, 11.0, 5.08, -11.4);
  for (let dz = -4.5; dz >= -10.5; dz -= 2.0) {
    mkBox(1.84, 0.08, 0.08, metalMat, 11.0, 4.46, dz);
    mkBox(1.84, 0.08, 0.08, metalMat, 11.0, 5.68, dz);
  }
  const ductFan = new THREE.Group();
  ductFan.position.set(11.0, 5.08, -11.1);
  scene.add(ductFan);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.03), metalMat);
    blade.position.y = 0.25;
    const p = new THREE.Group();
    p.rotation.z = (i * Math.PI) / 2;
    p.add(blade);
    ductFan.add(p);
  }

  // =========================================================================
  // C. FLOATING DUST MOTES IN 3D SPACE
  // =========================================================================
  const dustCount = 220;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 10.5;
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 2.8;
    dustPos[i * 3 + 2] = -24 + Math.random() * 26.2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: textures.dustSpriteTex,
    color: 0xffdfab,
    size: 0.055,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(dustParticles);

  // =========================================================================
  // D. SHARED CCTV LIGHT + ANIMATRONIC RIGS
  // =========================================================================
  const cctvRoomLight = new THREE.PointLight(0xffc472, 5.5, 17, 1.3);
  scene.add(cctvRoomLight);

  const freddyRig = buildAnimatronic('freddy', textures);
  const bonnieRig = buildAnimatronic('bonnie', textures);
  scene.add(freddyRig.root);
  scene.add(bonnieRig.root);

  function setQualityShadows(high) {
    officeLamp.castShadow = high;
    if (!high) {
      flashlight.castShadow = false;
      hallLightL.castShadow = false;
      hallLightR.castShadow = false;
    }
  }

  return {
    interactables,
    doorMeshL,
    doorMeshR,
    ventShutter,
    ventBtnMat,
    panelL,
    panelR,
    officeLamp,
    bulbMesh,
    officeVolCone,
    lampPivot,
    crtScreenMat,
    crtDeskGlow,
    hallLightL,
    hallLightR,
    flashlight,
    flashVolCone,
    jumpscareLight,
    cctvRoomLight,
    fanBlades,
    ductFan,
    officeVentFan,
    plushGroup,
    plushHead,
    plushPupilL,
    plushPupilR,
    tapeReelL,
    tapeReelR,
    tapeLedMat,
    dustParticles,
    freddyRig,
    bonnieRig,
    setQualityShadows
  };
}
