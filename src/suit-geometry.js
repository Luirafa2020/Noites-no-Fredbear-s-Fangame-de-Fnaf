import * as THREE from 'three';

function signedPower(value, power) {
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

// Each section describes the height, half-width, half-depth and forward offset.
export function loftShell(sections, {
  sides = 32, rows = 24, roundness = 1, deform
} = {}) {
  const profile = new THREE.CatmullRomCurve3(sections.map(([y, width, depth]) =>
    new THREE.Vector3(width, y, depth)), false, 'catmullrom', 0.35);
  const offset = new THREE.CatmullRomCurve3(sections.map(([y, , , z = 0]) =>
    new THREE.Vector3(0, y, z)), false, 'catmullrom', 0.35);
  const geometry = new THREE.SphereGeometry(1, sides, rows);
  const { position, uv } = geometry.attributes;
  const section = new THREE.Vector3();
  const center = new THREE.Vector3();
  const point = new THREE.Vector3();

  for (let row = 0; row <= rows; row++) {
    const t = 1 - row / rows;
    profile.getPoint(t, section);
    offset.getPoint(t, center);
    for (let col = 0; col <= sides; col++) {
      const i = row * (sides + 1) + col;
      const angle = -col / sides * Math.PI * 2 + Math.PI;
      point.set(
        signedPower(Math.cos(angle), roundness) * Math.max(0, section.x),
        section.y,
        signedPower(Math.sin(angle), roundness) * Math.max(0, section.z) + center.z
      );
      if (deform) deform(point);
      position.setXYZ(i, point.x, point.y, point.z);
      uv.setY(i, (section.y - sections[0][0]) / (sections.at(-1)[0] - sections[0][0]));
    }
  }
  geometry.computeVertexNormals();
  // The duplicated vertices at the texture seam represent the same surface.
  const normals = geometry.attributes.normal;
  for (let row = 1; row < rows; row++) {
    const first = row * (sides + 1);
    const last = first + sides;
    point.fromBufferAttribute(normals, first).add(center.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, point.x, point.y, point.z);
    normals.setXYZ(last, point.x, point.y, point.z);
  }
  return geometry;
}

export function paddedShell(width, depth, height, { top = 0.95, bottom = 0.88, bow = 0, deform } = {}) {
  const h = height * 0.5;
  return loftShell([
    [-h, 0, 0, bow * -0.35],
    [-h * 0.92, width * bottom * 0.54, depth * bottom * 0.58, bow * -0.25],
    [-h * 0.74, width * bottom * 0.91, depth * bottom * 0.92],
    [-h * 0.28, width * 0.98, depth * 0.98, bow * 0.65],
    [h * 0.21, width, depth, bow],
    [h * 0.68, width * top, depth * top, bow * 0.59],
    [h * 0.88, width * top * 0.76, depth * top * 0.74],
    [h, 0, 0, bow * -0.21]
  ], { sides: 22, rows: 19, roundness: 0.87, deform });
}
