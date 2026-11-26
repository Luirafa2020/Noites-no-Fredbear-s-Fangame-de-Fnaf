import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batchMeshes, skinRigidParts } from './mesh-batching.js';
import { addFabricFinish } from './fabric-material.js';
import { loftShell, paddedShell } from './suit-geometry.js';

const { smoothstep } = THREE.MathUtils;

function tearRadius(angle, phase) {
  return 1 + 0.13 * Math.sin(angle * 5 + phase) + 0.075 * Math.cos(angle * 9 - phase);
}

function recessFabric(vertex, { x, y, rx, ry, phase, depth }) {
  if (vertex.z <= 0.05) return;
  const dx = (vertex.x - x) / rx;
  const dy = (vertex.y - y) / ry;
  const radius = Math.hypot(dx, dy) / tearRadius(Math.atan2(dy, dx), phase);
  vertex.z -= depth * (1 - smoothstep(radius, 0.60, 1.13));
}

function createEyeGeo(radius) {
  const geometry = new THREE.SphereGeometry(radius, 24, 18);
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, 0.5 + position.getX(i) / (2 * radius), 0.5 + position.getY(i) / (2 * radius));
  }
  return geometry;
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

function createChiselToothGeo(w, h, d, chip = 0) {
  const geo = new RoundedBoxGeometry(w, h, d, 1, 0.0045);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const edge = 1 - smoothstep(v.y, -h * 0.49, h * 0.23);
    v.z *= 1 - edge * 0.24;
    v.x *= 1 - edge * 0.10;
    v.y += chip * edge * smoothstep(v.x, w * 0.05, w * 0.48);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function arcRail(span, y, z, sweep, radius) {
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const x = (i / 5 - 1) * span;
    points.push(new THREE.Vector3(x, y, z - sweep * Math.pow(Math.abs(x / span), 1.7)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, radius, 6);
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
  eye: createEyeGeo(0.0495),
  screw: new THREE.CylinderGeometry(0.009, 0.011, 0.005, 6),
  thread: new THREE.CylinderGeometry(0.0017, 0.0017, 1, 5),
  phalanx: new RoundedBoxGeometry(0.033, 0.046, 0.031, 1, 0.010),
  fingertip: new RoundedBoxGeometry(0.030, 0.036, 0.029, 1, 0.012),
  knuckle: new THREE.CylinderGeometry(0.011, 0.011, 0.026, 10),
  knucklePin: new THREE.CylinderGeometry(0.006, 0.0075, 0.029, 8),
  fingertipPlate: new THREE.SphereGeometry(0.0115, 12, 8),
  toothBlock: createChiselToothGeo(0.031, 0.038, 0.022),
  toothChipped: createChiselToothGeo(0.030, 0.038, 0.024, 0.010),
  toothBuck: createChiselToothGeo(0.036, 0.048, 0.024),
  endoFang: new THREE.ConeGeometry(0.0085, 0.038, 6),
  chestSpring: createHelicalSpringGeo(0.026, 0.0055, 6, 0.22, 48, 6),
  neckSpring: createHelicalSpringGeo(0.014, 0.0035, 5, 0.13, 38, 5),
  waistRod: new THREE.CylinderGeometry(0.015, 0.015, 0.27, 8),
  vertebra: new THREE.CylinderGeometry(0.044, 0.046, 0.045, 10),
  ribArc: new THREE.TorusGeometry(0.145, 0.011, 6, 16, Math.PI * 1.15),
  rivet: new THREE.SphereGeometry(0.009, 6, 6),
  hexNut: new THREE.CylinderGeometry(0.014, 0.014, 0.018, 6),
  whisker: new THREE.CylinderGeometry(0.0022, 0.0012, 0.125, 5)
};

export function buildAnimatronic(type, tex) {
  const isFreddy = type === 'freddy';
  const root = new THREE.Group();
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.78), new THREE.MeshBasicMaterial({
    map: tex.dustSpriteTex, color: 0x000000, opacity: 0.57, transparent: true, depthWrite: false
  }));
  contactShadow.rotation.x = -Math.PI / 2;
  root.add(contactShadow);

  const suitMap = isFreddy ? tex.plushFreddy : tex.plushBonnie;
  const plushMat = addFabricFinish(new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0xb59442 : 0xc7a33e,
    map: suitMap,
    roughness: 0.83,
    sheen: 0.65,
    sheenRoughness: 0.74,
    sheenColor: new THREE.Color(isFreddy ? 0xc5a66a : 0xe0b950)
  }), { pile: 1.12, wear: isFreddy ? 0.78 : 0.59 });

  const bellyMat = addFabricFinish(new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0xd4b451 : 0xe2c066,
    roughness: 0.88,
    sheen: 0.60,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color(0xe2c888)
  }), { pile: 0.95, wear: 0.46 });

  const velvetMat = addFabricFinish(new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0x641f75 : 0x763087,
    roughness: 0.73,
    sheen: 0.93,
    sheenRoughness: 0.54,
    sheenColor: new THREE.Color(isFreddy ? 0x9a58be : 0xc275b2)
  }), { pile: 0.65, wear: 0.46 });

  const handShellMat = addFabricFinish(new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0xa28438 : 0xbca052,
    roughness: 0.49,
    metalness: 0.16,
    clearcoat: 0.20,
    clearcoatRoughness: 0.39
  }), { pile: 0.19, wear: 0.57 });

  const endoMat = new THREE.MeshStandardMaterial({
    map: tex.rustMetal,
    normalMap: tex.metalNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0x8c8b82,
    roughness: 0.53,
    metalness: 0.62
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xb2b6ae,
    normalMap: tex.metalNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.28,
    metalness: 0.76
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0x997028,
    normalMap: tex.metalNormal,
    roughness: 0.34,
    metalness: 0.88
  });

  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: isFreddy ? 0x221a19 : 0x210e24,
    roughness: 0.24,
    clearcoat: 0.61,
    clearcoatRoughness: 0.22
  });

  const teethMat = new THREE.MeshStandardMaterial({
    map: tex.teethTex,
    color: isFreddy ? 0xe9d3a8 : 0xd8cfb7,
    roughness: 0.49,
    metalness: 0.08
  });
  const toothFixingMat = new THREE.MeshStandardMaterial({ color: 0x35211b, roughness: 0.71, metalness: 0.14 });

  const darkVoidMat = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.99 });
  const throatMat = new THREE.MeshStandardMaterial({ color: 0x260506, roughness: 0.54, metalness: 0.16 });
  const noseMat = new THREE.MeshStandardMaterial({
    color: isFreddy ? 0x1e1b17 : 0x251d16,
    normalMap: tex.plushNormal,
    normalScale: new THREE.Vector2(0.1, 0.1),
    roughness: isFreddy ? 0.33 : 0.39,
    metalness: isFreddy ? 0.14 : 0.04
  });

  const wirePurpMat = new THREE.MeshStandardMaterial({ color: 0x3f1e59, roughness: 0.58 });
  const wireRedMat = new THREE.MeshStandardMaterial({ color: 0x6b1414, roughness: 0.56 });
  const wireDarkMat = new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.68 });
  const canvasTrimMat = new THREE.MeshStandardMaterial({
    color: isFreddy ? 0x694322 : 0x555237, normalMap: tex.plushNormal, roughness: 0.94
  });

  const eyeballMat = new THREE.MeshPhysicalMaterial({
    map: isFreddy ? tex.eyeFreddyTex : tex.eyeBonnieTex,
    roughness: 0.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12
  });

  const backingMat = new THREE.MeshStandardMaterial({ color: 0x412f1c, roughness: 0.95 });
  const threadMat = new THREE.MeshStandardMaterial({ color: isFreddy ? 0xb19259 : 0x8e8c58, roughness: 0.9 });

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

  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const front = new THREE.Vector3(0, 0, -1);
  const threadAxis = new THREE.Vector3(0, 1, 0);
  const threadDirection = new THREE.Vector3();

  function fabricPoint(shell, x, y, offset = 0.002) {
    from.set(x, y, 0.7);
    ray.set(from, front);
    const hit = ray.intersectObject(shell, false)[0];
    return hit ? hit.point.addScaledVector(front, -offset) : null;
  }

  function stitch(parent, a, b, material, thickness = 1) {
    if (!a || !b) return;
    const strand = addMesh(parent, SHARED_ANIM_GEO.thread, material);
    threadDirection.subVectors(b, a);
    strand.position.copy(a).lerp(b, 0.5);
    strand.scale.set(thickness, threadDirection.length(), thickness);
    strand.quaternion.setFromUnitVectors(threadAxis, threadDirection.normalize());
  }

  function stitchSeam(parent, shell, point, count) {
    shell.updateMatrixWorld();
    for (let i = 0; i < count; i++) {
      const [x, y] = point((i + 0.5) / count);
      stitch(parent, fabricPoint(shell, x - 0.006, y - 0.004),
        fabricPoint(shell, x + 0.006, y + 0.0045), threadMat);
    }
  }

  function dressTear(parent, shell, tear, centerY) {
    shell.updateMatrixWorld();
    const { x, y, rx, ry, phase, hardwareZ } = tear;
    const edgeY = y + centerY;
    const points = [];
    for (let i = 0; i < 28; i++) {
      const angle = i / 28 * Math.PI * 2;
      const radius = tearRadius(angle, phase);
      const dx = rx * Math.cos(angle) * radius;
      const dy = ry * Math.sin(angle) * radius;
      const edge = fabricPoint(shell, x + dx * 0.98, edgeY + dy * 0.98, 0.003);
      if (!edge) continue;
      points.push(edge);
      if (i % 3 !== 1) {
        stitch(parent, edge, fabricPoint(shell, x + dx * 1.13, edgeY + dy * 1.10, 0.004), threadMat, 1.15);
      }
    }
    if (points.length > 3) {
      addMesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 36, 0.0045, 5, true), backingMat);
    }
    const inset = addMesh(parent, new THREE.SphereGeometry(1, 14, 10), darkVoidMat, x, edgeY, hardwareZ - 0.014);
    inset.scale.set(rx * 0.78, ry * 0.77, 0.019);
    const spring = addMesh(parent, SHARED_ANIM_GEO.chestSpring, brassMat, x - 0.012, edgeY, hardwareZ, 0, 0, -0.32);
    spring.scale.set(0.73, ry * 7.7, 0.72);
    addMesh(parent, createWireLoopGeo(x + rx * 0.36, edgeY + ry * 0.55, hardwareZ,
      x - rx * 0.46, edgeY - ry * 0.58, hardwareZ + 0.013, rx * 0.28, -0.018, 0.04, 0.0047), wireRedMat);
    addMesh(parent, createWireLoopGeo(x - rx * 0.50, edgeY + ry * 0.42, hardwareZ,
      x + rx * 0.13, edgeY - ry * 0.53, hardwareZ + 0.016, -rx * 0.14, -0.013, 0.028, 0.004), wirePurpMat);
  }

  // =========================================================================
  // PELVIS & SPINAL ACTUATORS
  // =========================================================================
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 1.135, 0);
  root.add(pelvis);

  const waistWidth = isFreddy ? 0.293 : 0.267;
  const pelvisGeo = loftShell([
    [-0.151, 0, 0, 0.013],
    [-0.133, waistWidth * 0.48, 0.104, 0.012],
    [-0.083, waistWidth * 0.83, 0.157, 0.014],
    [-0.025, waistWidth, 0.196, 0.015],
    [0.050, waistWidth * 1.02, 0.205, 0.016],
    [0.103, waistWidth * 0.95, 0.187, 0.008],
    [0.123, waistWidth * 0.75, 0.158],
    [0.135, 0, 0]
  ], { roundness: 0.83 });
  const waistShell = addMesh(pelvis, pelvisGeo, plushMat, 0, 0, 0, 0, 0, 0, true);
  stitchSeam(pelvis, waistShell, u => [waistWidth * (u * 1.75 - 0.875),
    0.088 - 0.029 * Math.sin(u * Math.PI)], 25);

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
  addMesh(pelvis, createWireLoopGeo(-0.12, 0.04, -0.05, -0.08, 0.24, -0.10, -0.04, -0.03, -0.035), wireRedMat);
  addMesh(pelvis, createWireLoopGeo(0.11, 0.03, -0.07, 0.09, 0.25, -0.10, 0.04, -0.03, -0.025), wirePurpMat);

  // =========================================================================
  // LEGS (WITH EXPOSED MECHANICAL JOINTS & ASYMMETRIC SUIT DAMAGE)
  // =========================================================================
  const buildLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.168, -0.08, 0);
    pelvis.add(hip);
    addMesh(hip, new THREE.CylinderGeometry(0.044, 0.044, 0.26, 8), endoMat, 0, -0.06, 0);
    addMesh(hip, new THREE.SphereGeometry(0.052, 8, 8), chromeMat, 0, 0, 0);

    const thigh = paddedShell(isFreddy ? 0.150 : 0.139, isFreddy ? 0.146 : 0.142, 0.398, {
      top: 0.94, bottom: 0.88, bow: 0.024
    });
    addMesh(hip, thigh, plushMat, side * 0.009, -0.247, -0.003, 0.018, 0, side * -0.048, true);
    addMesh(hip, new THREE.CylinderGeometry(0.038, 0.036, 0.44, 8), endoMat, 0, -0.25, 0);
    addMesh(hip, SHARED_ANIM_GEO.hexNut, brassMat, side * 0.038, -0.24, 0.02);

    const knee = new THREE.Group();
    knee.position.set(0, -0.50, 0);
    hip.add(knee);
    // Twin mechanical fork plates + cross axle + damper piston
    addMesh(knee, new THREE.CylinderGeometry(0.038, 0.038, 0.22, 10), endoMat, 0, 0, 0);
    addMesh(knee, new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), chromeMat, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const cap of [-1, 1]) {
      addMesh(knee, SHARED_ANIM_GEO.hexNut, chromeMat, cap * 0.101, 0, 0, 0, 0, Math.PI / 2);
    }
    addMesh(knee, new THREE.BoxGeometry(0.018, 0.13, 0.075), endoMat, -0.055, 0, 0);
    addMesh(knee, new THREE.BoxGeometry(0.018, 0.13, 0.075), endoMat,  0.055, 0, 0);
    addMesh(knee, new THREE.CylinderGeometry(0.016, 0.016, 0.19, 6), chromeMat, side * 0.048, 0, -0.035);
    addMesh(knee, createWireLoopGeo(-side * 0.04, 0.07, 0.02, -side * 0.04, -0.09, 0.03, -side * 0.03, 0, 0.04), wirePurpMat);

    const kneeCapGeo = paddedShell(isFreddy ? 0.107 : 0.104, 0.073, 0.148, { top: 0.90, bottom: 0.81, bow: 0.012 });
    addMesh(knee, kneeCapGeo, plushMat, 0, -0.017, 0.074, -0.13, 0, side * 0.07, true);

    const shinGeo = paddedShell(isFreddy ? 0.123 : 0.119, isFreddy ? 0.127 : 0.121, 0.365, {
      top: 0.91, bottom: 0.78, bow: 0.019
    });
    const shin = addMesh(knee, shinGeo, plushMat, 0, -0.255, 0, 0, 0, 0, true);
    if (!isFreddy && side > 0) {
      stitchSeam(knee, shin, u => [0.038 + u * 0.045 + Math.sin(u * 6) * 0.005, -0.31 + u * 0.113], 11);
    }
    addMesh(knee, new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), endoMat, 0, -0.42, 0);

    const foot = new THREE.Group();
    foot.position.set(0, -0.455, 0.02);
    knee.add(foot);
    const shoe = loftShell([
      [-0.092, 0, 0, 0.052],
      [-0.085, 0.105, 0.145, 0.055],
      [-0.053, 0.139, 0.170, 0.060],
      [-0.013, 0.130, 0.151, 0.054],
      [0.040, 0.110, 0.119, 0.025],
      [0.071, 0.069, 0.075, 0.006],
      [0.086, 0, 0, -0.013]
    ], { sides: 24, rows: 17, roundness: 0.86 });
    addMesh(foot, shoe, plushMat, 0, 0, 0, 0, 0, 0, true);
    addMesh(foot, new RoundedBoxGeometry(0.252, 0.027, 0.355, 1, 0.012),
      wireDarkMat, 0, -0.085, 0.071);
    for (let tread = 0; tread < 5; tread++) {
      addMesh(foot, new THREE.BoxGeometry(0.23, 0.011, 0.017), canvasTrimMat, 0, -0.096, -0.046 + tread * 0.06);
    }

    [-0.087, 0, 0.087].forEach((tx, idx) => {
      const outer = idx !== 1;
      const toeGeo = createSculptedSphere(0.063, 16, 12, v => {
        v.x *= outer ? 0.91 : 1.02;
        v.y *= 0.73;
        v.z *= outer ? 1.41 : 1.56;
        v.y = Math.max(v.y, -0.042);
      });
      addMesh(foot, toeGeo, plushMat, tx, -0.037, outer ? 0.168 : 0.182, 0, tx * 1.93, 0);
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

  const chestWidth = isFreddy ? 0.314 : 0.279;
  const chestTear = isFreddy
    ? { x: -0.234, y: 0.386, rx: 0.031, ry: 0.045, phase: 0.8, depth: 0.088, hardwareZ: 0.124 }
    : { x: 0.207, y: 0.386, rx: 0.022, ry: 0.038, phase: 2.3, depth: 0.075, hardwareZ: 0.121 };
  const torsoGeo = loftShell([
    [-0.126, 0, 0, -0.025],
    [-0.106, chestWidth * 0.55, 0.114, -0.022],
    [-0.057, chestWidth * 0.83, 0.170, -0.015],
    [0.075, chestWidth * 0.95, 0.195, 0.013],
    [0.231, chestWidth * 1.03, 0.216, 0.012],
    [0.390, chestWidth, 0.203, 0.005],
    [0.510, chestWidth * 0.90, 0.178, -0.010],
    [0.610, chestWidth * 0.72, 0.125, -0.018],
    [0.657, chestWidth * 0.44, 0.090, -0.028],
    [0.677, 0, 0, -0.030]
  ], { sides: 56, rows: 35, roundness: isFreddy ? 0.81 : 0.89,
    deform: vertex => recessFabric(vertex, chestTear) });
  const torsoShell = addMesh(torso, torsoGeo, plushMat, 0, 0, 0, 0, 0, 0, true);
  dressTear(torso, torsoShell, chestTear, 0);
  const repairSide = isFreddy ? 1 : -1;
  stitchSeam(torso, torsoShell, u => [repairSide * chestWidth * (0.64 + 0.06 * Math.sin(u * 3)),
    0.002 + u * 0.120], 11);
  const serviceCover = new THREE.Group();
  serviceCover.position.set(isFreddy ? 0.014 : -0.032, 0.328, -0.179);
  serviceCover.rotation.z = isFreddy ? -0.055 : 0.18;
  torso.add(serviceCover);
  addMesh(serviceCover, new RoundedBoxGeometry(0.255, 0.197, 0.031, 1, 0.013), canvasTrimMat);
  addMesh(serviceCover, new RoundedBoxGeometry(0.219, 0.164, 0.026, 1, 0.008), endoMat, 0, 0, -0.021);
  for (const x of [-0.084, 0.084]) {
    for (const y of [-0.06, 0.06]) {
      addMesh(serviceCover, SHARED_ANIM_GEO.screw, brassMat, x, y, -0.035, -Math.PI / 2);
    }
  }
  for (let slit = 0; slit < 4; slit++) {
    const slot = new THREE.BoxGeometry(0.115 - slit * 0.008, 0.007, 0.007);
    addMesh(serviceCover, slot, darkVoidMat, 0, 0.035 - slit * 0.022, -0.036);
  }

  const bibWidth = isFreddy ? 0.189 : 0.164;
  const bellyGeo = loftShell([
    [-0.065, 0, 0, 0.143],
    [-0.045, bibWidth * 0.63, 0.026, 0.155],
    [0.008, bibWidth * 0.89, 0.047, 0.174],
    [0.135, bibWidth, 0.054, 0.195],
    [0.278, bibWidth * 0.98, 0.055, 0.202],
    [0.398, bibWidth * 0.78, 0.048, 0.186],
    [0.481, bibWidth * 0.48, 0.029, 0.174],
    [0.508, 0, 0, 0.167]
  ], { sides: 28, rows: 22, roundness: 0.88, deform: v => {
    v.z -= 0.037 * Math.pow(Math.abs(v.x) / bibWidth, 1.8);
  } });
  const bib = addMesh(torso, bellyGeo, bellyMat, 0, 0, 0, 0, 0, 0, true);
  for (const side of [-1, 1]) {
    stitchSeam(torso, bib, u => {
      const angle = (u - 0.44) * Math.PI * 0.83;
      return [side * Math.cos(angle) * bibWidth * 0.83, 0.208 + Math.sin(angle) * 0.235];
    }, 27);
  }

  // Internal Endo Ribcage, Coiled Springlocks & Exposed Chest Tears!
  addMesh(torso, new THREE.CylinderGeometry(0.046, 0.052, 0.48, 8), endoMat, 0, 0.31, 0.02);
  [0.20, 0.30, 0.40].forEach(ry => {
    addMesh(torso, SHARED_ANIM_GEO.ribArc, chromeMat, 0, ry, 0.04, Math.PI / 2, 0, -Math.PI * 0.075);
  });
  addMesh(torso, SHARED_ANIM_GEO.chestSpring, brassMat, -0.12, 0.36, 0.14);
  addMesh(torso, SHARED_ANIM_GEO.chestSpring, brassMat,  0.12, 0.34, 0.13);

  const button = new THREE.SphereGeometry(0.024, 16, 11);
  const buttonY = isFreddy ? [0.395, 0.302] : [0.410, 0.336];
  for (const y of buttonY) {
    const z = fabricPoint(bib, 0, y)?.z ?? 0.241;
    const cap = addMesh(torso, button, buttonMat, 0, y, z + 0.004);
    cap.scale.z = 0.45;
    addMesh(torso, new THREE.TorusGeometry(0.024, 0.002, 5, 16), backingMat, 0, y, z - 0.001);
  }
  if (isFreddy) {
    const idPlate = addMesh(torso, new THREE.BoxGeometry(0.073, 0.035, 0.009), brassMat, 0.203, 0.449, 0.164, 0, 0.44, -0.12);
    for (let mark = 0; mark < 4; mark++) {
      addMesh(idPlate, new THREE.BoxGeometry(0.005, 0.022 - mark * 0.003, 0.002), backingMat,
        -0.025 + mark * 0.013, 0, 0.006);
    }
  }

  const bowtie = new THREE.Group();
  bowtie.position.set(0, 0.527, isFreddy ? 0.214 : 0.209);
  bowtie.rotation.z = isFreddy ? -0.083 : 0.055;
  torso.add(bowtie);
  const tieBand = addMesh(torso, new THREE.TorusGeometry(0.129, 0.014, 7, 30), velvetMat,
    0, 0.568, 0.028, 1.32);
  tieBand.scale.set(1.31, 1.03, 0.95);
  addMesh(bowtie, new RoundedBoxGeometry(0.065, 0.069, 0.050, 2, 0.018), velvetMat, 0, 0, 0.015, 0.14, 0.10);
  if (isFreddy) addMesh(bowtie, new THREE.SphereGeometry(0.008, 8, 6), brassMat, 0, -0.014, 0.041);
  [-1, 1].forEach(sx => {
    const wing = createSculptedSphere(0.078, 30, 19, v => {
      const outer = smoothstep(sx * v.x, -0.057, 0.054);
      const originalY = v.y;
      v.x *= isFreddy ? 1.22 : 1.31;
      v.y *= 0.30 + outer * (isFreddy ? 0.72 : 0.78);
      v.z *= 0.49;
      v.y += (outer - 0.4) * (sx > 0 ? 0.014 : -0.007);
      if (v.z > 0) {
        const ridge = Math.cos((originalY - 0.018 * outer + Math.sin(outer * 3) * 0.005) * 138);
        v.z += ridge * Math.sin(outer * Math.PI) * 0.011;
      }
    });
    addMesh(bowtie, wing, velvetMat, sx * 0.086, sx * 0.005, 0, -0.08, sx * -0.12, sx * 0.09);
  });

  // =========================================================================
  // Arms and articulated hands
  // =========================================================================
  const digits = [
    { x: -0.055, y: -0.102, lengths: [0.056, 0.043, 0.034], width: 1.02, spread: -0.14 },
    { x: -0.020, y: -0.111, lengths: [0.063, 0.046, 0.036], width: 1.10, spread: -0.03 },
    { x:  0.018, y: -0.107, lengths: [0.059, 0.043, 0.035], width: 1.00, spread: 0.065 },
    { x:  0.054, y: -0.096, lengths: [0.048, 0.035, 0.029], width: 0.85, spread: 0.23 }
  ];

  function segment(parent, length, width, tip = false, worn = false) {
    const size = tip ? 0.036 : 0.046;
    const joint = addMesh(parent, SHARED_ANIM_GEO.knuckle, endoMat, 0, 0, 0, 0, 0, Math.PI / 2);
    joint.scale.y = width;
    const pin = addMesh(parent, SHARED_ANIM_GEO.knucklePin, chromeMat, 0, 0, 0, 0, 0, Math.PI / 2);
    pin.scale.y = width;
    const armor = addMesh(parent, tip ? SHARED_ANIM_GEO.fingertip : SHARED_ANIM_GEO.phalanx,
      worn && tip ? endoMat : handShellMat, 0, -length * 0.53, 0.002, 0, 0, 0, true);
    armor.scale.set(width, (length - (tip ? 0.002 : 0.012)) / size, width);
    if (tip) {
      const pad = addMesh(parent, SHARED_ANIM_GEO.fingertipPlate, worn ? chromeMat : canvasTrimMat,
        0, -length * 0.72, -width * 0.011);
      pad.scale.set(width, 1.12, 0.44);
    }
  }

  const buildArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (isFreddy ? 0.335 : 0.30), 0.54, 0);
    torso.add(shoulder);

    addMesh(shoulder, new THREE.SphereGeometry(0.058, 10, 8), endoMat);
    addMesh(shoulder, new THREE.CylinderGeometry(0.028, 0.028, 0.20, 8), chromeMat, side * 0.04, -0.06, 0, 0, 0, side * 0.25);
    addMesh(shoulder, createWireLoopGeo(0, 0.03, 0.03, side * 0.06, -0.11, 0.04, side * 0.03, 0, 0.05), wireDarkMat);

    const pauldronGeo = loftShell([
      [-0.046, 0, 0, 0.010],
      [-0.026, 0.115, 0.083, 0.009],
      [0.007, 0.125, 0.103, 0.008],
      [0.050, 0.108, 0.091],
      [0.090, 0.068, 0.058, -0.010],
      [0.103, 0, 0, -0.016]
    ], { sides: 24, rows: 16, roundness: 0.87 });
    addMesh(shoulder, pauldronGeo, plushMat, side * 0.013, 0.012, 0,
      0.08, side * -0.10, -side * 0.37, true);
    addMesh(shoulder, new THREE.CylinderGeometry(0.080, 0.060, 0.063, 10),
      wireDarkMat, side * 0.022, -0.036, 0, 0, 0, -side * 0.28);

    const uArmGeo = paddedShell(isFreddy ? 0.113 : 0.105, 0.111, 0.291, { top: 0.88, bottom: 0.87, bow: 0.015 });
    addMesh(shoulder, uArmGeo, plushMat, side * 0.027, -0.212, 0, 0, 0, 0, true);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.03, -0.40, 0);
    shoulder.add(elbow);
    addMesh(elbow, new THREE.SphereGeometry(0.046, 8, 8), endoMat);
    addMesh(elbow, new THREE.CylinderGeometry(0.022, 0.022, 0.15, 8), chromeMat, 0, 0, 0, 0, 0, Math.PI / 2);
    addMesh(elbow, new THREE.BoxGeometry(0.015, 0.11, 0.06), endoMat, -0.04, 0, 0);
    addMesh(elbow, new THREE.BoxGeometry(0.015, 0.11, 0.06), endoMat,  0.04, 0, 0);

    addMesh(elbow, new THREE.CylinderGeometry(0.034, 0.030, 0.30, 8), endoMat, 0, -0.18, 0);
    const forearmGeo = paddedShell(isFreddy ? 0.107 : 0.098, isFreddy ? 0.104 : 0.099, 0.276, {
      top: 0.95, bottom: 0.76, bow: 0.010
    });
    const forearm = addMesh(elbow, forearmGeo, plushMat, 0, -0.181, 0, 0, 0, 0, true);
    addMesh(elbow, new THREE.CylinderGeometry(0.057, 0.045, 0.032, 14), wireDarkMat, 0, -0.298, 0);
    if (!isFreddy && side < 0) {
      stitchSeam(elbow, forearm, u => [-0.055 + u * 0.022, -0.264 + u * 0.103 + Math.sin(u * 8) * 0.008], 11);
    }

    const hand = new THREE.Group();
    hand.position.set(0, -0.37, 0);
    elbow.add(hand);
    addMesh(hand, new THREE.CylinderGeometry(0.023, 0.020, 0.081, 10), endoMat, 0, 0.021, 0);
    addMesh(hand, new THREE.CylinderGeometry(0.034, 0.028, 0.026, 12), chromeMat, 0, -0.006, 0);
    addMesh(hand, new THREE.TorusGeometry(0.029, 0.004, 5, 14), brassMat, 0, 0.002, 0, Math.PI / 2);

    const palmGeo = new RoundedBoxGeometry(0.145, 0.112, 0.061, 2, 0.026);
    const palmVertices = palmGeo.attributes.position;
    for (let i = 0; i < palmVertices.count; i++) {
      const y = palmVertices.getY(i);
      const x = palmVertices.getX(i);
      const width = 1 - 0.28 * smoothstep(y, -0.023, 0.055);
      palmVertices.setXYZ(i, x * width, y + Math.abs(x) * 0.083, palmVertices.getZ(i) - x * side * 0.095);
    }
    addMesh(hand, palmGeo, handShellMat, 0, -0.059, 0, 0, 0, 0, true);
    const palmPad = addMesh(hand, new RoundedBoxGeometry(0.104, 0.062, 0.021, 1, 0.010),
      canvasTrimMat, side * 0.009, -0.068, -0.028, 0.04, 0.09 * side, 0.13 * side);
    palmPad.scale.y = isFreddy ? 0.96 : 1.1;
    for (const x of [-0.042, 0.044]) {
      addMesh(hand, SHARED_ANIM_GEO.screw, endoMat, x, -0.071, 0.030, Math.PI / 2);
    }

    const fingers = digits.map(({ x, y, lengths, width, spread }, index) => {
      const finger = new THREE.Group();
      const seg2 = new THREE.Group();
      const seg3 = new THREE.Group();
      finger.position.set(side * x, y, index === 3 ? 0.001 : 0.006);
      seg2.position.y = -lengths[0];
      seg3.position.y = -lengths[1];
      hand.add(finger);
      finger.add(seg2);
      seg2.add(seg3);
      const worn = isFreddy ? side < 0 && index === 1 : (side < 0 ? index === 2 : index === 3);
      segment(finger, lengths[0], width);
      segment(seg2, lengths[1], width * 0.92);
      segment(seg3, lengths[2], width * 0.86, true, worn);
      return { finger, seg2, seg3, spread: spread * side, index };
    });

    const thumb = new THREE.Group();
    const thumbTip = new THREE.Group();
    thumb.position.set(-side * 0.068, -0.072, -0.013);
    thumbTip.position.y = -0.048;
    hand.add(thumb);
    thumb.add(thumbTip);
    segment(thumb, 0.048, 1.22);
    segment(thumbTip, 0.041, 1.02, true);
    return { shoulder, elbow, hand, fingers, thumb, thumbTip, side };
  };
  const armL = buildArm(-1);
  const armR = buildArm(1);

  let microphone = null;
  if (isFreddy) {
    microphone = new THREE.Group();
    microphone.name = 'stageMicrophone';
    microphone.position.set(0.008, -0.140, -0.049);
    microphone.rotation.z = Math.PI / 2;
    armR.hand.add(microphone);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x242221, roughness: 0.51, metalness: 0.27 });
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0xa0a39a, roughness: 0.36, metalness: 0.67 });
    addMesh(microphone, new THREE.CylinderGeometry(0.022, 0.015, 0.207, 18), handleMat, 0, -0.013, 0);
    addMesh(microphone, new THREE.CylinderGeometry(0.026, 0.024, 0.016, 18), chromeMat, 0, 0.079, 0);
    addMesh(microphone, new THREE.CylinderGeometry(0.0165, 0.014, 0.014, 12), brassMat, 0, -0.119, 0);
    addMesh(microphone, new THREE.CylinderGeometry(0.031, 0.027, 0.046, 18), handleMat, 0, 0.108, 0);
    addMesh(microphone, new THREE.SphereGeometry(0.031, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      grilleMat, 0, 0.129, 0);
    for (let ring = 0; ring < 8; ring++) {
      const height = 0.085 + ring * 0.0071;
      const radius = height < 0.129 ? 0.031 : Math.sqrt(0.031 ** 2 - (height - 0.129) ** 2);
      addMesh(microphone, new THREE.TorusGeometry(radius, 0.00165, 5, 20),
        grilleMat, 0, height, 0, Math.PI / 2);
    }
    for (let rib = 0; rib < 14; rib++) {
      const angle = rib * Math.PI / 7;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      addMesh(microphone, createWireLoopGeo(x * 0.030, 0.090, z * 0.030,
        x * 0.020, 0.151, z * 0.020, x * 0.008, 0, z * 0.008, 0.0013), grilleMat);
    }
    batchMeshes(microphone, () => true);
    microphone.visible = false;
  }

  // =========================================================================
  // NECK, SPRINGLOCK SKULL & UNCANNY FACE
  // =========================================================================
  const neck = new THREE.Group();
  neck.position.set(0, 0.62, 0);
  torso.add(neck);
  addMesh(neck, new THREE.CylinderGeometry(0.054, 0.062, 0.18, 10), endoMat, 0, 0.055, 0);
  const bellows = new THREE.TorusGeometry(0.057, 0.006, 5, 16);
  for (let ring = 0; ring < 5; ring++) {
    addMesh(neck, bellows, wireDarkMat, 0, 0.028 + ring * 0.020, -0.008, Math.PI / 2);
  }
  addMesh(neck, new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), chromeMat, -0.048, 0.055, 0.032);
  addMesh(neck, new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), chromeMat,  0.048, 0.055, 0.032);
  addMesh(neck, SHARED_ANIM_GEO.neckSpring, brassMat, -0.046, 0.055, -0.025);
  addMesh(neck, SHARED_ANIM_GEO.neckSpring, brassMat,  0.046, 0.055, -0.025);
  addMesh(neck, createWireLoopGeo(-0.04, 0.01, 0.05, 0.05, 0.12, 0.04, -0.05, 0, 0.04), wireRedMat);

  const head = new THREE.Group();
  head.position.set(0, 0.22, 0.02);
  neck.add(head);

  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, -0.105, isFreddy ? 0.282 : 0.255);
  head.add(mouthAnchor);

  const headTear = isFreddy
    ? { x: -0.209, y: -0.051, rx: 0.026, ry: 0.034, phase: 2.4, depth: 0.084, hardwareZ: 0.135 }
    : { x: 0.175, y: 0.101, rx: 0.022, ry: 0.035, phase: 4.6, depth: 0.076, hardwareZ: 0.113 };
  const skullSections = isFreddy ? [
    [-0.146, 0, 0, 0.020],
    [-0.125, 0.149, 0.112, 0.025],
    [-0.092, 0.225, 0.158, 0.028],
    [-0.027, 0.265, 0.191, 0.020],
    [0.038, 0.253, 0.209, 0.002],
    [0.111, 0.244, 0.201, -0.006],
    [0.178, 0.217, 0.171, -0.007],
    [0.222, 0.169, 0.131, -0.011],
    [0.246, 0.091, 0.072, -0.014],
    [0.256, 0, 0, -0.018]
  ] : [
    [-0.138, 0, 0, 0.013],
    [-0.119, 0.122, 0.105, 0.022],
    [-0.084, 0.204, 0.153, 0.030],
    [-0.015, 0.227, 0.185, 0.016],
    [0.054, 0.224, 0.205, 0.005],
    [0.117, 0.214, 0.189, -0.004],
    [0.178, 0.194, 0.162, -0.015],
    [0.229, 0.145, 0.112, -0.017],
    [0.251, 0.075, 0.056, -0.013],
    [0.264, 0, 0, -0.010]
  ];
  const craniumGeo = loftShell(skullSections, {
    sides: 64, rows: 46, roundness: isFreddy ? 0.84 : 0.96,
    deform: v => {
      const side = Math.abs(v.x);
      const face = smoothstep(v.z, 0.065, 0.125);
      const socket = Math.hypot((side - 0.089) / 0.071, (v.y - 0.049) / 0.068);
      const ridge = Math.exp(-Math.pow((v.y - 0.121 - side * 0.079) / 0.033, 2));
      v.z += face * (ridge * (1 - smoothstep(side, 0.092, 0.181)) * (isFreddy ? 0.048 : 0.031)
        - 0.108 * (1 - smoothstep(socket, 0.52, 1.19)));
      v.x += Math.sin(v.y * 17 + v.z * 7) * (isFreddy ? 0.003 : 0.005);
      recessFabric(v, headTear);
    }
  });
  const faceShell = addMesh(head, craniumGeo, plushMat, 0, 0.04, 0, 0, 0, 0, true);
  dressTear(head, faceShell, headTear, 0.04);
  stitchSeam(head, faceShell, u => {
    const side = isFreddy ? 1 : -1;
    return [side * (0.102 + u * 0.079), 0.198 - u * 0.039 + Math.sin(u * 4) * 0.009];
  }, 11);
  stitchSeam(head, faceShell, u => {
    const side = isFreddy ? 1 : -1;
    return [side * (0.185 + 0.051 * Math.sin(u * Math.PI)), 0.116 - u * 0.133];
  }, 12);

  // Inner Endo Skull, Throat Voicebox & Double Endo-Teeth
  addMesh(head, new THREE.SphereGeometry(0.172, 14, 12), darkVoidMat, 0, -0.025, 0.03);
  addMesh(head, new THREE.CylinderGeometry(0.052, 0.062, 0.16, 10), throatMat, 0, -0.04, 0.05);
  // Circular voicebox speaker inside throat
  addMesh(head, new THREE.CylinderGeometry(0.044, 0.044, 0.03, 12), endoMat, 0, -0.035, 0.095, Math.PI / 2);
  addMesh(head, new THREE.BoxGeometry(0.158, 0.044, 0.15), endoMat, 0, -0.035, 0.115);
  for (let slot = 0; slot < 5; slot++) {
    const bar = new THREE.BoxGeometry(0.075 - Math.abs(slot - 2) * 0.010, 0.004, 0.006);
    addMesh(head, bar, chromeMat, 0, -0.034 - slot * 0.008, 0.117);
  }

  // Upper Inner Endo Teeth ("teeth behind teeth")
  [-0.062, -0.037, -0.012, 0.012, 0.037, 0.062].forEach(fx => {
    addMesh(head, SHARED_ANIM_GEO.endoFang, chromeMat, fx, -0.072, 0.168 - Math.abs(fx) * 0.25, Math.PI, 0, 0);
  });

  const muzzleWidth = isFreddy ? 0.161 : 0.127;
  const muzzleDepth = isFreddy ? 0.114 : 0.088;
  const snoutGeo = loftShell([
    [-0.070, 0, 0, 0.012],
    [-0.060, muzzleWidth * 0.59, muzzleDepth * 0.64, 0.014],
    [-0.035, muzzleWidth * 0.94, muzzleDepth * 0.92, 0.009],
    [0.005, muzzleWidth, muzzleDepth, 0.002],
    [0.038, muzzleWidth * 0.91, muzzleDepth * 0.89, 0.001],
    [0.060, muzzleWidth * 0.60, muzzleDepth * 0.62, -0.001],
    [0.073, 0, 0, -0.006]
  ], {
    sides: 40, rows: 24, roundness: isFreddy ? 0.83 : 0.93,
    deform: v => {
      const center = 1 - smoothstep(Math.abs(v.x + 0.004), 0, 0.028);
      v.z -= smoothstep(v.z, 0.026, 0.070) * center * (1 - smoothstep(v.y, 0.014, 0.046)) * 0.017;
    }
  });
  const muzzle = addMesh(head, snoutGeo, bellyMat, 0, isFreddy ? -0.018 : -0.022, isFreddy ? 0.178 : 0.175,
    0, 0, isFreddy ? 0.012 : -0.026, true);
  stitchSeam(head, muzzle, u => {
    const angle = 0.30 + u * 2.49;
    return [Math.cos(angle) * muzzleWidth * 0.85, -0.016 - Math.sin(angle) * 0.062];
  }, 21);

  // Whisker pores (Fredbear) or crooked stiff whiskers (SpringBonnie)
  [-1, 1].forEach(sx => {
    [
      [0.088, -0.006, 0.242, 0.10, -0.35],
      [0.108, -0.022, 0.232, -0.06, -0.48],
      [0.095, -0.034, 0.244, -0.18, -0.30]
    ].forEach(([wx, wy, wz, rz, ry], wIdx) => {
      if (isFreddy) {
        const surface = fabricPoint(muzzle, sx * wx, wy, 0.0018);
        if (!surface) return;
        const pore = addMesh(head, SHARED_ANIM_GEO.rivet, backingMat, sx * wx, wy, surface.z);
        pore.scale.set(0.44, 0.44, 0.20);
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
        w.scale.y = wIdx === 1 && sx > 0 ? 0.35 : 0.56;
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
  addMesh(head, noseGeo, noseMat, 0, 0.037, isFreddy ? 0.281 : 0.261, 0, 0, isFreddy ? -0.042 : 0.053);

  // Recessed housings, acrylic eyes and independently moving eyelids.
  const eyes = [];
  [-0.089, 0.089].forEach((ex, eIdx) => {
    const socket = new THREE.Group();
    const side = Math.sign(ex);
    socket.position.set(ex, 0.089, 0.174);
    head.add(socket);

    addMesh(socket, new THREE.CylinderGeometry(0.062, 0.059, 0.06, 20), darkVoidMat, 0, 0, -0.021, Math.PI / 2);
    addMesh(socket, new THREE.TorusGeometry(0.054, 0.0047, 7, 24), backingMat, 0, 0, 0.005);
    if (!isFreddy && side > 0) {
      addMesh(socket, new THREE.TorusGeometry(0.047, 0.0028, 5, 13, 1.54), endoMat,
        0.006, 0.007, 0.013, 0, 0, -0.15);
      addMesh(socket, SHARED_ANIM_GEO.screw, brassMat, 0.050, 0.018, 0.012, Math.PI / 2);
    }
    const browGeo = createSculptedSphere(isFreddy ? 0.062 : 0.056, 18, 12, v => {
      v.y = v.y * (isFreddy ? 0.24 : 0.26) + (1 - (v.x / 0.062) ** 2) * 0.010;
      v.z *= 0.42;
    });
    const browY = 0.164 + (eIdx === 0 ? 0.006 : 0);
    const browZ = fabricPoint(faceShell, ex + side * 0.009, browY)?.z ?? 0.182;
    addMesh(head, browGeo, isFreddy ? canvasTrimMat : plushMat,
      ex + side * 0.009, browY, browZ - 0.003, 0, side * 0.34, side * 0.15);

    const eyeball = addMesh(socket, SHARED_ANIM_GEO.eye, eyeballMat);
    const eyeVoid = addMesh(socket, SHARED_ANIM_GEO.eye, eyeVoidMat);
    eyeVoid.visible = false;

    const pupil = addMesh(socket, new THREE.SphereGeometry(0.0058, 8, 8), pupilMat, 0, 0, 0.052);
    pupil.visible = false;

    // Upper heavy eyelid
    const lidPivot = new THREE.Group();
    socket.add(lidPivot);
    const lidGeo = new THREE.SphereGeometry(0.057, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.40);
    addMesh(lidPivot, lidGeo, plushMat, 0, 0, 0, -0.14, 0, 0);

    // Lower heavy eyelid
    const lowerLidPivot = new THREE.Group();
    socket.add(lowerLidPivot);
    const lowerLidGeo = new THREE.SphereGeometry(0.056, 20, 10, 0, Math.PI * 2, Math.PI * 0.61, Math.PI * 0.39);
    addMesh(lowerLidPivot, lowerLidGeo, plushMat, 0, 0, 0, 0.10, 0, 0);

    eyes.push({ eyeball, eyeVoid, pupil, lidPivot, lowerLidPivot, idx: eIdx });
  });

  // Upper Sculpted Teeth (irregular slightly crooked aged teeth)
  const upperTeethX = isFreddy
    ? [-0.105, -0.075, -0.045, -0.015, 0.015, 0.045, 0.075, 0.105]
    : [-0.102, -0.072, -0.044, -0.017, 0.017, 0.044, 0.072, 0.102];
  addMesh(head, arcRail(0.125, -0.067, isFreddy ? 0.276 : 0.249, 0.057, 0.012), toothFixingMat);
  upperTeethX.forEach((tx, idx) => {
    const isBuck = !isFreddy && (idx === 3 || idx === 4);
    const tz = (isFreddy ? 0.282 : 0.255) - Math.abs(tx) * 0.43;
    const tMesh = addMesh(
      head,
      isBuck ? SHARED_ANIM_GEO.toothBuck : idx === (isFreddy ? 6 : 1) ? SHARED_ANIM_GEO.toothChipped : SHARED_ANIM_GEO.toothBlock,
      teethMat,
      tx,
      isBuck ? -0.094 : -0.087,
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

  const lJawGeo = createSculptedSphere(isFreddy ? 0.148 : 0.132, 32, 19, v => {
    v.x *= isFreddy ? 1.44 : 1.40;
    v.y *= 0.50;
    v.z *= isFreddy ? 1.22 : 1.16;
    v.y -= smoothstep(v.z, 0.068, 0.134) * (1 - smoothstep(v.y, -0.022, 0.013)) * 0.014;
  });
  const jawShell = addMesh(jaw, lJawGeo, plushMat, 0, -0.056, 0.108, 0, 0, 0, true);
  stitchSeam(jaw, jawShell, u => {
    const arc = 0.34 + u * 2.46;
    return [Math.cos(arc) * (isFreddy ? 0.178 : 0.160), -0.060 - Math.sin(arc) * 0.047];
  }, 21);
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
  addMesh(jaw, arcRail(0.130, -0.018, isFreddy ? 0.254 : 0.228, 0.056, 0.012), toothFixingMat);
  lowerTeethX.forEach((tx, idx) => {
    const tz = (isFreddy ? 0.259 : 0.233) - Math.abs(tx) * 0.44;
    const tMesh = addMesh(
      jaw,
      idx === (isFreddy ? 1 : 5) ? SHARED_ANIM_GEO.toothChipped : SHARED_ANIM_GEO.toothBlock,
      teethMat,
      tx,
      -0.004,
      tz,
      Math.PI - 0.04,
      -tx * 2.2,
      (idx % 2 === 0 ? -1 : 1) * 0.035
    );
    tMesh.scale.y = 0.90 + ((idx * 13) % 5) * 0.04;
  });

  const jawActuators = [-1, 1].map(side => {
    const barrel = new THREE.Group();
    const piston = new THREE.Group();
    barrel.position.set(side * 0.148, -0.027, 0.112);
    head.add(barrel, piston);
    addMesh(barrel, new THREE.CylinderGeometry(0.016, 0.016, 0.088, 9), endoMat, 0, -0.042, 0);
    addMesh(barrel, new THREE.CylinderGeometry(0.020, 0.019, 0.014, 10), brassMat, 0, -0.077, 0);
    addMesh(barrel, new THREE.SphereGeometry(0.019, 8, 8), chromeMat);
    addMesh(piston, new THREE.CylinderGeometry(0.0085, 0.0085, 0.143, 8), chromeMat, 0, 0.070, 0);
    addMesh(piston, new THREE.SphereGeometry(0.012, 8, 8), brassMat);
    const anchor = new THREE.Vector3(side * 0.142, -0.047, 0.149);
    piston.position.copy(jaw.position).add(anchor);
    return { barrel, piston, anchor };
  });

  // Articulated ears and the padded stage hat.
  let earL, earR, earTipL, earTipR;

  if (isFreddy) {
    const bearEar = side => {
      const ear = new THREE.Group();
      ear.position.set(side * 0.224, 0.210, -0.009);
      ear.rotation.z = -side * 0.38;
      head.add(ear);
      addMesh(ear, new THREE.CylinderGeometry(0.018, 0.018, 0.085, 8), endoMat, 0, -0.04, 0);
      const outer = createSculptedSphere(0.092, 28, 20, v => {
        v.x *= 0.98;
        v.y *= 1.08 - Math.max(0, -v.x * side) * 0.48;
        v.z *= 0.56;
        if (v.z > 0) v.z -= (1 - smoothstep(Math.hypot(v.x, v.y), 0.031, 0.072)) * 0.026;
      });
      addMesh(ear, outer, plushMat, 0, 0, 0, 0, 0.08 * side, 0, true);
      addMesh(ear, new THREE.TorusGeometry(0.052, 0.0035, 5, 21), canvasTrimMat, 0, 0.002, 0.030);
      const pad = addMesh(ear, new THREE.SphereGeometry(0.051, 20, 14), bellyMat, 0, 0.002, 0.025);
      pad.scale.set(0.91, 1.03, 0.31);
      if (side < 0) {
        addMesh(ear, createWireLoopGeo(-0.052, 0.048, 0.027, -0.062, 0.067, 0.022, -0.006, 0.003, 0.003, 0.0024),
          backingMat);
      }
      return ear;
    };
    earL = bearEar(-1);
    earR = bearEar(1);

    const hat = new THREE.Group();
    hat.position.set(-0.011, 0.281, -0.018);
    hat.rotation.set(0.022, -0.20, -0.135);
    head.add(hat);
    const brim = paddedShell(0.137, 0.112, 0.038, { top: 0.98, bottom: 0.92, bow: 0.004 });
    addMesh(hat, brim, velvetMat, 0, 0, 0, 0, 0, 0, true);
    const crown = loftShell([
      [0.01, 0, 0], [0.018, 0.075, 0.065], [0.044, 0.081, 0.072], [0.137, 0.091, 0.077, -0.004],
      [0.169, 0.094, 0.080, -0.005], [0.181, 0.078, 0.065, -0.006], [0.184, 0, 0, -0.007]
    ], { sides: 28, rows: 19, roundness: 0.93 });
    addMesh(hat, crown, velvetMat, 0, 0, 0, 0, 0, 0, true);
    const band = addMesh(hat, new THREE.CylinderGeometry(0.085, 0.081, 0.033, 26),
      buttonMat, 0, 0.038, 0);
    band.scale.z = 0.91;
    addMesh(hat, new RoundedBoxGeometry(0.036, 0.021, 0.008, 1, 0.003),
      brassMat, 0.045, 0.039, 0.069, 0, 0.49, -0.10);
  } else {
    const makePaddleEar = side => {
      const base = new THREE.Group();
      base.position.set(side * 0.115, 0.242, -0.010);
      head.add(base);
      addMesh(base, new THREE.CylinderGeometry(0.011, 0.011, 0.075, 6), chromeMat, -0.02, -0.01, 0);
      addMesh(base, new THREE.CylinderGeometry(0.011, 0.011, 0.075, 6), chromeMat,  0.02, -0.01, 0);

      const lower = paddedShell(side < 0 ? 0.081 : 0.078, 0.047, 0.238, {
        top: 0.90, bottom: 0.70, bow: -0.006
      });
      addMesh(base, lower, plushMat, 0, 0.13, 0, 0, 0, 0, true);
      const rim = paddedShell(0.058, 0.016, 0.191, { top: 0.86, bottom: 0.70 });
      addMesh(base, rim, canvasTrimMat, 0, 0.131, 0.035, -0.035, 0, 0.04 * side);
      const insert = paddedShell(0.048, 0.015, 0.175, { top: 0.89, bottom: 0.67 });
      addMesh(base, insert, bellyMat, 0, 0.134, 0.042, -0.035, 0, 0.04 * side);

      const tip = new THREE.Group();
      tip.position.set(0, 0.26, 0);
      base.add(tip);
      addMesh(tip, new THREE.CylinderGeometry(0.009, 0.009, 0.065, 6), chromeMat, -0.018, 0, 0);
      addMesh(tip, new THREE.CylinderGeometry(0.009, 0.009, 0.065, 6), chromeMat,  0.018, 0, 0);
      if (side > 0) {
        addMesh(tip, createWireLoopGeo(-0.02, -0.02, 0.02, 0.02, 0.050, 0.023, 0.023, 0, 0.025, 0.004), wireRedMat);
        addMesh(tip, new RoundedBoxGeometry(0.051, 0.021, 0.020, 1, 0.004),
          brassMat, 0, 0.039, 0.026, -0.25, 0.22, 0.11);
      }

      const upper = paddedShell(0.075, 0.045, side < 0 ? 0.213 : 0.198, { top: 0.63, bottom: 0.94, bow: 0.013 });
      addMesh(tip, upper, plushMat, 0, 0.12, 0, 0, 0, 0, true);
      const tipInsert = paddedShell(0.050, 0.014, 0.143, { top: 0.63, bottom: 0.93, bow: 0.009 });
      addMesh(tip, tipInsert, bellyMat, 0, 0.122, 0.036, 0, 0, -side * 0.09);

      return { base, tip };
    };
    const left = makePaddleEar(-1);
    const right = makePaddleEar(1);
    earL = left.base;
    earTipL = left.tip;
    earR = right.base;
    earTipR = right.tip;
    earL.rotation.set(0, 0, 0.08);
    earTipL.rotation.set(0.18, 0, 0.16);
    earR.rotation.set(0, 0, -0.34);
    earTipR.rotation.set(0.32, 0, -0.58);
  }

  const movingEyes = new Set(eyes.flatMap(eye => [eye.eyeball, eye.eyeVoid, eye.pupil]));
  skinRigidParts(root, mesh => mesh.parent !== microphone && mesh !== contactShadow && !movingEyes.has(mesh));

  return {
    type, root, contactShadow, pelvis, torso, neck, head, jaw, mouthAnchor, jawActuators,
    legL, legR, armL, armR, microphone, eyes, pupilMat,
    earL, earR, earTipL, earTipR
  };
}
