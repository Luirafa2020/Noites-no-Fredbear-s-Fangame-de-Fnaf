import * as THREE from 'three';

export function dressSecurityRooms(scene, box, { metal, duct, curtain, wire, brass, tablecloth }) {
  const material = (color, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const lightPanel = (color, intensity) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

  const paint = material(0x342626, 0.85);
  const enamel = material(0x7f8171, 0.46, 0.25);
  const steel = material(0x747e80, 0.39, 0.42);
  const rubber = material(0x151918, 0.88);
  const paper = material(0xb3a082, 0.87);
  const porcelain = material(0xa7a594, 0.47);
  const hazard = material(0x997339, 0.73);
  const tube = lightPanel(0xdbe8dd, 0.75);
  const indicator = lightPanel(0xb44322, 1.1);
  const greenMarker = lightPanel(0x568b67, 0.82);

  function place(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.receiveShadow = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  }

  function fixture(x, y, z, length, alongZ = false) {
    const w = alongZ ? 0.19 : length;
    const d = alongZ ? length : 0.19;
    box(w + 0.06, 0.10, d + 0.03, metal, x, y, z);
    box(w - 0.06, 0.02, d - 0.06, tube, x, y - 0.056, z);
    for (const end of [-1, 1]) {
      box(alongZ ? w + 0.03 : 0.045, 0.10, alongZ ? 0.045 : d + 0.03, rubber,
        x + (alongZ ? 0 : end * length * 0.43), y - 0.035, z + (alongZ ? end * length * 0.43 : 0));
    }
  }

  // Folded stage drapes and their footlights.
  for (const side of [-1, 1]) {
    const drape = new THREE.PlaneGeometry(1.44, 2.78, 28, 12);
    const positions = drape.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setXYZ(i, x * (0.93 + y * 0.055) + side * Math.cos(y * 1.4) * 0.055, y,
        Math.sin(x * 39 + y * 0.57) * 0.064 + Math.cos(x * 20 - y * 0.4) * 0.025);
    }
    drape.computeVertexNormals();
    place(drape, curtain, side * 3.0, 1.84, -21.29);
    box(1.7, 0.065, 0.10, brass, side * 2.77, 0.50, -21.18);
    for (let i = 0; i < 4; i++) {
      box(0.15, 0.085, 0.14, metal, side * (1.72 + i * 0.42), 0.50, -21.19);
      box(0.10, 0.030, 0.054, tube, side * (1.72 + i * 0.42), 0.55, -21.17);
    }
  }
  box(6.80, 0.09, 0.046, paint, 0, 0.24, -21.18);
  box(6.80, 0.026, 0.052, brass, 0, 0.32, -21.17);
  for (let i = -4; i <= 4; i++) {
    box(0.024, 0.23, 0.040, metal, i * 0.72, 0.19, -21.174);
  }

  // The dining room keeps plates, paper cups, slipped tablecloths and booth seats.
  fixture(-4.35, 3.25, -16.00, 1.94, true);
  fixture(3.85, 3.28, -19.68, 1.84, true);
  const plate = new THREE.CylinderGeometry(0.12, 0.084, 0.018, 16);
  const cup = new THREE.CylinderGeometry(0.046, 0.032, 0.105, 10, 1, true);
  const cupWall = paper.clone();
  cupWall.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    box(0.025, 0.19, 5.35, tablecloth, side * 4.49, 0.663, -17.50);
    box(0.27, 0.38, 4.34, paint, side * 7.56, 0.53, -21.80);
    box(0.57, 0.12, 4.31, rubber, side * 7.36, 0.44, -21.80);
    for (let i = 0; i < 5; i++) {
      const z = -19.53 + i * 0.85;
      place(plate, porcelain, side * 3.81, 0.835, z);
      place(cup, cupWall, side * 3.05, 0.875, z + 0.18, (i % 3 - 1) * 0.14, 0, 0.04);
      box(0.25, 0.006, 0.16, paper, side * 3.94, 0.824, z - 0.24);
    }
  }

  // Maintenance bench, drawer pulls, instrument rack and replacement springs.
  fixture(-12.6, 3.24, -18.18, 1.64);
  box(3.78, 0.59, 0.17, rubber, -13.2, 1.68, -20.10);
  box(3.72, 0.045, 0.13, steel, -13.2, 1.96, -20.00);
  const toolShaft = new THREE.CylinderGeometry(0.022, 0.022, 0.33, 8);
  const springRing = new THREE.TorusGeometry(0.088, 0.011, 6, 16);
  for (let i = 0; i < 9; i++) {
    const x = -14.73 + i * 0.36;
    box(0.060, 0.056, 0.075, brass, x, 1.83, -19.99);
    place(toolShaft, i % 2 ? hazard : steel, x, 1.63, -19.97, 0.05, 0, 0.09 * (i % 3 - 1));
  }
  for (let i = 0; i < 5; i++) {
    place(springRing, steel, -11.73, 1.01, -19.67 + i * 0.031, 0, 0.17, 0);
  }
  for (const y of [0.22, 0.46, 0.70]) {
    box(0.84, 0.21, 0.45, enamel, -14.37, y, -19.63);
    box(0.33, 0.038, 0.050, steel, -14.37, y + 0.026, -19.37);
  }
  box(0.31, 0.085, 0.55, paper, -12.8, 0.98, -19.47);
  box(0.07, 2.6, 0.08, wire, -15.73, 1.35, -18.04);

  // Kitchen hood, tile joints, appliance controls and stacked stock crates.
  fixture(12.1, 3.22, -17.54, 1.99, true);
  box(2.69, 0.38, 0.92, steel, 14.44, 2.57, -19.77);
  box(2.53, 0.055, 0.63, rubber, 14.44, 2.36, -19.73);
  for (let i = 0; i < 9; i++) {
    box(0.035, 0.028, 0.52, metal, 13.36 + i * 0.27, 2.32, -19.71);
  }
  box(2.02, 0.91, 0.92, enamel, 14.62, 0.45, -17.35);
  box(1.93, 0.04, 0.88, rubber, 14.62, 0.925, -17.35);
  const knob = new THREE.CylinderGeometry(0.050, 0.050, 0.055, 10);
  for (let i = 0; i < 5; i++) {
    place(knob, rubber, 13.90 + i * 0.36, 0.77, -16.863, Math.PI / 2);
  }
  box(0.06, 0.034, 0.03, indicator, 15.48, 0.76, -16.85);
  for (let i = 0; i < 3; i++) {
    const y = 0.19 + 0.35 * i;
    box(0.78, 0.31, 0.64, paper, 15.34 - 0.018 * i, y, -20.32);
    box(0.12, 0.31, 0.01, hazard, 15.28, y, -19.994);
  }

  // Separate service corridors: emergency markers, kick rails and cable trays.
  for (const side of [-1, 1]) {
    for (const z of [-9.16, -5.50]) fixture(side * 4.15, 3.28, z, 1.06, true);
    box(0.075, 0.11, 10.9, paint, side * 5.30, 0.32, -6.34);
    box(0.09, 0.052, 10.9, steel, side * 5.27, 0.38, -6.34);
    box(0.13, 0.37, 0.40, metal, side * 5.26, 2.23, -5.9);
    box(0.026, 0.077, 0.15, side < 0 ? indicator : greenMarker, side * 5.178, 2.295, -5.9);
    box(0.36, 0.16, 0.062, rubber, side * 4.17, 2.49, -1.18);
    box(0.29, 0.060, 0.065, side < 0 ? indicator : greenMarker, side * 4.17, 2.49, -1.21);
    for (let i = 0; i < 7; i++) {
      place(new THREE.BoxGeometry(0.18, 0.005, 0.055), hazard, side * 4.15 - 0.58 + i * 0.19, 0.007, -2.65, 0, 0.59);
    }
  }

  // Duct flanges, fasteners, conduit and the fan bellmouth.
  const washer = new THREE.CylinderGeometry(0.022, 0.022, 0.019, 6);
  for (const z of [-4.54, -6.54, -8.54, -10.54]) {
    for (const side of [-1, 1]) {
      box(0.068, 1.20, 0.095, duct, 11 + side * 0.809, 5.06, z);
      for (const y of [4.57, 4.86, 5.16, 5.45]) {
        place(washer, steel, 11 + side * 0.771, y, z, 0, 0, Math.PI / 2);
      }
    }
  }
  place(new THREE.TorusGeometry(0.56, 0.044, 8, 24), steel, 11, 5.08, -11.04);
  place(new THREE.TorusGeometry(0.62, 0.020, 6, 24), rubber, 11, 5.08, -11.09);
  box(0.042, 0.048, 6.81, wire, 11.66, 5.56, -7.51);
  box(0.135, 0.15, 0.17, metal, 11.70, 5.45, -4.90);
  box(0.023, 0.042, 0.048, indicator, 11.628, 5.44, -4.89);
}
