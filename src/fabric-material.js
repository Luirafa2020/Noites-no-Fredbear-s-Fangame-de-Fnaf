const fabricFunctions = `
  varying vec3 vFabricPosition;
  uniform float uPile;
  uniform float uWear;

  float fabricHash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1137, 0.1379));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float fabricNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(fabricHash(i), fabricHash(i + vec3(1, 0, 0)), f.x),
          mix(fabricHash(i + vec3(0, 1, 0)), fabricHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(fabricHash(i + vec3(0, 0, 1)), fabricHash(i + vec3(1, 0, 1)), f.x),
          mix(fabricHash(i + vec3(0, 1, 1)), fabricHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

const surfaceColor = `
  #include <map_fragment>
  vec3 cloth = vFabricPosition;
  float nap = fabricNoise(cloth * 21.0 + 1.9);
  float mottle = fabricNoise(cloth * 5.1 + vec3(3.2, 1.5, 8.9));
  float stains = smoothstep(0.27, 0.64, mottle * 0.83 + nap * 0.17) * uWear;
  vec3 threads = cloth * vec3(1290.0, 880.0, 1130.0);
  vec3 width = fwidth(threads);
  float fiberFade = 1.0 - smoothstep(0.45, 2.5, max(width.x, max(width.y, width.z)));
  float fiber = (sin(threads.x + 0.35 * sin(threads.z)) * sin(threads.y)
    + sin(threads.z + threads.x * 0.52) * 0.30) * fiberFade;
  float pileHeight = uPile * (0.0015 * nap + fiber * 0.00017);

  #ifdef USE_MAP
    diffuseColor.rgb = mix(diffuse, diffuseColor.rgb, 0.25 * uWear);
  #endif
  diffuseColor.rgb *= (0.84 + 0.18 * nap + 0.08 * mottle + fiber * 0.075 * uPile);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.58, 0.50, 0.36), stains * 0.69);
`;

const surfaceNormal = `
  #include <normal_fragment_maps>
  vec3 screenX = dFdx(-vViewPosition);
  vec3 screenY = dFdy(-vViewPosition);
  vec3 crossX = cross(screenY, normal);
  vec3 crossY = cross(normal, screenX);
  float det = dot(screenX, crossX);
  vec3 gradient = crossX * dFdx(pileHeight) + crossY * dFdy(pileHeight);
  normal = normalize(max(abs(det), 1e-8) * normal - sign(det) * gradient);
`;

export function addFabricFinish(material, { pile = 1, wear = 0.65 } = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uPile = { value: pile };
    shader.uniforms.uWear = { value: wear };
    shader.vertexShader = 'varying vec3 vFabricPosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvFabricPosition = position;'
    );
    shader.fragmentShader = fabricFunctions + shader.fragmentShader
      .replace('#include <map_fragment>', surfaceColor)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + stains * 0.13 - (nap - 0.5) * 0.07, 0.20, 1.0);
      `)
      .replace('#include <normal_fragment_maps>', surfaceNormal);
  };
  material.customProgramCacheKey = () => 'procedural-fabric';
  return material;
}
