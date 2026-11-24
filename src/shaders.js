import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { saveState } from './config.js';

export const volumetricMaterials = [];

export function createVolumetricConeMat(colorHex, opacity = 0.12) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: opacity },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        vViewPos = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        float fresnel = pow(abs(dot(normalize(vNormal), normalize(vViewPos))), 2.0);
        float vertFade = smoothstep(0.0, 0.85, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
        float dust = 0.72 + 0.36 * noise(vWorldPos.xy * 3.5 + vec2(uTime * 0.18, -uTime * 0.25));
        gl_FragColor = vec4(uColor, uOpacity * fresnel * vertFade * dust);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  volumetricMaterials.push(mat);
  return mat;
}

export const HorrorCRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIsCCTV: { value: 0.0 },
    uGlitch: { value: 0.0 },
    uPowerOut: { value: 0.0 },
    uDanger: { value: 0.0 },
    uBiteFlash: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIsCCTV;
    uniform float uGlitch;
    uniform float uPowerOut;
    uniform float uDanger;
    uniform float uBiteFlash;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      if (uIsCCTV > 0.5) {
        vec2 c = uv - 0.5;
        uv = uv + c * (dot(c, c) * 0.20);
      }
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // Periodic VHS tracking bar when CCTV is active
      float trackBand = smoothstep(0.04, 0.0, abs(fract(uv.y - uTime * 0.17) - 0.18));
      uv.x += uIsCCTV * trackBand * 0.008 * sin(uTime * 42.0);

      // Horizontal signal tear on glitch
      float tear = step(0.88 - uGlitch * 0.36, sin(uv.y * 34.0 + uTime * 23.0)) * uGlitch * 0.072;
      uv.x += tear * (hash(vec2(floor(uv.y * 92.0), uTime)) - 0.5);

      float shift = (0.00055 + uIsCCTV * 0.0022 + uGlitch * 0.016 + uDanger * 0.0012 + uBiteFlash * 0.025);
      float r = texture2D(tDiffuse, uv + vec2(shift, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(shift, 0.0)).b;
      vec3 col = vec3(r, g, b);

      // Subtle filmic split-tone grading in office mode
      if (uIsCCTV < 0.5) {
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 shadowTint = vec3(0.86, 0.91, 1.05);
        vec3 warmTint = vec3(1.06, 0.99, 0.90);
        col *= mix(shadowTint, warmTint, smoothstep(0.08, 0.55, lum));
        col = pow(max(col, vec3(0.0)), vec3(1.04));
      }

      // Film grain & CRT snow
      float grain = (hash(uv * 540.0 + uTime * 43.0) - 0.5);
      col += grain * (0.024 + uIsCCTV * 0.075 + uGlitch * 0.25);

      if (uIsCCTV > 0.5) {
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 irCol = mix(col, vec3(luma * 0.54, luma * 1.18, luma * 0.68), 0.64);
        // Preserve bright white eye-shine & specular peaks
        irCol = mix(irCol, col * 1.15, smoothstep(0.62, 0.95, luma));
        float scan = 0.86 + 0.14 * sin(uv.y * 510.0 + uTime * 11.0);
        col = irCol * scan * 1.24;
        col += trackBand * vec3(0.04, 0.09, 0.05);
      }

      float dist = distance(vUv, vec2(0.5));
      float vigStrength = 0.58 + uDanger * 0.34 + uPowerOut * 0.44 + uBiteFlash * 0.95;
      float vig = smoothstep(0.96, 0.18, dist * (0.86 + vigStrength * 0.50));
      col *= mix(0.20, 1.0, vig);

      if (uDanger > 0.35) {
        float pulse = (0.5 + 0.5 * sin(uTime * 8.5)) * (uDanger - 0.35);
        col.r += dist * pulse * 0.36;
      }
      if (uBiteFlash > 0.01) {
        col = mix(col, vec3(0.78, 0.03, 0.04), uBiteFlash * 0.68);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export function setupPostProcessing(renderer, scene, initialCamera) {
  try {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, initialCamera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
      saveState.quality === 'high' ? 0.42 : 0.0,
      0.46,
      0.74
    );
    bloomPass.enabled = saveState.quality === 'high';
    composer.addPass(bloomPass);
    const crtPass = new ShaderPass(HorrorCRTShader);
    composer.addPass(crtPass);
    composer.addPass(new OutputPass());
    return { composer, bloomPass, crtPass };
  } catch (e) {
    console.warn('EffectComposer fallback:', e);
    return { composer: null, bloomPass: null, crtPass: null };
  }
}
