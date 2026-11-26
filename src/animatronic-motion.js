import * as THREE from 'three';

const { clamp, lerp, smoothstep, smootherstep } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const TAU = Math.PI * 2;
const states = new WeakMap();
const MICROPHONE_GRIP = [
  [0.18, 0.86, 0.89],
  [0.44, 0.97, 0.79],
  [0.33, 0.87, 0.90],
  [0.02, 0.47, 1.13]
];

function getState(rig) {
  if (!states.has(rig)) {
    states.set(rig, {
      pose: null, entered: 0,
      feet: [new THREE.Vector3(), new THREE.Vector3()],
      target: new THREE.Vector3(), pole: new THREE.Vector3(),
      local: new THREE.Vector3(), reach: new THREE.Vector3(), bend: new THREE.Vector3(),
      first: new THREE.Vector3(), second: new THREE.Vector3(), axis: new THREE.Vector3(),
      rotation: new THREE.Quaternion(), reference: new THREE.Quaternion(), euler: new THREE.Euler()
    });
  }
  return states.get(rig);
}

export function trackAnimatronicPose(rig, pose, time) {
  const state = getState(rig);
  if (state.pose !== pose) {
    state.pose = pose;
    state.entered = time;
  }
}

function pulse(time, start, peak, end) {
  return smoothstep(time, start, peak) * (1 - smoothstep(time, peak, end));
}

function servo(time, period, rest = 0.16) {
  const phase = (time % period) / period;
  return smoothstep(phase, rest, 0.46) * (1 - smoothstep(phase, 0.60, 0.91));
}

// Solve the elbow or knee in parent space. The pole keeps the hinge bending
// in the direction the pose calls for, including when a wrist is on a surface.
function solveLimb(upper, lower, tip, targetWorld, poleWorld, state) {
  const { local, reach, bend, first, second, axis, rotation } = state;
  upper.parent.worldToLocal(local.copy(targetWorld));
  reach.copy(local).sub(upper.position);
  const a = lower.position.length();
  const b = tip.position.length();
  const distance = clamp(reach.length(), Math.abs(a - b) + 0.002, a + b - 0.002);
  reach.normalize();
  if (reach.lengthSq() < 0.5) reach.copy(DOWN);

  upper.parent.getWorldQuaternion(rotation).invert();
  bend.copy(poleWorld).applyQuaternion(rotation);
  bend.addScaledVector(reach, -bend.dot(reach));
  if (bend.lengthSq() < 0.00001) {
    bend.set(-reach.z, 0, reach.x);
    if (bend.lengthSq() < 0.00001) bend.set(1, 0, 0);
  }
  bend.normalize();

  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  first.copy(reach).multiplyScalar(along).addScaledVector(bend, height);
  second.copy(reach).multiplyScalar(distance).sub(first);

  upper.quaternion.setFromUnitVectors(axis.copy(lower.position).normalize(), first.normalize());
  rotation.copy(upper.quaternion).invert();
  lower.quaternion.setFromUnitVectors(axis.copy(tip.position).normalize(), second.applyQuaternion(rotation).normalize());
}

function orientTip(tip, root, state, pitch, yaw, roll = 0) {
  const { euler, reference, rotation } = state;
  root.getWorldQuaternion(reference);
  reference.multiply(rotation.setFromEuler(euler.set(pitch, yaw, roll, 'YXZ')));
  tip.parent.getWorldQuaternion(rotation).invert();
  tip.quaternion.copy(rotation).multiply(reference);
}

function plantFoot(rig, leg, position, state, yaw, crouched = false) {
  rig.root.localToWorld(state.target.copy(position));
  const side = leg === rig.legL ? -1 : 1;
  state.pole.set(crouched ? side * 0.91 : 0, crouched ? -0.23 : 0, crouched ? 0.18 : 1);
  rig.root.getWorldQuaternion(state.reference);
  state.pole.applyQuaternion(state.reference);
  solveLimb(leg.hip, leg.knee, leg.foot, state.target, state.pole, state);
  orientTip(leg.foot, rig.root, state, 0, yaw);
}

function placeHand(rig, arm, state, x, y, z, pitch, yaw, roll, world = false) {
  state.target.set(x, y, z);
  if (!world) rig.root.localToWorld(state.target);
  rig.root.getWorldQuaternion(state.reference);
  state.pole.set(arm.side * 0.9, world ? -0.33 : 0.40, -0.45).applyQuaternion(state.reference);
  solveLimb(arm.shoulder, arm.elbow, arm.hand, state.target, state.pole, state);
  orientTip(arm.hand, rig.root, state, pitch, yaw, roll);
}

function resetJoints(rig) {
  rig.pelvis.position.set(0, 1.096, 0);
  rig.pelvis.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.neck.rotation.set(0, 0, 0, 'YXZ');
  rig.head.rotation.set(0, 0, 0, 'YXZ');
  rig.jaw.rotation.set(0.13, 0, 0);
  for (const arm of [rig.armL, rig.armR]) {
    const side = arm.side;
    arm.shoulder.rotation.set(-0.045, side * -0.05, side * 0.072);
    arm.elbow.rotation.set(-0.26, side * 0.065, side * -0.04);
    arm.hand.rotation.set(0.075, side * 0.09, side * -0.08);
  }
  for (const leg of [rig.legL, rig.legR]) {
    leg.hip.rotation.set(0, 0, 0);
    leg.knee.rotation.set(0, 0, 0);
    leg.foot.rotation.set(0, 0, 0);
  }
}

function updateJawActuators(rig, state) {
  const { axis } = state;
  for (const { barrel, piston, anchor } of rig.jawActuators) {
    piston.position.copy(anchor).applyQuaternion(rig.jaw.quaternion).add(rig.jaw.position);
    axis.subVectors(piston.position, barrel.position).normalize();
    barrel.quaternion.setFromUnitVectors(DOWN, axis);
    piston.quaternion.setFromUnitVectors(UP, axis.negate());
  }
}

function animateHand(arm, time, curl, spread, gripping) {
  const side = arm.side;
  for (const { finger, seg2, seg3, spread: splay, index } of arm.fingers) {
    if (gripping) {
      const [base, middle, tip] = MICROPHONE_GRIP[index];
      finger.rotation.set(base, 0, splay * 0.13, 'ZXY');
      seg2.rotation.x = middle;
      seg3.rotation.x = tip;
      continue;
    }
    const tension = clamp(curl + (index - 1.3) * 0.058, 0.01, 1);
    const lag = 0.033 * Math.sin(time * 4.3 - index * 0.59 + side * 0.34);
    finger.rotation.set(-0.035 + tension * 0.86 + lag, 0, splay * spread * (1 - tension * 0.39), 'ZXY');
    seg2.rotation.x = 0.06 + tension * 1.03 + lag;
    seg3.rotation.x = 0.025 + tension * 0.71;
  }
  if (gripping) {
    arm.thumb.rotation.set(0.56, -0.10, 0.60, 'ZXY');
    arm.thumbTip.rotation.x = 0.58;
  } else {
    arm.thumb.rotation.set(0.23 + curl * 0.59, side * (0.16 - curl * 0.28),
      side * lerp(-0.54, 0.56, curl), 'ZXY');
    arm.thumbTip.rotation.x = 0.10 + curl * 0.58;
  }
}

function animateFingers(rig, time, curlL, curlR, spread, gripping = false) {
  animateHand(rig.armL, time, curlL, spread, false);
  animateHand(rig.armR, time, curlR, spread, gripping);
}

function animateEars(rig, follow, twitch, fold = 0, impact = 0) {
  if (rig.type === 'freddy') {
    rig.earL.rotation.set(follow * 0.085 - impact * 0.13, 0.03, 0.35 + twitch * 0.08);
    rig.earR.rotation.set(-follow * 0.064 - impact * 0.11, -0.025, -0.37 + twitch * 0.12);
    return;
  }
  rig.earL.rotation.set(-fold * 1.08 + follow * 0.16 - impact * 0.32, 0.08 + follow * 0.05, 0.11 - fold * 0.12);
  rig.earR.rotation.set(-fold * 0.88 - follow * 0.10 - impact * 0.43, -0.07, -0.34 + fold * 0.092);
  rig.earTipL.rotation.set(0.19 - fold * 0.51 - follow * 0.26 + impact * 0.28, 0.025, 0.15 + follow * 0.08);
  rig.earTipR.rotation.set(0.31 - fold * 0.49 + follow * 0.31 + impact * 0.44, 0.08, -0.60 + twitch * 0.6);
}

function animateEyes(rig, time, pitch, yaw, lid, lowerLid, twitch, dark, blinking = true) {
  const isFreddy = rig.type === 'freddy';
  const cycle = (time + (isFreddy ? 1.8 : 4.6)) % (isFreddy ? 8.6 : 11.4);
  const blink = blinking ? pulse(cycle, 0.03, 0.12, 0.31) * 0.95 : 0;
  rig.pupilMat.emissiveIntensity = dark ? 5.8 : 0;
  for (const eye of rig.eyes) {
    const faulty = !isFreddy && eye.idx === 1;
    const offset = eye.idx === 0 ? -0.026 : 0.026;
    eye.eyeball.visible = !dark;
    eye.eyeVoid.visible = dark;
    eye.pupil.visible = dark;
    eye.eyeball.rotation.set(pitch + (faulty ? twitch * 0.26 : 0), yaw + offset, 0);
    eye.pupil.position.set((yaw + offset) * 0.044, -pitch * 0.038, 0.052);
    eye.lidPivot.rotation.x = lid + blink * (faulty ? 0.68 : 1) + (faulty ? 0.042 + twitch * 0.36 : 0);
    eye.lowerLidPivot.rotation.x = lowerLid - 0.12 * blink;
  }
}

export function applyAnimatronicPose(rig, pose, time, twitchValue = 0, darkEyes = false, lookPoint = null) {
  trackAnimatronicPose(rig, pose, time);
  const state = getState(rig);
  const age = time - state.entered;
  const freddy = rig.type === 'freddy';
  const hasMicrophone = freddy && pose === 'STAGE';
  if (rig.microphone) rig.microphone.visible = hasMicrophone;
  const shaft = pose === 'VENT_CRAWL' || pose === 'VENT_PEEK';
  const phase = time + (freddy ? 0 : 2.73);
  const step = servo(phase, freddy ? 5.7 : 4.9);
  const settle = 1 - smoothstep(age, 0.01, 0.62);
  const weigh = 0.5 * Math.sin(phase * 0.86) + 0.5 * (step * 2 - 1);
  const twitch = twitchValue * (0.12 * Math.sin(phase * 31) + 0.045 * Math.sin(phase * 64));
  const recoil = Math.sin(age * 15) * settle * 0.033;
  resetJoints(rig);
  rig.contactShadow.visible = !shaft;
  rig.contactShadow.position.y = pose === 'STAGE' ? 0.028 : 0.005;
  const leftFoot = state.feet[0].set(-0.184, 0.104, 0.105);
  const rightFoot = state.feet[1].set(0.198, 0.104, -0.096);
  let lid = 0.16;
  let lowerLid = -0.07;
  let curlL = 0.33;
  let curlR = 0.35;
  let attention = 0.24 + step * 0.17;
  let earFold = 0;

  rig.pelvis.position.x = weigh * 0.029;
  rig.pelvis.position.y -= 0.012 * Math.abs(weigh);
  rig.torso.rotation.set(0.075 + weigh * 0.021, weigh * 0.041, -weigh * 0.065);
  rig.head.rotation.set(-0.051 + recoil + twitch, weigh * 0.078, weigh * 0.037 + twitch * 0.39);
  rig.jaw.rotation.x = 0.105 + 0.037 * step + twitch * 0.13;

  switch (pose) {
    case 'STAGE':
      rig.pelvis.position.y += 0.021;
      rig.pelvis.position.x += freddy ? 0.055 : -0.047;
      rig.torso.rotation.x = 0.015 + weigh * 0.026;
      rig.head.rotation.y += freddy ? 0.15 - step * 0.28 : -0.16 + step * 0.32;
      rig.jaw.rotation.x += servo(phase + 0.43, freddy ? 6.9 : 7.7, 0.29) * (freddy ? 0.12 : 0.085);
      if (freddy) {
        rig.armL.shoulder.rotation.x = -0.092 - step * 0.12;
        rig.armL.elbow.rotation.x = -0.32 - step * 0.15;
        placeHand(rig, rig.armR, state, 0.365 - step * 0.055, 1.59 + step * 0.15,
          0.438 + step * 0.070, -0.17 - step * 0.09, -0.24, -1.25 + step * 0.14);
      } else {
        rig.armL.shoulder.rotation.set(-0.42 - step * 0.28, -0.16, -0.19);
        rig.armL.elbow.rotation.set(-0.68 - step * 0.18, 0.08, 0.13);
        rig.armL.hand.rotation.set(-0.24, -0.28, 0.12);
        rig.armR.shoulder.rotation.x = 0.10 + step * 0.10;
        lid = 0.24;
        curlL = 0.22 + step * 0.09;
      }
      break;
    case 'DINING':
      rig.pelvis.position.set(freddy ? -0.043 : 0.058, 1.040 - 0.014 * step, freddy ? -0.045 : 0.062);
      rig.torso.rotation.set(freddy ? 0.155 : 0.24, freddy ? -0.12 : 0.20, freddy ? 0.067 : -0.10);
      leftFoot.set(-0.22, 0.104, freddy ? 0.28 : -0.24);
      rightFoot.set(0.23, 0.104, freddy ? -0.21 : 0.30);
      rig.armL.shoulder.rotation.x = freddy ? -0.22 : 0.23;
      rig.armR.shoulder.rotation.x = freddy ? 0.14 : -0.41;
      rig.armR.elbow.rotation.x = freddy ? -0.34 : -0.57;
      rig.head.rotation.z += freddy ? 0.072 : -0.151;
      rig.head.rotation.y += freddy ? step * 0.14 : -0.17;
      rig.jaw.rotation.x += 0.068 * step;
      attention = 0.12 + pulse(age % 7, 1.0, 1.95, 5.3) * 0.73;
      break;
    case 'WORKBENCH':
    case 'KITCHEN': {
      const bench = pose === 'WORKBENCH';
      rig.pelvis.position.set(bench ? -0.07 : 0.065, (bench ? 0.826 : 0.754) - 0.026 * step, bench ? -0.142 : -0.190);
      rig.pelvis.rotation.y = bench ? -0.06 : 0.46;
      rig.torso.rotation.set((bench ? 0.045 : 0.15) + 0.051 * step, bench ? 0.14 : -0.19, bench ? 0.13 : -0.15);
      rig.head.rotation.set(0.21 - step * 0.29 + twitch, bench ? 0.12 : -0.08, bench ? 0.10 : -0.16, 'YXZ');
      leftFoot.set(-0.208, 0.104, bench ? -0.09 : 0.27);
      rightFoot.set(0.214, 0.104, bench ? 0.22 : -0.14);
      if (bench) {
        placeHand(rig, rig.armL, state, -13.13, 0.972, -19.23, -1.51, 2.68, 0.13, true);
        rig.armR.shoulder.rotation.set(-0.11, -0.12, 0.13);
        rig.armR.elbow.rotation.x = -0.28 - step * 0.15;
        curlL = 0.19;
      } else {
        placeHand(rig, rig.armR, state, 13.18, 0.943, -19.03, -1.55, -2.62, -0.13, true);
        rig.armL.shoulder.rotation.set(-0.44 - step * 0.19, 0.15, -0.12);
        rig.armL.elbow.rotation.x = -0.73 + step * 0.31;
        curlR = 0.20;
      }
      attention = 0.35 + step * 0.48;
      lid = 0.23 - step * 0.22;
      rig.jaw.rotation.x += 0.094 + twitch * 0.20;
      break;
    }
    case 'WEST_HALL':
    case 'EAST_HALL':
      leftFoot.set(-0.211, 0.104, freddy ? -0.28 : 0.20);
      rightFoot.set(0.217, 0.104, freddy ? 0.245 : -0.29);
      rig.pelvis.position.set((freddy ? 0.045 : -0.05) + weigh * 0.017,
        (freddy ? 1.027 : 0.991) - 0.021 * step, (freddy ? 0.08 : 0.04) + step * 0.028);
      rig.pelvis.rotation.y = freddy ? -0.13 : 0.16;
      rig.torso.rotation.set(freddy ? 0.18 : 0.25, freddy ? -0.19 : 0.25, freddy ? -0.10 : 0.14);
      rig.head.rotation.z += freddy ? -0.135 : 0.18;
      rig.armL.shoulder.rotation.x = freddy ? 0.16 : -0.44;
      rig.armR.shoulder.rotation.x = freddy ? -0.34 : 0.17;
      rig.armL.elbow.rotation.x = freddy ? -0.25 : -0.55;
      rig.armR.elbow.rotation.x = freddy ? -0.48 : -0.32;
      attention = 0.37 + 0.54 * smoothstep(age, 0.18, 0.86) + 0.05 * step;
      lid = 0.10;
      curlL += 0.15;
      curlR += 0.11;
      break;
    case 'BLINDSPOT':
    case 'POWEROUT':
      rig.pelvis.position.y = 1.015;
      rig.torso.rotation.set(0.265, freddy ? 0.09 : -0.12, freddy ? 0.05 : -0.09);
      rig.head.rotation.set(-0.10 + twitch, weigh * 0.09, (freddy ? -0.09 : 0.16) + twitch, 'YXZ');
      rig.armL.shoulder.rotation.x = freddy ? -0.30 : -0.62;
      rig.armR.shoulder.rotation.x = freddy ? -0.57 : -0.19;
      rig.armR.elbow.rotation.x = -0.48;
      rig.jaw.rotation.x = 0.23 + step * 0.14;
      curlL = 0.44;
      curlR = 0.55;
      attention = 0.77;
      lid = 0.0;
      break;
    case 'VENT_CRAWL':
    case 'VENT_PEEK': {
      const peeking = pose === 'VENT_PEEK';
      const crawl = phase * (peeking ? 1.54 : 2.84);
      const drag = Math.sin(crawl);
      const floor = peeking ? 0.01 : 0;
      const amplitude = peeking ? 0.035 : 0.145;
      rig.pelvis.position.set(drag * 0.030, (peeking ? 0.255 : 0.34) + Math.cos(crawl * 2) * 0.017,
        -0.044 + drag * 0.029);
      rig.pelvis.rotation.set(1.31, drag * 0.044, drag * -0.055);
      rig.torso.rotation.set(0.17, -drag * 0.075, drag * 0.05);
      rig.neck.rotation.x = peeking ? -1.16 : -1.24;
      rig.head.rotation.set(-0.09 + twitch + (peeking ? 0.17 : 0.04) * step, drag * 0.065, drag * 0.085, 'YXZ');
      placeHand(rig, rig.armL, state, -0.292, floor + 0.058 + Math.max(0, drag) * amplitude * 0.37,
        0.87 + Math.cos(crawl) * amplitude, -1.43, -0.14, 0.07);
      placeHand(rig, rig.armR, state, 0.294, floor + 0.058 + Math.max(0, -drag) * amplitude * 0.37,
        0.95 - Math.cos(crawl) * amplitude, -1.49, 0.14, -0.10);
      leftFoot.set(-0.255, 0.107, -0.68 - drag * amplitude * 0.48);
      rightFoot.set(0.229, 0.107, -0.74 + drag * amplitude * 0.48);
      rig.jaw.rotation.x = 0.23 + 0.13 * step + twitch * 0.2;
      earFold = peeking ? 1.49 : 0.91;
      attention = 0.19 + step * 0.18;
      curlL = 0.15 + 0.23 * Math.max(0, drag);
      curlR = 0.15 + 0.25 * Math.max(0, -drag);
      lid = 0.05;
      lowerLid = -0.02;
      break;
    }
  }

  plantFoot(rig, rig.legL, leftFoot, state, shaft ? -0.32 : -0.13, shaft);
  plantFoot(rig, rig.legR, rightFoot, state, shaft ? 0.33 : 0.17, shaft);

  let glanceYaw = (step - 0.5) * (freddy ? 0.15 : -0.19);
  let glancePitch = 0.017 + weigh * 0.035;
  if (lookPoint) {
    const target = rig.torso.worldToLocal(state.local.copy(lookPoint)).sub(rig.neck.position);
    const yaw = clamp(Math.atan2(target.x, target.z), -1.22, 1.22) * attention;
    const pitch = clamp(Math.atan2(target.y - 0.27, Math.hypot(target.x, target.z)), -0.48, 0.48) * attention;
    if (!shaft) {
      rig.neck.rotation.y += yaw * 0.45;
      rig.head.rotation.y += yaw * 0.50;
      rig.head.rotation.x -= pitch * 0.64;
    }
    glanceYaw += yaw * 0.26;
    glancePitch -= pitch * 0.41;
  }
  animateEyes(rig, phase, glancePitch, glanceYaw, lid, lowerLid, twitch, darkEyes);
  animateFingers(rig, phase, curlL, curlR, shaft ? 1.37 : 1.0, hasMicrophone);
  animateEars(rig, weigh - recoil * 6, twitch, earFold);
  updateJawActuators(rig, state);
}

export const BITE_PROGRESS = 0.64;

export function applyAttackPose(rig, p, fromVent) {
  resetJoints(rig);
  if (rig.microphone) rig.microphone.visible = false;
  const state = getState(rig);
  const freddy = rig.type === 'freddy';
  const effort = smootherstep(p, 0.025, 0.22);
  const gather = pulse(p, 0.31, 0.41, 0.51);
  const reach = smootherstep(p, freddy ? 0.18 : 0.12, freddy ? 0.52 : 0.44);
  const opening = smootherstep(p, 0.26, 0.552);
  const close = smoothstep(p, BITE_PROGRESS - 0.032, BITE_PROGRESS);
  const strike = pulse(p, BITE_PROGRESS - 0.035, BITE_PROGRESS + 0.009, 0.78);
  const takeoff = pulse(p, 0.17, 0.32, 0.52);
  const runPhase = p * TAU * (freddy ? 3.95 : 4.6);
  const run = (1 - smoothstep(p, 0.36, 0.53)) * effort;
  const swing = Math.sin(runPhase) * run;
  const after = Math.max(0, p - BITE_PROGRESS);
  const kick = Math.sin(after * 91) * Math.exp(-after * 18);
  const tuck = fromVent ? 1 - smootherstep(p, 0.02, 0.38) : 0;

  rig.contactShadow.visible = false;
  rig.pelvis.position.y = 1.099 - 0.12 * gather + takeoff * (freddy ? 0.055 : 0.11);
  rig.pelvis.rotation.set(tuck * 0.92 + 0.088 * swing, swing * 0.13, swing * 0.078);
  rig.torso.rotation.set(0.19 + reach * 0.36 + 0.25 * gather + strike * 0.18,
    -swing * 0.20 + (freddy ? 0.08 : -0.16) * reach,
    -swing * 0.09 + (freddy ? 0.026 : -0.11) * reach);
  rig.neck.rotation.x = -rig.torso.rotation.x * 0.69 - tuck * 0.77;
  rig.head.rotation.set(-0.08 - opening * 0.17 + close * 0.23 + kick * 0.10,
    swing * 0.12 - kick * 0.07,
    (freddy ? 0.025 : -0.19) * reach + strike * (freddy ? 0.095 : 0.17) + kick * 0.11, 'YXZ');
  rig.jaw.rotation.x = lerp(0.17 + 0.044 * Math.abs(swing), freddy ? 1.24 : 1.38, opening) * (1 - close)
    + close * (0.045 + pulse(p, 0.682, 0.733, 0.833) * (freddy ? 0.34 : 0.52));
  rig.jaw.rotation.z = (freddy ? 0.022 : -0.045) * opening * (1 - close) + kick * 0.028;

  for (const arm of [rig.armL, rig.armR]) {
    const side = arm.side;
    const late = arm === rig.armR && !freddy ? smootherstep(p, 0.23, 0.56) : reach;
    const grab = smoothstep(p, BITE_PROGRESS - 0.11, BITE_PROGRESS);
    arm.shoulder.rotation.set(lerp(-0.23 + swing * side * 0.64 - tuck * 1.06, -1.93 + side * 0.12, late) + strike * 0.20,
      side * (0.04 - late * 0.21), side * lerp(0.16, 0.55 - grab * 0.27, late));
    arm.elbow.rotation.set(lerp(-0.70 + side * swing * 0.17, -0.30 - grab * 0.28, late), side * 0.17 * late, side * -0.10);
    arm.hand.rotation.set(-0.30 * late + strike * 0.13, side * -0.34 * late, side * -0.17 * late);
  }

  const lStride = runPhase;
  const rStride = runPhase + Math.PI;
  const tuckLegs = smoothstep(p, 0.37, 0.61) * (freddy ? 0.40 : 0.62);
  rig.legL.hip.rotation.set(Math.cos(lStride) * run * -0.61 - tuckLegs, 0, 0.055);
  rig.legR.hip.rotation.set(Math.cos(rStride) * run * -0.61 - tuckLegs * 0.74, 0, -0.045);
  rig.legL.knee.rotation.x = Math.max(0, Math.sin(lStride)) * run * 0.89 + tuckLegs + tuck * 0.31;
  rig.legR.knee.rotation.x = Math.max(0, Math.sin(rStride)) * run * 0.89 + tuckLegs * 0.72 + tuck * 0.25;
  rig.legL.foot.rotation.x = 0.22 * swing - tuckLegs * 0.37;
  rig.legR.foot.rotation.x = -0.22 * swing - tuckLegs * 0.37;

  const clench = smoothstep(p, BITE_PROGRESS - 0.105, BITE_PROGRESS + 0.017);
  animateFingers(rig, p * 3, lerp(0.33, 0.10, reach) + clench * 0.73,
    lerp(0.44, 0.14, reach) + clench * 0.67, lerp(1.65, 0.60, clench));
  animateEyes(rig, p, 0.025 - opening * 0.10, -swing * 0.11, 0.03 - reach * 0.42 + strike * 0.44,
    0.07 + strike * 0.11, kick * 0.08, p >= 0.20, false);
  animateEars(rig, swing - takeoff * 0.51 + kick * 0.48, kick * 0.15, tuck * 0.91, strike);
  updateJawActuators(rig, state);
}

export function plantAttackFeet(rig, progress, fromVent) {
  const floorContact = fromVent ? smoothstep(progress, 0.31, 0.49) : 1;
  if (floorContact === 0) return;
  const state = getState(rig);
  const rate = rig.type === 'freddy' ? 3.95 : 4.6;
  const run = smoothstep(progress, 0.02, 0.12) * (1 - smoothstep(progress, 0.36, 0.54));
  const landing = smoothstep(progress, 0.35, 0.64);

  for (const leg of [rig.legL, rig.legR]) {
    const side = leg === rig.legL ? -1 : 1;
    const phase = (progress * rate + (side > 0 ? 0.55 : 0.05)) % 1;
    const swing = clamp((phase - 0.59) / 0.41, 0, 1);
    const stride = phase < 0.59 ? lerp(0.31, -0.31, phase / 0.59) : lerp(-0.31, 0.31, swing);
    const lift = Math.sin(swing * Math.PI) * run * 0.20;
    const foot = state.feet[side < 0 ? 0 : 1];
    foot.set(side * (0.19 + 0.07 * landing), 0.104 - rig.root.position.y + lift,
      stride * run + (side > 0 ? 0.24 : -0.27) * landing);
    if (floorContact < 1) {
      rig.root.worldToLocal(leg.foot.getWorldPosition(state.local));
      foot.lerp(state.local, 1 - floorContact);
    }
    plantFoot(rig, leg, foot, state, side * (0.13 + 0.13 * landing));
    leg.foot.rotateX(lift * 0.9);
  }
}
