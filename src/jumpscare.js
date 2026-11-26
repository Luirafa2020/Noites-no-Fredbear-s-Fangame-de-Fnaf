import * as THREE from 'three';
import { applyAttackPose, plantAttackFeet, BITE_PROGRESS } from './animatronic-motion.js';

const { clamp, lerp, smootherstep, smoothstep } = THREE.MathUtils;
const up = new THREE.Vector3(0, 1, 0);

function doorPath(side) {
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(side * 2.57, 2.11, -0.12),
    new THREE.Vector3(side * 1.91, 2.03, -0.11),
    new THREE.Vector3(side * 0.69, 1.61, 0.21),
    new THREE.Vector3(side * 0.11, 1.65, 0.49)
  );
}

const paths = {
  DOOR_L: doorPath(-1),
  DOOR_R: doorPath(1),
  VENT: new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.045, 2.53, -2.42),
    new THREE.Vector3(-0.32, 2.47, -1.44),
    new THREE.Vector3(0.30, 1.63, -0.44),
    new THREE.Vector3(0.10, 1.65, 0.49)
  )
};

export function createJumpscareSequence(camera, world) {
  const eye = camera.position.clone();
  const mouth = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const gaze = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const initialLook = new THREE.Quaternion();
  const attackLook = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function update(game) {
    const progress = clamp(game.jumpscareElapsed / game.jumpscareDuration, 0, 1);
    const fromVent = game.jumpscareOrigin === 'VENT';
    const side = game.jumpscareOrigin === 'DOOR_L' ? -1 : 1;
    const attacker = game.jumpscareWho === 'bonnie' ? world.bonnieRig : world.freddyRig;
    const freddy = attacker.type === 'freddy';
    const path = paths[game.jumpscareOrigin] || paths.DOOR_L;
    const stride = smootherstep(progress, 0.018, 0.455);
    const surge = smootherstep(progress, 0.447, BITE_PROGRESS);
    const after = Math.max(0, progress - BITE_PROGRESS);
    const hit = smoothstep(progress, BITE_PROGRESS, BITE_PROGRESS + 0.018)
      * (1 - smoothstep(progress, BITE_PROGRESS + 0.019, 0.89));
    const follow = smoothstep(progress, BITE_PROGRESS + 0.024, BITE_PROGRESS + 0.108);
    const shudder = Math.sin(after * 95) * Math.exp(-after * 20) * smoothstep(after, 0, 0.018);

    path.getPoint(stride, mouth);
    mouth.x = lerp(mouth.x, side * 0.018, surge) - side * follow * 0.037;
    mouth.y = lerp(mouth.y, eye.y - 0.022, surge) - 0.053 * hit;
    mouth.z = lerp(mouth.z, eye.z - (freddy ? 0.115 : 0.139), surge) - follow * 0.23;
    mouth.y += Math.sin(progress * 39) * 0.032 * (1 - surge) * stride * (fromVent ? 0.35 : 1);

    applyAttackPose(attacker, progress, fromVent);
    const headTurn = Math.atan2(eye.x - mouth.x, eye.z - mouth.z);
    attacker.root.rotation.set(0, headTurn, 0);
    attacker.root.position.set(0, 0, 0);
    attacker.mouthAnchor.getWorldPosition(anchor);
    if (!fromVent) {
      // Keep the first stride on the office floor before the upper body lunges.
      const floorBlend = 1 - smoothstep(progress, 0.026, 0.285);
      mouth.y = lerp(mouth.y, anchor.y, floorBlend);
    }
    attacker.root.position.subVectors(mouth, anchor);
    plantAttackFeet(attacker, progress, fromVent);

    const leanBack = smoothstep(progress, 0.25, 0.59) * (1 - smoothstep(progress, 0.76, 1.0));
    camera.position.copy(eye);
    camera.position.z += leanBack * 0.055 + hit * (freddy ? 0.245 : 0.185);
    camera.position.x += side * (0.016 * leanBack + 0.036 * hit);
    camera.position.y += 0.018 * leanBack - 0.071 * hit + shudder * 0.018;

    gaze.copy(mouth);
    gaze.y += lerp(0.17, 0.012, surge);
    lookMatrix.lookAt(camera.position, gaze, up);
    attackLook.setFromRotationMatrix(lookMatrix);
    initialLook.setFromEuler(euler.set(game.jumpscareLookX, game.jumpscareLookY, 0, 'YXZ'));
    camera.quaternion.copy(initialLook).slerp(attackLook, smootherstep(progress, 0.014, 0.221));
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    camera.rotation.set(euler.x + hit * 0.093 + shudder * 0.06,
      euler.y - side * hit * 0.065 + shudder * 0.035, side * 0.115 * hit + shudder * 0.071, 'YXZ');
    camera.fov = 62 + 8.0 * smoothstep(progress, 0.16, 0.51) - 11.0 * follow + hit * 3.4;
    camera.updateProjectionMatrix();

    const light = world.jumpscareLight;
    light.position.copy(eye);
    light.position.x -= side * (0.44 - stride * 0.17);
    light.position.z += 0.30;
    light.position.y += 0.24;
    light.color.setHex(freddy ? 0xffdead : 0xffebd5);
    light.intensity = lerp(12.5, 3.6, surge) + hit * 3.0;
    const rim = world.jumpscareRim;
    rim.position.copy(mouth);
    rim.position.x += side * 0.68;
    rim.position.y += 0.45;
    rim.position.z -= 0.27;
    rim.color.setHex(hit > 0.34 ? 0xdc3022 : freddy ? 0x829dbd : 0x6fb2a0);
    rim.intensity = 2.2 + hit * 1.8;

    return progress;
  }

  function reset() {
    camera.position.copy(eye);
    camera.rotation.z = 0;
    camera.near = 0.1;
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }

  return { update, reset };
}
