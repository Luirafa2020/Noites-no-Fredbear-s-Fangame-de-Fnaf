import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function renderKey(mesh) {
  return [mesh.material.id, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask].join('/');
}

function copyRenderState(source, target) {
  target.castShadow = source.castShadow;
  target.receiveShadow = source.receiveShadow;
  target.renderOrder = source.renderOrder;
  target.layers.mask = source.layers.mask;
}

// Static scenery is grouped in local cells so the camera can still cull rooms.
export function batchMeshes(parent, canBatch, region = () => '') {
  const batches = new Map();
  for (const mesh of parent.children) {
    if (!mesh.isMesh || !mesh.visible || mesh.children.length || !canBatch(mesh) ||
        mesh.material.transparent || Array.isArray(mesh.material)) continue;

    const key = renderKey(mesh) + '/' + region(mesh);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  }

  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => {
      if (mesh.matrixAutoUpdate) mesh.updateMatrix();
      const geometry = mesh.geometry.clone();
      if (!geometry.index) {
        geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
      }
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(parts);
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const first = meshes[0];
    const batch = new THREE.Mesh(geometry, first.material);
    copyRenderState(first, batch);
    batch.matrixAutoUpdate = false;
    parent.remove(...meshes);
    parent.add(batch);
  }
}

// Each rigid part follows one joint. The GPU applies the joint transforms to
// material batches, so loose hardware does not need its own draw call.
export function skinRigidParts(root, canSkin) {
  const joints = new Map();
  const batches = new Map();
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.children.length || !canSkin(mesh)) return;
    const parent = mesh.parent;
    if (!joints.has(parent)) joints.set(parent, joints.size);
    const boneIndex = joints.get(parent);
    const part = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const count = part.attributes.position.count;
    if (!part.index) part.setIndex(Array.from({ length: count }, (_, i) => i));
    const indices = new Uint16Array(count * 4);
    const weights = new Uint8Array(count * 4);
    for (let i = 0; i < count * 4; i += 4) {
      indices[i] = boneIndex;
      weights[i] = 255;
    }
    part.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
    part.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4, true));
    const key = renderKey(mesh);
    if (!batches.has(key)) batches.set(key, { parts: [], originals: [] });
    const batch = batches.get(key);
    batch.parts.push(part);
    batch.originals.push(mesh);
  });

  const skeleton = new THREE.Skeleton([...joints.keys()]);
  const bindPose = new THREE.Matrix4();
  for (const { parts, originals } of batches.values()) {
    const geometry = mergeGeometries(parts);
    if (!geometry) continue;
    const first = originals[0];
    const mesh = new THREE.SkinnedMesh(geometry, first.material);
    copyRenderState(first, mesh);
    // Camera/room visibility is determined at the rig root. A bind-pose
    // bounding sphere could clip a crawling or lunging character.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.bind(skeleton, bindPose);
    root.add(mesh);
    for (const original of originals) original.removeFromParent();
  }
}
