import * as THREE from 'three';

function createBeveledShellGeo(rMax, height, radSegs = 18, bulge = 0.04, topScale = 0.94, botScale = 0.94, dentFn = null) {
  const h2 = height * 0.5;
  const pts = [
    new THREE.Vector2(0.001, -h2),
    new THREE.Vector2(rMax * botScale * 0.70, -h2),
    new THREE.Vector2(rMax * botScale * 0.96, -h2 * 0.85),
    new THREE.Vector2(rMax * (1.0 + bulge), 0),
    new THREE.Vector2(rMax * topScale * 0.96, h2 * 0.85),
    new THREE.Vector2(rMax * topScale * 0.70, h2),
    new THREE.Vector2(0.001, h2)
  ];
  const geo = new THREE.LatheGeometry(pts, radSegs);
  if (dentFn) {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      dentFn(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
  }
  return geo;
}

function createSculptedSphere(radius, wSeg, hSeg, deformFn) {
  const geo = new THREE.SphereGeometry(radius, wSeg, hSeg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deformFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createHelicalSpringGeo(radius, tubeRadius, turns, height, tubularSegs = 44, radialSegs = 6) {
  const pts = [];
  const totalPts = Math.max(24, turns * 10);
  for (let i = 0; i <= totalPts; i++) {
    const u = i / totalPts;
    const ang = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(
      Math.cos(ang) * radius,
      (u - 0.5) * height,
      Math.sin(ang) * radius
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, tubularSegs, tubeRadius, radialSegs, false);
}

function createChiselToothGeo(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 3, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = v.y / (h * 0.5);
    // Slightly taper toward the chewing edge and round outer corners
    if (yn < 0) v.z *= 0.65;
    if (Math.abs(v.x) > w * 0.35 && Math.abs(v.z) > d * 0.35) {
      v.x *= 0.86;
      v.z *= 0.86;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createWireLoopGeo(x0, y0, z0, x1, y1, z1, sagX, sagY, sagZ, radius = 0.0065) {
  const mid = new THREE.Vector3((x0 + x1) * 0.5 + sagX, (y0 + y1) * 0.5 + sagY, (z0 + z1) * 0.5 + sagZ);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x0, y0, z0),
    mid,
    new THREE.Vector3(x1, y1, z1)
  ]);
  return new THREE.TubeGeometry(curve, 10, radius, 5, false);
}

const SHARED_ANIM_GEO = {
  phalanx1: createBeveledShellGeo(0.017, 0.044, 10, 0.08),
  phalanx2: createBeveledShellGeo(0.015, 0.040, 10, 0.08),
  phalanx3: createBeveledShellGeo(0.013, 0.032, 10, 0.05, 0.72, 0.92),
  endoPhalanx: new THREE.CylinderGeometry(0.0085, 0.0095, 0.040, 6),
  endoClawTip: new THREE.ConeGeometry(0.0085, 0.026, 6),
  jointBall: new THREE.SphereGeometry(0.012, 8, 8),
  dorsalTendon: new THREE.CylinderGeometry(0.0045, 0.0045, 0.072, 6),
  toothBlock: createChiselToothGeo(0.031, 0.038, 0.022),
  toothBuck: createChiselToothGeo(0.036, 0.048, 0.024),
  endoFang: new THREE.ConeGeometry(0.0085, 0.038, 6),
  jawSpring: createHelicalSpringGeo(0.015, 0.0038, 5, 0.145, 42, 6),
  chestSpring: createHelicalSpringGeo(0.026, 0.0055, 6, 0.22, 48, 6),
  neckSpring: createHelicalSpringGeo(0.014, 0.0035, 5, 0.13, 38, 5),
  jawStrut: new THREE.CylinderGeometry(0.0075, 0.0075, 0.16, 6),
  waistRod: new THREE.CylinderGeometry(0.015, 0.015, 0.27, 8),
  vertebra: new THREE.CylinderGeometry(0.044, 0.046, 0.045, 10),
  ribArc: new THREE.TorusGeometry(0.145, 0.011, 6, 16, Math.PI * 1.15),
  rivet: new THREE.SphereGeometry(0.009, 6, 6),
  hexNut: new THREE.CylinderGeometry(0.014, 0.014, 0.018, 6),
  whisker: new THREE.CylinderGeometry(0.0022, 0.0012, 0.125, 5),
  tearLip: new THREE.TorusGeometry(0.058, 0.013, 6, 14)
};

export function buildAnimatronic(type, tex) {
  const isFreddy = type === 'freddy';
  const root = new THREE.Group();

  const plushMat = new THREE.MeshPhysicalMaterial({
    map: isFreddy ? tex.plushFreddy : tex.plushBonnie,
    normalMap: tex.plushNormal,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughnessMap: tex.plushRoughness,
    roughness: 0.92,
    metalness: 0.02,
    sheen: 0.65,
    sheenRoughness: 0.86,
    sheenColor: new THREE.Color(isFreddy ? 0xd8be54 : 0xceb84e)
  });

  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0xb59c32 : 0xbda23b,
    normalMap: tex.plushNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: tex.plushRoughness,
    roughness: 0.93,
    metalness: 0.02,
    sheen: 0.55,
    sheenRoughness: 0.88,
    sheenColor: new THREE.Color(0xe6cf75)
  });

  const velvetMat = new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0x43175c : 0x4f133b,
    normalMap: tex.plushNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.74,
    metalness: 0.08,
    sheen: 0.85,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(isFreddy ? 0x9040bd : 0x9e3276)
  });

  const endoMat = new THREE.MeshStandardMaterial({
    map: tex.rustMetal,
    normalMap: tex.metalNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0x3b3f47,
    roughness: 0.36,
    metalness: 0.90
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x8f96a3,
    normalMap: tex.metalNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.23,
    metalness: 0.94
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0x997028,
    normalMap: tex.metalNormal,
    roughness: 0.34,
    metalness: 0.88
  });

  const buttonMat = new THREE.MeshStandardMaterial({
    color: isFreddy ? 0x121215 : 0x7b808c,
    roughness: 0.25,
    metalness: isFreddy ? 0.25 : 0.82
  });

  const teethMat = new THREE.MeshStandardMaterial({
    map: tex.teethTex,
    roughness: 0.38,
    metalness: 0.08
  });

  const darkVoidMat = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.99 });
  const throatMat = new THREE.MeshStandardMaterial({ color: 0x260506, roughness: 0.54, metalness: 0.16 });
  const noseMat = new THREE.MeshStandardMaterial({
    color: isFreddy ? 0x101013 : 0x23170e,
    normalMap: tex.plushNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: isFreddy ? 0.28 : 0.72,
    metalness: isFreddy ? 0.14 : 0.04
  });

  const wirePurpMat = new THREE.MeshStandardMaterial({ color: 0x3f1e59, roughness: 0.58 });
  const wireRedMat = new THREE.MeshStandardMaterial({ color: 0x6b1414, roughness: 0.56 });
  const wireDarkMat = new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.68 });

  const eyeballMat = new THREE.MeshStandardMaterial({
    map: isFreddy ? tex.eyeFreddyTex : tex.eyeBonnieTex,
    roughness: 0.14,
    metalness: 0.08
  });

  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const eyeVoidMat = new THREE.MeshStandardMaterial({
    color: 0x020203,
    roughness: 0.95
  });

  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: isFreddy ? 0xffe2a4 : 0xfff0cc,
    emissiveIntensity: 0.0,
    roughness: 0.1
  });

  const addMesh = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, castShadow = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // =========================================================================
  // PELVIS & SPINAL ACTUATORS
  // =========================================================================
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 1.07, 0);
  root.add(pelvis);

  const pelvisGeo = createSculptedSphere(0.248, 20, 14, v => {
    v.x *= isFreddy ? 1.16 : 1.05;
    v.y *= 0.62;
    v.z *= 0.86;
    if (v.y > 0.06) v.y = 0.06 + (v.y - 0.06) * 0.4;
    if (v.y < -0.04) v.x *= 0.74;
    // Slight mechanical panel crease
    if (Math.abs(v.x) > 0.18 && v.y > -0.02) v.x *= 0.96;
  });
  addMesh(pelvis, pelvisGeo, plushMat, 0, 0, 0, 0, 0, 0, true);

  // Exposed mechanical spine & waist hydraulic rods
  addMesh(pelvis, new THREE.CylinderGeometry(0.068, 0.068, 0.30, 10), endoMat, 0, 0.14, 0);
  for (let vIdx = 0; vIdx < 4; vIdx++) {
    addMesh(pelvis, SHARED_ANIM_GEO.vertebra, chromeMat, 0, 0.05 + vIdx * 0.055, -0.02);
  }
  [-0.145, -0.075, 0.075, 0.145].forEach((rx, idx) => {
    addMesh(pelvis, SHARED_ANIM_GEO.waistRod, chromeMat, rx, 0.14, 0.045);
    addMesh(pelvis, SHARED_ANIM_GEO.hexNut, brassMat, rx, 0.05 + (idx % 2) * 0.08, 0.045);
  });
  // Hip axle rod
  addMesh(pelvis, new THREE.CylinderGeometry(0.024, 0.024, 0.38, 8), endoMat, 0, -0.07, 0, 0, 0, Math.PI / 2);
  // Hanging waist wire loops
  addMesh(pelvis, createWireLoopGeo(-0.12, 0.04, 0.09, -0.08, 0.24, 0.05, -0.06, -0.04, 0.05), wireRedMat);
  addMesh(pelvis, createWireLoopGeo(0.11, 0.03, 0.08, 0.09, 0.25, 0.03, 0.05, -0.05, 0.05), wirePurpMat);

  // =========================================================================
  // LEGS (WITH EXPOSED MECHANICAL JOINTS & ASYMMETRIC SUIT DAMAGE)
  // =========================================================================
  const buildLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.168, -0.08, 0);
    pelvis.add(hip);
    addMesh(hip, new THREE.CylinderGeometry(0.044, 0.044, 0.26, 8), endoMat, 0, -0.06, 0);
    addMesh(hip, new THREE.SphereGeometry(0.052, 8, 8), chromeMat, 0, 0, 0);

    const thighGeo = createBeveledShellGeo(0.144, 0.37, 18, 0.06, 0.92, 0.96, v => {
      // Torn thigh cutout on Bonnie's right leg & Freddy's left outer thigh
      if ((isFreddy && side < 0 && v.x < -0.08 && Math.abs(v.y) < 0.09) ||
          (!isFreddy && side > 0 && v.x > 0.07 && v.z > 0.02 && Math.abs(v.y) < 0.10)) {
        v.x *= 0.72;
        v.z *= 0.78;
      }
    });
    addMesh(hip, thighGeo, plushMat, 0, -0.25, 0, 0, 0, 0, true);

    // Inner thigh endo core + springlock collar peeking through tears
    addMesh(hip, new THREE.CylinderGeometry(0.038, 0.036, 0.44, 8), endoMat, 0, -0.25, 0);
    addMesh(hip, SHARED_ANIM_GEO.hexNut, brassMat, side * 0.038, -0.24, 0.02);
    if ((isFreddy && side < 0) || (!isFreddy && side > 0)) {
      addMesh(hip, SHARED_ANIM_GEO.chestSpring, chromeMat, side * 0.065, -0.25, 0.03, 0, 0, 0.08);
      addMesh(hip, createWireLoopGeo(side * 0.05, -0.15, 0.06, side * 0.08, -0.34, 0.05, side * 0.05, 0, 0.04), wireRedMat);
    }

    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2;
      addMesh(hip, SHARED_ANIM_GEO.rivet, endoMat, Math.cos(ang) * 0.132, -0.41, Math.sin(ang) * 0.132);
    }

    const knee = new THREE.Group();
    knee.position.set(0, -0.50, 0);
    hip.add(knee);
    // Twin mechanical fork plates + cross axle + damper piston
    addMesh(knee, new THREE.CylinderGeometry(0.038, 0.038, 0.22, 10), endoMat, 0, 0, 0);
    addMesh(knee, new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), chromeMat, 0, 0, 0, 0, 0, Math.PI / 2);
    addMesh(knee, new THREE.BoxGeometry(0.018, 0.13, 0.075), endoMat, -0.055, 0, 0);
    addMesh(knee, new THREE.BoxGeometry(0.018, 0.13, 0.075), endoMat,  0.055, 0, 0);
    addMesh(knee, new THREE.CylinderGeometry(0.016, 0.016, 0.19, 6), chromeMat, side * 0.048, 0, -0.035);
    addMesh(knee, createWireLoopGeo(-side * 0.04, 0.07, 0.02, -side * 0.04, -0.09, 0.03, -side * 0.03, 0, 0.04), wirePurpMat);

    const kneeCapGeo = createBeveledShellGeo(0.110, 0.11, 14, 0.14, 0.85, 0.85);
    addMesh(knee, kneeCapGeo, plushMat, 0, 0, 0.015, 0, 0, 0, true);

    // SpringBonnie's right shin is stripped to bare endo!
    const bareShin = !isFreddy && side > 0;
    if (bareShin) {
      addMesh(knee, new THREE.CylinderGeometry(0.038, 0.034, 0.44, 10), endoMat, 0, -0.25, 0, 0, 0, 0, true);
      addMesh(knee, new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), chromeMat, 0.046, -0.25, 0.02);
      addMesh(knee, new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), brassMat, -0.044, -0.25, -0.01);
      addMesh(knee, createWireLoopGeo(0.03, -0.10, 0.03, -0.03, -0.38, 0.04, 0.05, 0, 0.04), wireRedMat);
    } else {
      const shinGeo = createBeveledShellGeo(0.126, 0.36, 18, 0.05, 0.96, 0.88);
      addMesh(knee, shinGeo, plushMat, 0, -0.26, 0, 0, 0, 0, true);
      addMesh(knee, new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), endoMat, 0, -0.44, 0);
    }

    const foot = new THREE.Group();
    foot.position.set(0, -0.51, 0.02);
    knee.add(foot);
    addMesh(foot, createBeveledShellGeo(0.116, 0.14, 14, 0.04, 0.95, 1.05), plushMat, 0, 0.02, -0.02);
    addMesh(foot, new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6), chromeMat, side * 0.055, 0.05, -0.04, 0.25, 0, 0);

    const archGeo = createSculptedSphere(0.132, 16, 12, v => {
      v.x *= 1.06; v.y *= 0.65; v.z *= 1.18;
    });
    addMesh(foot, archGeo, plushMat, 0, -0.03, 0.05);
    // Cracked rubber sole base
    addMesh(foot, new THREE.BoxGeometry(0.24, 0.022, 0.33), wireDarkMat, 0, -0.088, 0.08);

    [-0.090, 0, 0.090].forEach((tx, idx) => {
      const exposedToe = !isFreddy && side > 0 && idx === 2;
      if (exposedToe) {
        addMesh(foot, new THREE.BoxGeometry(0.058, 0.046, 0.125), endoMat, tx, -0.042, 0.16, 0, tx * 1.4, 0);
        addMesh(foot, new THREE.CylinderGeometry(0.016, 0.016, 0.06, 8), chromeMat, tx, -0.042, 0.14, 0, 0, Math.PI / 2);
      } else {
        const toeGeo = createSculptedSphere(0.064, 12, 10, v => {
          v.x *= 0.92; v.y *= 0.68; v.z *= 1.50;
          if (v.y < -0.025) v.y = -0.025;
        });
        addMesh(foot, toeGeo, plushMat, tx, -0.035, idx === 1 ? 0.175 : 0.16, 0, tx * 1.4, 0);
      }
    });

    return { hip, knee, foot };
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // =========================================================================
  // TORSO, RIBCAGE & SPRINGLOCK CHEST CAVITIES
  // =========================================================================
  const torso = new THREE.Group();
  torso.position.set(0, 0.22, 0);
  pelvis.add(torso);

  const torsoGeo = createSculptedSphere(isFreddy ? 0.32 : 0.288, 24, 20, v => {
    v.x *= isFreddy ? 1.06 : 0.96;
    v.y *= isFreddy ? 1.15 : 1.22;
    v.z *= 0.78;
    if (Math.abs(v.z) > 0.16) v.z = Math.sign(v.z) * (0.16 + (Math.abs(v.z) - 0.16) * 0.44);
    if (v.y < -0.22) v.y = -0.22 + (v.y + 0.22) * 0.45;
    // Hunched shoulders
    if (v.y > 0.14 && v.z < 0) v.z -= 0.035;
    // Dent chest tears inward to reveal interior endo ribcage!
    if (isFreddy) {
      if (v.x < -0.10 && v.y > 0.05 && v.y < 0.24 && v.z > 0.06) v.z -= 0.08;
    } else {
      if ((v.x > 0.06 && v.y > 0.02 && v.y < 0.25 && v.z > 0.04) ||
          (v.x < -0.08 && v.y < 0.02 && v.y > -0.18 && v.z > 0.04)) {
        v.z -= 0.09;
      }
    }
  });
  addMesh(torso, torsoGeo, plushMat, 0, 0.30, 0, 0, 0, 0, true);

  // Belly plate
  const bellyGeo = createSculptedSphere(isFreddy ? 0.215 : 0.192, 20, 14, v => {
    v.x *= 0.95; v.y *= 1.18; v.z *= 0.32;
    if (Math.abs(v.x) > 0.14) v.x = Math.sign(v.x) * (0.14 + (Math.abs(v.x) - 0.14) * 0.35);
  });
  addMesh(torso, bellyGeo, bellyMat, 0, 0.27, isFreddy ? 0.168 : 0.156);

  // Internal Endo Ribcage, Coiled Springlocks & Exposed Chest Tears!
  addMesh(torso, new THREE.CylinderGeometry(0.046, 0.052, 0.48, 8), endoMat, 0, 0.31, 0.02);
  [0.20, 0.30, 0.40].forEach(ry => {
    addMesh(torso, SHARED_ANIM_GEO.ribArc, chromeMat, 0, ry, 0.04, Math.PI / 2, 0, -Math.PI * 0.075);
  });
  addMesh(torso, SHARED_ANIM_GEO.chestSpring, brassMat, -0.12, 0.36, 0.14);
  addMesh(torso, SHARED_ANIM_GEO.chestSpring, brassMat,  0.12, 0.34, 0.13);

  if (isFreddy) {
    // Torn left chest gash exposing dark cavity, rib & dangling wires
    addMesh(torso, new THREE.SphereGeometry(0.088, 10, 8), darkVoidMat, -0.17, 0.42, 0.16);
    addMesh(torso, SHARED_ANIM_GEO.tearLip, plushMat, -0.17, 0.42, 0.185, 0.2, -0.35, 0.4);
    addMesh(torso, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), chromeMat, -0.16, 0.42, 0.18, 0, 0, 1.3);
    addMesh(torso, createWireLoopGeo(-0.15, 0.46, 0.18, -0.19, 0.36, 0.20, -0.05, -0.02, 0.04), wireRedMat);
    addMesh(torso, createWireLoopGeo(-0.18, 0.45, 0.17, -0.14, 0.34, 0.19, 0.02, -0.04, 0.05), wirePurpMat);
  } else {
    // SpringBonnie heavy torso decay (2 large open cavities + exposed brass crank port)
    addMesh(torso, new THREE.SphereGeometry(0.105, 10, 8), darkVoidMat, 0.14, 0.40, 0.14);
    addMesh(torso, SHARED_ANIM_GEO.tearLip, plushMat, 0.14, 0.40, 0.168, 0.15, 0.3, -0.2);
    addMesh(torso, new THREE.SphereGeometry(0.082, 10, 8), darkVoidMat, -0.15, 0.19, 0.14);
    addMesh(torso, new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8), brassMat, 0.14, 0.40, 0.15, Math.PI / 2);
    addMesh(torso, createWireLoopGeo(0.12, 0.44, 0.16, 0.17, 0.31, 0.19, 0.04, -0.04, 0.05), wireRedMat);
    addMesh(torso, createWireLoopGeo(-0.14, 0.22, 0.16, -0.12, 0.12, 0.18, -0.04, -0.02, 0.05), wirePurpMat);
  }

  // Buttons & Purple Velvet Bowtie
  addMesh(torso, new THREE.SphereGeometry(0.023, 10, 8), buttonMat, 0, 0.43, isFreddy ? 0.238 : 0.222);
  addMesh(torso, new THREE.SphereGeometry(0.023, 10, 8), buttonMat, 0, 0.365, isFreddy ? 0.240 : 0.225);

  const bowtie = new THREE.Group();
  bowtie.position.set(0, 0.515, isFreddy ? 0.228 : 0.216);
  bowtie.rotation.z = isFreddy ? -0.06 : 0.09;
  torso.add(bowtie);
  addMesh(bowtie, new THREE.SphereGeometry(0.034, 10, 8), velvetMat);
  addMesh(bowtie, new THREE.SphereGeometry(0.011, 6, 6), brassMat, 0, 0, 0.032);
  [-1, 1].forEach(sx => {
    const wing = createSculptedSphere(0.072, 14, 10, v => {
      v.x *= 1.28; v.y *= 0.88; v.z *= 0.42;
      if (sx * v.x < 0) v.y *= 0.42;
    });
    addMesh(bowtie, wing, velvetMat, sx * 0.078, 0, 0, 0, sx * -0.18, sx * 0.12);
  });

  // =========================================================================
  // ARMS & 3-PHALANX ARTICULATED CLAWED HANDS
  // =========================================================================
  const fingers = [];
  const buildArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (isFreddy ? 0.335 : 0.30), 0.54, 0);
    torso.add(shoulder);

    addMesh(shoulder, new THREE.SphereGeometry(0.058, 10, 8), endoMat);
    addMesh(shoulder, new THREE.CylinderGeometry(0.028, 0.028, 0.20, 8), chromeMat, side * 0.04, -0.06, 0, 0, 0, side * 0.25);
    addMesh(shoulder, createWireLoopGeo(0, 0.03, 0.03, side * 0.06, -0.11, 0.04, side * 0.03, 0, 0.05), wireDarkMat);

    const pauldronGeo = new THREE.SphereGeometry(0.098, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    addMesh(shoulder, pauldronGeo, plushMat, side * 0.015, 0.015, 0, 0, 0, -side * 0.28, true);

    const uArmGeo = createBeveledShellGeo(0.096, 0.28, 16, 0.08, 0.90, 0.90);
    addMesh(shoulder, uArmGeo, plushMat, side * 0.03, -0.22, 0, 0, 0, 0, true);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.03, -0.40, 0);
    shoulder.add(elbow);
    addMesh(elbow, new THREE.SphereGeometry(0.046, 8, 8), endoMat);
    addMesh(elbow, new THREE.CylinderGeometry(0.022, 0.022, 0.15, 8), chromeMat, 0, 0, 0, 0, 0, Math.PI / 2);
    addMesh(elbow, new THREE.BoxGeometry(0.015, 0.11, 0.06), endoMat, -0.04, 0, 0);
    addMesh(elbow, new THREE.BoxGeometry(0.015, 0.11, 0.06), endoMat,  0.04, 0, 0);

    const bareForearm = !isFreddy && side < 0;
    if (bareForearm) {
      addMesh(elbow, new THREE.CylinderGeometry(0.034, 0.030, 0.30, 8), endoMat, 0, -0.18, 0, 0, 0, 0, true);
      addMesh(elbow, new THREE.CylinderGeometry(0.013, 0.013, 0.24, 6), chromeMat, 0.038, -0.18, 0.01);
      addMesh(elbow, SHARED_ANIM_GEO.neckSpring, brassMat, -0.036, -0.18, 0.01);
    } else {
      const fArmGeo = createBeveledShellGeo(0.092, 0.27, 16, 0.08, 0.90, 0.86);
      addMesh(elbow, fArmGeo, plushMat, 0, -0.18, 0, 0, 0, 0, true);
    }

    const hand = new THREE.Group();
    hand.position.set(0, -0.37, 0);
    elbow.add(hand);
    addMesh(hand, new THREE.CylinderGeometry(0.024, 0.024, 0.085, 8), endoMat, 0, 0.02, 0);
    addMesh(hand, new THREE.CylinderGeometry(0.042, 0.042, 0.024, 10), chromeMat, 0, -0.005, 0);

    const palmGeo = createSculptedSphere(0.074, 14, 10, v => {
      v.x *= 1.14; v.y *= 1.06; v.z *= 0.52;
    });
    addMesh(hand, palmGeo, plushMat, 0, -0.056, 0);

    // Dorsal steel tendon rods across the back of the hand
    [-0.036, -0.012, 0.012, 0.036].forEach(tx => {
      addMesh(hand, SHARED_ANIM_GEO.dorsalTendon, chromeMat, tx, -0.058, -0.036);
    });

    [-1.5, -0.5, 0.5, 1.5].forEach((fIdx, arrI) => {
      const finger = new THREE.Group();
      finger.position.set(fIdx * 0.033, -0.115 - (1.5 - Math.abs(fIdx)) * 0.008, 0.004);
      finger.rotation.z = -fIdx * 0.11;
      finger.rotation.x = 0.22;
      hand.add(finger);

      const bareMid = (!isFreddy && ((side < 0 && arrI === 1) || (side > 0 && arrI === 2))) || (isFreddy && side > 0 && arrI === 3);
      const bareTip = bareMid || (!isFreddy && arrI === 0) || (isFreddy && side < 0 && arrI === 1);

      addMesh(finger, SHARED_ANIM_GEO.phalanx1, plushMat, 0, -0.024, 0);
      addMesh(finger, SHARED_ANIM_GEO.jointBall, endoMat, 0, -0.050, 0);

      const seg2 = new THREE.Group();
      seg2.position.set(0, -0.052, 0);
      seg2.rotation.x = 0.34;
      finger.add(seg2);
      addMesh(seg2, bareMid ? SHARED_ANIM_GEO.endoPhalanx : SHARED_ANIM_GEO.phalanx2, bareMid ? chromeMat : plushMat, 0, -0.022, 0);
      addMesh(seg2, SHARED_ANIM_GEO.jointBall, endoMat, 0, -0.044, 0);

      const seg3 = new THREE.Group();
      seg3.position.set(0, -0.046, 0);
      seg3.rotation.x = 0.28;
      seg2.add(seg3);
      if (bareTip) {
        addMesh(seg3, SHARED_ANIM_GEO.endoPhalanx, endoMat, 0, -0.016, 0);
        addMesh(seg3, SHARED_ANIM_GEO.endoClawTip, chromeMat, 0, -0.042, 0, Math.PI, 0, 0);
      } else {
        addMesh(seg3, SHARED_ANIM_GEO.phalanx3, plushMat, 0, -0.018, 0);
        addMesh(seg3, SHARED_ANIM_GEO.endoClawTip, endoMat, 0, -0.038, 0, Math.PI, 0, 0);
      }

      fingers.push({ finger, seg2, seg3, baseX: 0.22, idx: arrI });
    });

    const thumb = new THREE.Group();
    thumb.position.set(-side * 0.072, -0.045, 0.025);
    thumb.rotation.set(0.35, side * 0.4, side * 0.72);
    hand.add(thumb);
    addMesh(thumb, SHARED_ANIM_GEO.phalanx1, plushMat, 0, -0.022, 0);
    addMesh(thumb, SHARED_ANIM_GEO.jointBall, endoMat, 0, -0.044, 0);
    addMesh(thumb, SHARED_ANIM_GEO.phalanx2, plushMat, 0, -0.068, 0.01, 0.35, 0, 0);
    addMesh(thumb, SHARED_ANIM_GEO.endoClawTip, chromeMat, 0, -0.095, 0.02, Math.PI + 0.35, 0, 0);

    return { shoulder, elbow, hand };
  };
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // =========================================================================
  // NECK, SPRINGLOCK SKULL & UNCANNY FACE
  // =========================================================================
  const neck = new THREE.Group();
  neck.position.set(0, 0.62, 0);
  torso.add(neck);
  addMesh(neck, new THREE.CylinderGeometry(0.054, 0.062, 0.18, 10), endoMat, 0, 0.055, 0);
  addMesh(neck, new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), chromeMat, -0.048, 0.055, 0.032);
  addMesh(neck, new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), chromeMat,  0.048, 0.055, 0.032);
  addMesh(neck, SHARED_ANIM_GEO.neckSpring, brassMat, -0.046, 0.055, -0.025);
  addMesh(neck, SHARED_ANIM_GEO.neckSpring, brassMat,  0.046, 0.055, -0.025);
  addMesh(neck, createWireLoopGeo(-0.04, 0.01, 0.05, 0.05, 0.12, 0.04, -0.05, 0, 0.04), wireRedMat);

  const head = new THREE.Group();
  head.position.set(0, 0.22, 0.02);
  neck.add(head);

  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, -0.022, 0.175);
  head.add(mouthAnchor);

  // Sculpted Mascot Cranium (distinct Bear vs gaunt Rabbit skull!)
  const craniumGeo = createSculptedSphere(0.232, 32, 24, v => {
    if (isFreddy) {
      v.x *= 1.18;
      v.y *= 0.96;
      v.z *= 0.95;
      // Heavy protruding lower bear cheeks / jowls
      if (v.y < 0.02 && v.y > -0.15 && Math.abs(v.x) > 0.085 && v.z > -0.05) {
        v.x *= 1.24;
        v.z += 0.040;
      }
      // Flattened bottom cut for wide jaw gap
      if (v.y < -0.10) v.y *= 0.56;
    } else {
      // Gaunt taller SpringBonnie skull with angular cheek flares & pinched temples
      v.x *= 0.96;
      v.y *= 1.08;
      v.z *= 0.96;
      if (v.y > 0.02 && v.y < 0.14 && Math.abs(v.x) > 0.13) v.x *= 0.90;
      if (v.y < 0.0 && v.y > -0.16 && Math.abs(v.x) > 0.065 && v.z > -0.02) {
        v.x *= 1.28;
        v.z += 0.046;
      }
      if (v.y < -0.11) v.y *= 0.58;
    }
    // Deep sunken eye socket cavities
    const leftEyeD = Math.hypot(v.x + 0.082, v.y - 0.036);
    const rightEyeD = Math.hypot(v.x - 0.082, v.y - 0.036);
    if (v.z > 0.05 && (leftEyeD < 0.072 || rightEyeD < 0.072)) {
      v.z -= 0.108;
    }
    // Heavy menacing brow ridge overhang + frown furrow
    if (v.z > 0.10 && v.y > 0.075 && v.y < 0.145 && Math.abs(v.x) < 0.165) {
      v.z += 0.038;
      if (Math.abs(v.x) < 0.026) v.y -= 0.014;
    }
  });
  addMesh(head, craniumGeo, plushMat, 0, 0.04, 0, 0, 0, 0, true);

  // Inner Endo Skull, Throat Voicebox & Double Endo-Teeth
  addMesh(head, new THREE.SphereGeometry(0.172, 14, 12), darkVoidMat, 0, -0.025, 0.03);
  addMesh(head, new THREE.CylinderGeometry(0.052, 0.062, 0.16, 10), throatMat, 0, -0.04, 0.05);
  // Circular voicebox speaker inside throat
  addMesh(head, new THREE.CylinderGeometry(0.044, 0.044, 0.03, 12), endoMat, 0, -0.035, 0.095, Math.PI / 2);
  addMesh(head, new THREE.BoxGeometry(0.158, 0.044, 0.15), endoMat, 0, -0.035, 0.115);

  // Upper Inner Endo Teeth ("teeth behind teeth")
  [-0.062, -0.037, -0.012, 0.012, 0.037, 0.062].forEach(fx => {
    addMesh(head, SHARED_ANIM_GEO.endoFang, chromeMat, fx, -0.072, 0.168 - Math.abs(fx) * 0.25, Math.PI, 0, 0);
  });

  // Coiled Springlocks + Jaw Struts flanking inner cheek hinges
  [-0.105, 0.105].forEach(sx => {
    addMesh(head, SHARED_ANIM_GEO.jawSpring, brassMat, sx, -0.078, 0.142, 0.18, 0, 0);
    addMesh(head, SHARED_ANIM_GEO.jawStrut, chromeMat, sx * 0.80, -0.078, 0.162, 0.1, 0, 0);
  });

  // Sculpted Upper Muzzle / Snout + Whiskers + Cracked Leather Nose
  const snoutGeo = createSculptedSphere(isFreddy ? 0.128 : 0.115, 22, 16, v => {
    v.x *= isFreddy ? 1.35 : 1.22;
    v.y *= 0.64;
    v.z *= 0.94;
    // Philtrum split under nose
    if (v.z > 0.06 && Math.abs(v.x) < 0.016 && v.y < 0.025) v.z -= 0.018;
    // Slight jowl droop at muzzle corners
    if (Math.abs(v.x) > 0.09 && v.y < 0) v.y -= 0.010;
  });
  addMesh(head, snoutGeo, isFreddy ? plushMat : bellyMat, 0, -0.015, 0.172, 0, 0, 0, true);

  // Whisker pores (Fredbear) or crooked stiff whiskers (SpringBonnie)
  [-1, 1].forEach(sx => {
    [
      [0.088, -0.006, 0.242, 0.10, -0.35],
      [0.108, -0.022, 0.232, -0.06, -0.48],
      [0.095, -0.034, 0.244, -0.18, -0.30]
    ].forEach(([wx, wy, wz, rz, ry], wIdx) => {
      if (isFreddy) {
        addMesh(head, SHARED_ANIM_GEO.rivet, darkVoidMat, sx * wx, wy, wz + 0.008);
      } else {
        const w = addMesh(
          head,
          SHARED_ANIM_GEO.whisker,
          wireDarkMat,
          sx * (wx + 0.03),
          wy,
          wz,
          0.18 * (wIdx - 1),
          sx * ry,
          sx * (Math.PI / 2 + rz)
        );
        w.scale.y = wIdx === 1 && sx > 0 ? 0.65 : 1.0;
      }
    });
  });

  const noseGeo = createSculptedSphere(0.044, 14, 10, v => {
    v.x *= isFreddy ? 1.38 : 1.15;
    v.y *= 0.72;
    if (!isFreddy && v.y < 0) v.x *= 0.62;
    // Nostril dimples
    if (v.z > 0.015 && v.y < 0 && Math.abs(Math.abs(v.x) - 0.022) < 0.012) v.z -= 0.012;
  });
  addMesh(head, noseGeo, noseMat, 0, 0.032, 0.272);

  // Eyes: Deep Endo Socket Ring + Textured Iris + Clearcoat Cornea + Haunted Void/Pinpoint + Dual Eyelids
  const eyes = [];
  [-0.082, 0.082].forEach((ex, eIdx) => {
    const socket = new THREE.Group();
    socket.position.set(ex, 0.040, 0.145);
    head.add(socket);

    addMesh(socket, new THREE.CylinderGeometry(0.058, 0.058, 0.06, 16), darkVoidMat, 0, 0, -0.012, Math.PI / 2);
    addMesh(socket, new THREE.TorusGeometry(0.052, 0.0065, 8, 18), endoMat, 0, 0, 0.016);

    const eyeball = addMesh(socket, new THREE.SphereGeometry(0.046, 20, 16), eyeballMat, 0, 0, 0.004);
    const eyeVoid = addMesh(socket, new THREE.SphereGeometry(0.045, 16, 12), eyeVoidMat, 0, 0, 0.004);
    eyeVoid.visible = false;

    const cornea = addMesh(socket, new THREE.SphereGeometry(0.048, 18, 14), corneaMat, 0, 0, 0.004);
    const pupil = addMesh(socket, new THREE.SphereGeometry(0.0068, 8, 8), pupilMat, 0, 0, 0.047);
    pupil.visible = false;

    // Upper heavy eyelid
    const lidPivot = new THREE.Group();
    socket.add(lidPivot);
    const lidGeo = new THREE.SphereGeometry(0.051, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    addMesh(lidPivot, lidGeo, plushMat, 0, 0, 0.004, -0.22, 0, 0);
    addMesh(lidPivot, new THREE.TorusGeometry(0.049, 0.004, 6, 14, Math.PI), darkVoidMat, 0, -0.004, 0.006, 0.2, 0, Math.PI);

    // Lower heavy eyelid
    const lowerLidPivot = new THREE.Group();
    socket.add(lowerLidPivot);
    const lowerLidGeo = new THREE.SphereGeometry(0.050, 14, 8, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44);
    addMesh(lowerLidPivot, lowerLidGeo, plushMat, 0, 0, 0.004, 0.16, 0, 0);

    eyes.push({ socket, eyeball, eyeVoid, cornea, pupil, lidPivot, lowerLidPivot, idx: eIdx });
  });

  // Upper Sculpted Teeth (irregular slightly crooked aged teeth)
  const upperTeethX = isFreddy
    ? [-0.105, -0.075, -0.045, -0.015, 0.015, 0.045, 0.075, 0.105]
    : [-0.102, -0.072, -0.044, -0.017, 0.017, 0.044, 0.072, 0.102];
  upperTeethX.forEach((tx, idx) => {
    const isBuck = !isFreddy && (idx === 3 || idx === 4);
    const tz = 0.235 - Math.abs(tx) * 0.36;
    const tMesh = addMesh(
      head,
      isBuck ? SHARED_ANIM_GEO.toothBuck : SHARED_ANIM_GEO.toothBlock,
      teethMat,
      tx,
      isBuck ? -0.080 : -0.072,
      tz,
      0.04,
      -tx * 2.2,
      (idx % 2 === 0 ? 1 : -1) * 0.03
    );
    tMesh.scale.y = isBuck ? 1.0 : 0.92 + ((idx * 17) % 5) * 0.03;
  });

  // Massive Articulated Lower Jaw + Inner Endo Jaw + Double Teeth
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.068, 0.04);
  head.add(jaw);

  const lJawGeo = createSculptedSphere(isFreddy ? 0.148 : 0.132, 22, 14, v => {
    v.x *= isFreddy ? 1.36 : 1.38;
    v.y *= 0.46;
    v.z *= 1.18;
    // Heavy chin edge
    if (v.z > 0.08 && v.y < 0) v.y -= 0.012;
  });
  addMesh(jaw, lJawGeo, plushMat, 0, -0.056, 0.108, 0, 0, 0, true);
  addMesh(jaw, new THREE.BoxGeometry(0.158, 0.036, 0.17), endoMat, 0, -0.025, 0.082);
  addMesh(jaw, new THREE.CylinderGeometry(0.015, 0.015, 0.17, 8), chromeMat, -0.102, 0.042, 0.04, -0.35, 0, 0);
  addMesh(jaw, new THREE.CylinderGeometry(0.015, 0.015, 0.17, 8), chromeMat,  0.102, 0.042, 0.04, -0.35, 0, 0);
  addMesh(jaw, new THREE.CylinderGeometry(0.022, 0.022, 0.25, 8), endoMat, 0, 0.01, -0.005, 0, 0, Math.PI / 2);

  // Lower Inner Endo Fangs
  [-0.060, -0.036, -0.012, 0.012, 0.036, 0.060].forEach(fx => {
    addMesh(jaw, SHARED_ANIM_GEO.endoFang, chromeMat, fx, 0.008, 0.148 - Math.abs(fx) * 0.22);
  });

  // Lower Outer Mascot Teeth
  const lowerTeethX = isFreddy
    ? [-0.102, -0.072, -0.042, -0.014, 0.014, 0.042, 0.072, 0.102]
    : [-0.114, -0.080, -0.048, -0.016, 0.016, 0.048, 0.080, 0.114];
  lowerTeethX.forEach((tx, idx) => {
    const tz = 0.218 - Math.abs(tx) * 0.36;
    const tMesh = addMesh(
      jaw,
      SHARED_ANIM_GEO.toothBlock,
      teethMat,
      tx,
      -0.014,
      tz,
      -0.04,
      -tx * 2.2,
      (idx % 2 === 0 ? -1 : 1) * 0.035
    );
    tMesh.scale.y = 0.90 + ((idx * 13) % 5) * 0.04;
  });

  // Ears & Iconic Purple Velvet Top Hat (Fredbear) or Broken Paddle Ears (SpringBonnie)
  let earL = null;
  let earR = null;
  let earTipL = null;
  let earTipR = null;

  if (isFreddy) {
    [-1, 1].forEach(sx => {
      const ear = new THREE.Group();
      ear.position.set(sx * 0.218, 0.232, -0.01);
      ear.rotation.z = -sx * 0.38;
      head.add(ear);
      addMesh(ear, new THREE.CylinderGeometry(0.018, 0.018, 0.085, 8), endoMat, 0, -0.04, 0);
      addMesh(ear, createBeveledShellGeo(0.090, 0.044, 16, 0.06), plushMat, 0, 0, 0, Math.PI / 2);
      addMesh(ear, new THREE.CylinderGeometry(0.056, 0.056, 0.026, 14), bellyMat, 0, 0, 0.015, Math.PI / 2);
      if (sx < 0) {
        addMesh(ear, new THREE.SphereGeometry(0.022, 6, 6), darkVoidMat, -0.058, 0.042, 0.005);
        earL = ear;
      } else {
        earR = ear;
      }
    });

    const hat = new THREE.Group();
    hat.position.set(0, 0.252, 0);
    hat.rotation.set(0.04, 0, -0.075);
    head.add(hat);
    addMesh(hat, new THREE.CylinderGeometry(0.132, 0.136, 0.022, 22), velvetMat);
    addMesh(hat, new THREE.CylinderGeometry(0.096, 0.082, 0.162, 22), velvetMat, 0, 0.086, 0);
    addMesh(hat, new THREE.CylinderGeometry(0.086, 0.084, 0.026, 22), noseMat, 0, 0.024, 0);
  } else {
    const makePaddleEar = (sx) => {
      const base = new THREE.Group();
      base.position.set(sx * 0.115, 0.242, -0.01);
      head.add(base);
      addMesh(base, new THREE.CylinderGeometry(0.011, 0.011, 0.075, 6), chromeMat, -0.02, -0.01, 0);
      addMesh(base, new THREE.CylinderGeometry(0.011, 0.011, 0.075, 6), chromeMat,  0.02, -0.01, 0);

      const eBot = createBeveledShellGeo(0.086, 0.22, 16, 0.12, 0.88, 0.82);
      eBot.scale(1.0, 1.0, 0.44);
      addMesh(base, eBot, plushMat, 0, 0.13, 0, 0, 0, 0, true);
      const eInner1 = createBeveledShellGeo(0.052, 0.15, 12, 0.05);
      eInner1.scale(1.0, 1.0, 0.22);
      addMesh(base, eInner1, bellyMat, 0, 0.13, 0.026);

      const tip = new THREE.Group();
      tip.position.set(0, 0.26, 0);
      base.add(tip);
      addMesh(tip, new THREE.CylinderGeometry(0.009, 0.009, 0.065, 6), chromeMat, -0.018, 0, 0);
      addMesh(tip, new THREE.CylinderGeometry(0.009, 0.009, 0.065, 6), chromeMat,  0.018, 0, 0);

      if (sx > 0) {
        // Snapped hinge + dangling wire at the bent right ear!
        addMesh(tip, new THREE.SphereGeometry(0.024, 8, 8), darkVoidMat, 0, 0.01, 0);
        addMesh(tip, createWireLoopGeo(-0.02, -0.02, 0.02, 0.02, 0.05, 0.03, 0.03, 0, 0.04), wireRedMat);
      }

      const eTop = createBeveledShellGeo(0.080, 0.21, 16, 0.10, 0.58, 0.88);
      eTop.scale(1.0, 1.0, 0.42);
      addMesh(tip, eTop, plushMat, 0, 0.12, 0, 0, 0, 0, true);
      const eInner2 = createBeveledShellGeo(0.046, 0.14, 12, 0.05, 0.65, 0.9);
      eInner2.scale(1.0, 1.0, 0.22);
      addMesh(tip, eInner2, bellyMat, 0, 0.12, 0.024);

      return { base, tip };
    };

    const eL = makePaddleEar(-1);
    const eR = makePaddleEar(1);
    earL = eL.base; earTipL = eL.tip;
    earR = eR.base; earTipR = eR.tip;
    earL.rotation.set(0, 0, 0.08);
    earTipL.rotation.set(0.18, 0, 0.16);
    earR.rotation.set(0, 0, -0.34);
    earTipR.rotation.set(0.32, 0, -0.58);
  }

  return {
    type, root, pelvis, torso, neck, head, jaw, mouthAnchor,
    legL, legR, armL, armR, eyes, fingers, pupilMat,
    earL, earR, earTipL, earTipR
  };
}

export function applyAnimatronicPose(rig, pose, t, twitchVal = 0, darkEyes = false, targetLook = null, jumpProgress = 0) {
  const s = Math.sin(t * 2.1);
  const fastTwitch = twitchVal > 0.02 ? (Math.random() - 0.5) * twitchVal : 0;

  if (darkEyes) {
    rig.pupilMat.emissiveIntensity = 6.2;
    rig.eyes.forEach(e => {
      e.pupil.visible = true;
      e.pupil.scale.setScalar(1.05);
      e.eyeball.visible = false;
      e.eyeVoid.visible = true;
    });
  } else {
    rig.pupilMat.emissiveIntensity = 0.0;
    rig.eyes.forEach(e => {
      e.pupil.visible = false;
      e.eyeball.visible = true;
      e.eyeVoid.visible = false;
    });
  }

  rig.pelvis.position.set(0, 1.07, 0);
  rig.pelvis.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.neck.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.jaw.rotation.set(0.18 + Math.abs(s) * 0.08, 0, 0);
  rig.armL.shoulder.rotation.set(0.08, 0, 0.12);
  rig.armL.elbow.rotation.set(-0.32, 0, 0);
  rig.armR.shoulder.rotation.set(0.08, 0, -0.12);
  rig.armR.elbow.rotation.set(-0.32, 0, 0);
  rig.legL.hip.rotation.set(0, 0, 0);
  rig.legL.knee.rotation.set(0, 0, 0);
  rig.legR.hip.rotation.set(0, 0, 0);
  rig.legR.knee.rotation.set(0, 0, 0);

  let lidDroop = 0.28;
  let lowerLidLift = 0.0;
  let fingerCurl = 0.18;

  if (pose === 'STAGE') {
    // Stepped pneumatic animatronic sway
    const mechS = Math.sin(t * 2.1) + Math.sin(t * 6.3) * 0.18;
    rig.torso.rotation.x = 0.045 * mechS;
    rig.head.rotation.set(
      0.045 * Math.sin(t * 1.4),
      0.15 * Math.sin(t * 0.9) + fastTwitch,
      0.09 * Math.cos(t * 0.7)
    );
    rig.jaw.rotation.x = 0.22 + 0.16 * Math.abs(Math.sin(t * 4.5));
    lidDroop = 0.34;
    lowerLidLift = -0.10;
    fingerCurl = 0.22;
    if (rig.type === 'freddy') {
      rig.armR.shoulder.rotation.set(-0.46, 0.15, -0.65);
      rig.armR.elbow.rotation.set(-0.85, 0, -0.2);
      rig.armL.shoulder.rotation.set(-0.22, 0.1, 0.32);
      rig.armL.elbow.rotation.set(-0.62, 0, 0);
    } else {
      rig.armL.shoulder.rotation.set(-0.56, -0.2, 0.85);
      rig.armL.elbow.rotation.set(-0.65, 0, 0.2);
      rig.armR.shoulder.rotation.set(-0.35, 0.1, -0.35);
      rig.armR.elbow.rotation.set(-0.85, 0, 0);
    }
  } else if (pose === 'STALK') {
    rig.torso.rotation.set(0.22, 0.08 * s, 0.06);
    rig.head.rotation.set(-0.08 + fastTwitch, -0.14, 0.40);
    rig.jaw.rotation.x = 0.46 + Math.sin(t * 3.2) * 0.04;
    lidDroop = 0.38;
    lowerLidLift = -0.22;
    fingerCurl = 0.32 + 0.08 * Math.sin(t * 1.9);
    rig.armL.shoulder.rotation.set(-0.84, 0, 0.22);
    rig.armL.elbow.rotation.set(-0.45, 0, 0);
    rig.armR.shoulder.rotation.set(-0.44, 0, -0.2);
  } else if (pose === 'PEEK_CAM') {
    rig.torso.rotation.set(0.20, 0, 0);
    rig.head.rotation.set(-0.34, fastTwitch, -0.46);
    rig.jaw.rotation.x = 0.62;
    lidDroop = -0.20;
    lowerLidLift = 0.05;
    fingerCurl = 0.40;
    rig.armL.shoulder.rotation.set(-1.12, 0.2, 0.25);
  } else if (pose === 'BLINDSPOT') {
    rig.torso.rotation.set(0.18, 0, 0.08);
    rig.head.rotation.set(0.05 + fastTwitch, 0, -0.42);
    rig.jaw.rotation.x = 0.56 + 0.08 * Math.sin(t * 9);
    lidDroop = -0.16;
    lowerLidLift = -0.14;
    fingerCurl = 0.45 + 0.18 * Math.sin(t * 3.4);
    rig.armL.shoulder.rotation.set(-0.98, 0, 0.15);
    rig.armR.shoulder.rotation.set(-0.88, 0, -0.15);
  } else if (pose === 'VENT_CRAWL') {
    rig.pelvis.position.set(0, 0.26, 0);
    rig.pelvis.rotation.set(1.42, 0, 0);
    rig.neck.rotation.set(-1.15, 0, 0);
    rig.head.rotation.set(-0.12 + fastTwitch, 0.08 * Math.sin(t * 4), 0.16);
    rig.jaw.rotation.x = 0.54;
    lidDroop = -0.12;
    fingerCurl = 0.45;
    rig.armL.shoulder.rotation.set(-2.75 + 0.16 * s, 0, 0.18);
    rig.armL.elbow.rotation.set(-0.55, 0, 0);
    rig.armR.shoulder.rotation.set(-2.75 - 0.16 * s, 0, -0.18);
    rig.armR.elbow.rotation.set(-0.55, 0, 0);
    rig.legL.hip.rotation.set(-0.35, 0, 0);
    rig.legL.knee.rotation.set(0.65, 0, 0);
    rig.legR.hip.rotation.set(-0.35, 0, 0);
    rig.legR.knee.rotation.set(0.65, 0, 0);
    if (rig.earTipR) {
      rig.earL.rotation.set(-1.28, 0, 0.14);
      rig.earTipL.rotation.set(-0.22, 0, 0.12);
      rig.earR.rotation.set(-1.22, 0, -0.20);
      rig.earTipR.rotation.set(-0.30, 0, -0.35);
    }
  } else if (pose === 'VENT_PEEK') {
    rig.pelvis.position.set(0, 0.23, 0);
    rig.pelvis.rotation.set(1.42, 0, 0);
    rig.neck.rotation.set(-1.22, 0, 0);
    rig.head.rotation.set(0.14 + fastTwitch, 0.06 * Math.sin(t * 3.5), -0.18);
    rig.jaw.rotation.x = 0.60 + 0.08 * Math.abs(Math.sin(t * 7));
    lidDroop = -0.26;
    lowerLidLift = 0.12;
    fingerCurl = 0.50 + 0.22 * Math.sin(t * 4.5);

    rig.armL.shoulder.rotation.set(-2.78, 0.12, 0.26);
    rig.armL.elbow.rotation.set(-0.48, 0, -0.16);
    rig.armR.shoulder.rotation.set(-2.78, -0.12, -0.26);
    rig.armR.elbow.rotation.set(-0.48, 0, 0.16);

    rig.legL.hip.rotation.set(-0.25, 0, 0);
    rig.legL.knee.rotation.set(0.35, 0, 0);
    rig.legR.hip.rotation.set(-0.25, 0, 0);
    rig.legR.knee.rotation.set(0.35, 0, 0);

    if (rig.earTipR) {
      rig.earL.rotation.set(-1.32, 0, 0.16);
      rig.earTipL.rotation.set(-0.18, 0, 0.14);
      rig.earR.rotation.set(-1.26, 0, -0.22);
      rig.earTipR.rotation.set(-0.25, 0, -0.35);
    }
  } else if (pose === 'JUMPSCARE') {
    const p = jumpProgress;
    const thrashT = t * 48;
    lidDroop = -0.48;
    lowerLidLift = 0.28;
    fingerCurl = 0.55 + 0.35 * Math.sin(thrashT * 0.5);

    const lean = p < 0.36
      ? THREE.MathUtils.lerp(0.12, 0.32, p / 0.36)
      : THREE.MathUtils.lerp(0.32, 0.62, Math.min(1, (p - 0.36) / 0.30));
    rig.torso.rotation.set(lean, Math.sin(thrashT * 0.45) * 0.08, Math.cos(thrashT * 0.4) * 0.06);
    rig.neck.rotation.x = -lean * 0.72;

    let jawAngle = 0.25;
    if (p < 0.10) jawAngle = THREE.MathUtils.lerp(0.25, 0.72, p / 0.10);
    else if (p < 0.36) {
      const u = (p - 0.10) / 0.26;
      jawAngle = THREE.MathUtils.lerp(0.72, 1.38, 1 - Math.pow(1 - u, 2)) + Math.sin(thrashT * 1.4) * 0.05;
    } else if (p < 0.66) jawAngle = 1.38 + Math.sin(thrashT * 1.6) * 0.06;
    else if (p < 0.73) {
      const u = (p - 0.66) / 0.07;
      jawAngle = THREE.MathUtils.lerp(1.38, 0.06, u * u);
    } else if (p < 0.84) {
      const u = (p - 0.73) / 0.11;
      jawAngle = 0.06 + Math.sin(u * Math.PI) * 0.88;
    } else jawAngle = 0.08 + Math.abs(Math.sin(thrashT)) * 0.12;
    rig.jaw.rotation.x = jawAngle;

    const shakeAmt = p < 0.36 ? 0.06 : p < 0.66 ? 0.11 : 0.24;
    if (rig.type === 'freddy') {
      const tiltZ = p < 0.66 ? Math.sin(p * 14) * 0.16 : Math.sin(thrashT) * 0.26;
      rig.head.rotation.set(-0.06 + Math.sin(thrashT * 0.9) * shakeAmt, Math.cos(thrashT * 0.8) * shakeAmt, tiltZ);
      const armReach = THREE.MathUtils.clamp(p / 0.25, 0, 1);
      rig.armL.shoulder.rotation.set(THREE.MathUtils.lerp(-0.4, -1.68, armReach), 0.28, THREE.MathUtils.lerp(0.55, 0.12, armReach));
      rig.armL.elbow.rotation.set(-0.78 + Math.sin(thrashT * 0.6) * 0.12, 0, 0);
      rig.armR.shoulder.rotation.set(THREE.MathUtils.lerp(-0.4, -1.68, armReach), -0.28, THREE.MathUtils.lerp(-0.55, -0.12, armReach));
      rig.armR.elbow.rotation.set(-0.78 - Math.sin(thrashT * 0.6) * 0.12, 0, 0);
    } else {
      rig.head.rotation.set(
        -0.06 + Math.sin(thrashT * 1.15) * shakeAmt * 1.25,
        Math.cos(thrashT * 1.05) * shakeAmt * 1.35,
        (p < 0.66 ? -0.22 : 0) + Math.sin(thrashT * 0.9) * shakeAmt
      );
      const armReach = THREE.MathUtils.clamp(p / 0.20, 0, 1);
      const slash = Math.sin(thrashT * 0.65) * 0.22;
      rig.armL.shoulder.rotation.set(THREE.MathUtils.lerp(-0.3, -1.72, armReach) + slash, 0.32, 0.18);
      rig.armL.elbow.rotation.set(-0.68 + slash * 0.4, 0, 0);
      rig.armR.shoulder.rotation.set(THREE.MathUtils.lerp(-0.3, -1.72, armReach) - slash, -0.32, -0.18);
      rig.armR.elbow.rotation.set(-0.68 - slash * 0.4, 0, 0);
      if (rig.earTipR) {
        rig.earL.rotation.set(Math.sin(thrashT * 0.7) * 0.28, 0, 0.08);
        rig.earR.rotation.set(Math.cos(thrashT * 0.8) * 0.35, 0, -0.34);
        rig.earTipL.rotation.set(0.18, 0, 0.16);
        rig.earTipR.rotation.set(0.32, 0, -0.58);
      }
    }
  }

  rig.eyes.forEach(e => {
    const twitchEye = e.idx === 1 && twitchVal > 0.25 ? Math.sin(t * 36) * 0.18 : 0;
    e.lidPivot.rotation.x = lidDroop + twitchEye;
    e.lowerLidPivot.rotation.x = lowerLidLift;
  });

  rig.fingers.forEach(f => {
    f.finger.rotation.x = f.baseX + fingerCurl * 0.45;
    f.seg2.rotation.x = 0.28 + fingerCurl * 0.55;
    f.seg3.rotation.x = 0.22 + fingerCurl * 0.45;
  });

  if (targetLook && pose !== 'JUMPSCARE' && pose !== 'STAGE' && pose !== 'VENT_PEEK' && pose !== 'VENT_CRAWL') {
    rig.neck.rotation.y = THREE.MathUtils.clamp(targetLook.y * 0.25, -0.45, 0.45);
  } else if (pose !== 'JUMPSCARE') {
    rig.neck.rotation.y = 0;
  }

  if (rig.type === 'bonnie' && rig.earTipR && pose !== 'JUMPSCARE' && pose !== 'VENT_PEEK' && pose !== 'VENT_CRAWL') {
    rig.earL.rotation.set(0, 0, 0.08);
    rig.earR.rotation.set(0, 0, -0.34);
    rig.earTipL.rotation.set(0.18 + 0.05 * s, 0, 0.16);
    rig.earTipR.rotation.set(0.32 + Math.abs(fastTwitch) * 0.5, 0, -0.58);
  }
}
