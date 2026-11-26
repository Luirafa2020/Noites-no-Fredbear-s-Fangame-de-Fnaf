import * as THREE from 'three';

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
        float vertFade = smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.68, 1.0, vUv.y));
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

const displayFragment = `
  uniform sampler2D uScene;
  uniform vec2 uSize;
  uniform vec3 uTint;
  uniform float uGain;
  uniform float uTime;
  uniform float uSignal;
  uniform float uNoise;
  uniform float uCamera;
  uniform float uGlitch;
  uniform float uDanger;
  uniform float uBite;
  uniform float uPowerOut;
  uniform bool uCCTV;
  uniform bool uBloom;
  varying vec2 vUv;

  float hash(vec2 p) {
    vec3 v = fract(vec3(p.xyx) * 0.1031);
    v += dot(v, v.yzx + 33.33);
    return fract((v.x + v.y) * v.z);
  }

  float luma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = uv * 2.0 - 1.0;
    float radius = dot(center * vec2(0.84, 1.0), center * vec2(0.84, 1.0));
    float tracking = 0.0;
    if (uCCTV) {
      uv = 0.5 + (uv - 0.5) * (1.0 + 0.048 * radius);
      tracking = 1.0 - smoothstep(0.012, 0.043, abs(fract(uv.y + uTime * 0.22) - 0.19));
      float row = floor(uv.y * uSize.y * 0.32);
      float jitter = hash(vec2(row, uSignal + uCamera * 29.0)) - 0.5;
      uv.x += jitter * (0.001 + uGlitch * 0.021) + tracking * uGlitch * 0.016;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
        gl_FragColor = vec4(0.006, 0.009, 0.009, 1.0);
        return;
      }
    }

    vec3 color = texture2D(uScene, uv).rgb;
    if (uCCTV) {
      vec2 ghost = vec2((2.5 + 4.0 * uGlitch) / uSize.x, 0.0);
      color = mix(color, texture2D(uScene, uv - ghost).rgb, 0.09 + 0.16 * uGlitch);
      float sensor = luma(color) * uGain;
      color = mix(color * uGain, sensor * uTint, 0.72);
      color *= (1.0 - 0.47 * smoothstep(0.15, 1.63, radius));
    } else {
      if (uBloom) {
        vec2 spread = vec2(3.5) / uSize;
        vec3 halo = texture2D(uScene, uv + spread).rgb + texture2D(uScene, uv - spread).rgb
          + texture2D(uScene, uv + vec2(spread.x, -spread.y)).rgb
          + texture2D(uScene, uv + vec2(-spread.x, spread.y)).rgb;
        color += max(halo * 0.25 - vec3(0.58), 0.0) * 0.19;
      }
      if (uGlitch > 0.15) {
        float separation = uGlitch * 0.007 + uBite * 0.009;
        color.r = texture2D(uScene, uv + vec2(separation, 0.0)).r;
        color.b = texture2D(uScene, uv - vec2(separation, 0.0)).b;
      }
      color *= mix(vec3(0.87, 0.95, 1.07), vec3(1.07, 0.99, 0.88),
        smoothstep(0.02, 0.56, luma(color)));
      color *= 1.0 - (0.27 + uPowerOut * 0.32 + uDanger * 0.15) * smoothstep(0.17, 1.62, radius);
      color.r += radius * uDanger * (0.006 + 0.012 * sin(uTime * 8.5));
      color = mix(color, vec3(0.52, 0.010, 0.009), uBite * 0.36);
    }

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    if (uCCTV) {
      vec2 sampleCell = floor(uv * uSize);
      float grain = hash(sampleCell + vec2(uNoise * 13.0, uCamera * 7.0)) - 0.5;
      float field = 1.0 - 0.10 * (0.5 + 0.5 * cos(uv.y * uSize.y * 3.14159 + mod(uNoise, 2.0) * 3.14159));
      gl_FragColor.rgb = gl_FragColor.rgb * field + grain * (0.065 - min(luma(gl_FragColor.rgb), 0.6) * 0.060);
      gl_FragColor.rgb += tracking * (0.009 + uGlitch * 0.046);
      float dropout = step(0.972, hash(vec2(sampleCell.y, uNoise + uCamera))) * uGlitch;
      float snow = hash(sampleCell * 1.81 + uNoise * 11.0);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(snow * 0.73), min(0.82, dropout + max(0.0, uGlitch - 0.16) * 0.59));
    }
  }
`;

export function createViewRenderer(renderer, scene) {
  const type = renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const office = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true });
  const feed = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true });
  const uniforms = {
    uScene: { value: null },
    uSize: { value: new THREE.Vector2() },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: 1 },
    uTime: { value: 0 },
    uSignal: { value: 0 },
    uNoise: { value: 0 },
    uCamera: { value: 0 },
    uGlitch: { value: 0 },
    uDanger: { value: 0 },
    uBite: { value: 0 },
    uPowerOut: { value: 0 },
    uCCTV: { value: false },
    uBloom: { value: false }
  };

  const screenMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: displayFragment,
    depthTest: false,
    depthWrite: false
  });
  const screenGeometry = new THREE.BufferGeometry();
  screenGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  screenGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.frustumCulled = false;
  const display = new THREE.Scene();
  display.add(screen);
  const screenCamera = new THREE.Camera();

  let lastCamera = null;
  let nextCapture = 0;
  let signalFrame = 0;
  let lastFlash = 0;

  function resize(width, height, high) {
    const outputScale = Math.min(window.devicePixelRatio || 1, high ? 1.35 : 1.0,
      Math.sqrt((high ? 2550000 : 1440000) / (width * height)));
    renderer.setPixelRatio(outputScale);
    renderer.setSize(width, height, false);
    const officeScale = Math.min(outputScale, Math.sqrt((high ? 1870000 : 940000) / (width * height)));
    office.setSize(Math.max(1, Math.round(width * officeScale)), Math.max(1, Math.round(height * officeScale)));
    const feedScale = Math.min(outputScale, (high ? 770 : 560) / Math.max(width, height));
    feed.setSize(Math.max(1, Math.round(width * feedScale)), Math.max(1, Math.round(height * feedScale)));
    lastCamera = null;
  }

  function render(camera, frame) {
    const target = frame.cctv ? feed : office;
    const switched = camera !== lastCamera;
    const flashStarted = frame.flash > lastFlash + 0.16;
    if (!frame.cctv || switched || flashStarted || frame.time >= nextCapture) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      if (frame.cctv) {
        signalFrame = (signalFrame + 1) % 4096;
        const period = 1 / (frame.high ? 24 : 20);
        nextCapture = switched || flashStarted || frame.time - nextCapture >= period
          ? frame.time + period : nextCapture + period;
      }
    }
    lastCamera = camera;
    lastFlash = frame.flash;

    uniforms.uScene.value = target.texture;
    uniforms.uSize.value.set(target.width, target.height);
    uniforms.uCCTV.value = frame.cctv;
    uniforms.uBloom.value = frame.high && !frame.cctv;
    uniforms.uCamera.value = frame.channel;
    uniforms.uTime.value = frame.time % 3600;
    uniforms.uSignal.value = signalFrame;
    uniforms.uNoise.value = Math.floor(uniforms.uTime.value * 30);
    uniforms.uGlitch.value = frame.glitch;
    uniforms.uDanger.value = frame.danger;
    uniforms.uBite.value = frame.bite;
    uniforms.uPowerOut.value = frame.powerOut ? 1 : 0;
    if (frame.cctv) {
      uniforms.uTint.value.fromArray(frame.view.tint);
      uniforms.uGain.value = frame.view.gain + frame.flash * 0.24;
    }
    renderer.render(display, screenCamera);
  }

  return { resize, render };
}
