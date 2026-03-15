import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Clock,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  EdgesGeometry,
  FogExp2,
  Group,
  HalfFloatType,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  SpotLight,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { createPrismBreakupActor } from "./prismBreakupActor";
import {
  buildAvailableShapeList,
  getFallbackAvailableShapes,
  loadPrismShapeAssets,
} from "./prismShapeAssets";
import {
  CUSTOM_EXPRESSION_ID,
  getExpressionPreset,
  isPrismExpressionId,
  isPrismShapeId,
} from "./prismShapeState";

const COLORS = {
  background: "#1A1A1A",
  gold: "#FFD700",
  goldSoft: "#F4D35E",
  teal: "#11C7CC",
  tealSoft: "#8EF8F5",
  red: "#EB3B4B",
  redSoft: "#FF9B9B",
};

const MODE_PRESETS = {
  idle: {
    color: new Color(COLORS.gold),
    accent: new Color("#FFF5CC"),
    bloom: 0.62,
    coreOpacity: 0.36,
    beamOpacity: 0.055,
    floorOpacity: 0.16,
    haloOpacity: 0.05,
    pointIntensity: 4.8,
    spotIntensity: 0.38,
    pulseAmplitude: 0.2,
    rotationSpeed: 0.08,
    jitter: 0,
    particleOpacity: 0.22,
  },
  thinking: {
    color: new Color(COLORS.teal),
    accent: new Color(COLORS.tealSoft),
    bloom: 0.68,
    coreOpacity: 0.3,
    beamOpacity: 0.065,
    floorOpacity: 0.14,
    haloOpacity: 0.08,
    pointIntensity: 4.6,
    spotIntensity: 0.48,
    pulseAmplitude: 0.26,
    rotationSpeed: 0.11,
    jitter: 0,
    particleOpacity: 0.24,
  },
  response: {
    color: new Color(COLORS.gold),
    accent: new Color("#FFF9E2"),
    bloom: 0.82,
    coreOpacity: 0.48,
    beamOpacity: 0.075,
    floorOpacity: 0.24,
    haloOpacity: 0.1,
    pointIntensity: 6.4,
    spotIntensity: 0.62,
    pulseAmplitude: 0.3,
    rotationSpeed: 0.095,
    jitter: 0,
    particleOpacity: 0.28,
  },
  error: {
    color: new Color(COLORS.red),
    accent: new Color(COLORS.redSoft),
    bloom: 0.44,
    coreOpacity: 0.18,
    beamOpacity: 0.025,
    floorOpacity: 0.08,
    haloOpacity: 0.03,
    pointIntensity: 3.2,
    spotIntensity: 0.18,
    pulseAmplitude: 0.14,
    rotationSpeed: 0.055,
    jitter: 0.03,
    particleOpacity: 0.16,
  },
};

const MODE_SEQUENCE = ["idle", "thinking", "response", "error"];
const DEFAULT_SHAPE_ID = "dodecahedron";
const DEFAULT_EXPRESSION_ID = "friendly";
const DEFAULT_TRANSITION_PHASE = "idle";
const DEFAULT_CONFIG = {
  exposure: 1,
  bloom: 1,
  glow: 1,
  motion: 1,
  reflections: 1,
  particles: 1,
  hover: 1,
  look: 0.4,
  spinX: 0,
  spinY: 0,
  spinZ: 0,
  zoom: 1,
  speed: 1,
  tilt: 1,
  attention: 0.9,
  anticipation: 0.7,
  settle: 0.8,
  breakup: 0,
  breakupPulse: 0,
  transformSpeed: 1,
  transformForce: 1,
  musicMix: 0.9,
  musicPulse: 1,
  musicMotion: 0.78,
  musicShimmer: 0.72,
  musicBreakup: 0.44,
};

const CONFIG_LIMITS = {
  exposure: [0, 2],
  bloom: [0, 2],
  glow: [0, 2],
  motion: [0, 2],
  reflections: [0, 2],
  particles: [0, 2],
  hover: [0, 2],
  look: [0, 1],
  spinX: [-2, 2],
  spinY: [-2, 2],
  spinZ: [-2, 2],
  zoom: [0.65, 1.8],
  speed: [0, 3],
  tilt: [0, 5],
  attention: [0, 1.8],
  anticipation: [0, 1.8],
  settle: [0, 1.8],
  breakup: [0, 1.5],
  breakupPulse: [0, 2.5],
  transformSpeed: [0.4, 2.5],
  transformForce: [0.35, 2],
  musicMix: [0, 1.6],
  musicPulse: [0, 1.8],
  musicMotion: [0, 1.8],
  musicShimmer: [0, 1.8],
  musicBreakup: [0, 1.6],
};

const LOOK_STYLES = {
  studio: {
    glassColor: new Color("#F8FBFF"),
    glassAttenuation: new Color("#FFF8E8"),
    innerColor: new Color("#EEF6FF"),
    innerAttenuation: new Color("#FFFFFF"),
    coreColor: new Color("#FFF9EE"),
    auraColor: new Color("#FFF3D9"),
    fillColor: new Color("#CFE6FF"),
    rimColor: new Color("#FFFFFF"),
    topColor: new Color("#FFFFFF"),
    sideColor: new Color("#DCEBFF"),
    floorColor: new Color("#F6F0E2"),
    stageDiscColor: new Color("#171717"),
    pedestalColor: new Color("#181818"),
    particleColor: new Color("#FFF2DB"),
    prismRoughnessMin: 0.014,
    prismRoughnessMax: 0.054,
    envMapMin: 1.05,
    envMapMax: 2.2,
    clearcoatRoughnessMin: 0.008,
    clearcoatRoughnessMax: 0.05,
    thickness: 1.82,
    attenuationDistance: 4.8,
    ior: 1.5,
    emissiveBoost: 0.74,
    innerEnvMapMin: 0.88,
    innerEnvMapMax: 1.4,
    innerOpacityBase: 0.24,
    innerOpacityReflection: 0.05,
    wireOpacityBase: 0.28,
    wireOpacityGlow: 0.06,
    coreOpacityBoost: 0.84,
    auraOpacityBoost: 0.8,
    beamBoost: 0.48,
    haloBoost: 0.5,
    floorBoost: 0.42,
    particleBoost: 0.7,
    particleSizeBoost: 0.95,
    topSpotBoost: 0.82,
    sideSpotBoost: 0.44,
    fillIntensityMinimal: 0.86,
    fillIntensityHero: 1.28,
    rimIntensityMinimal: 1.18,
    rimIntensityHero: 1.7,
    shadowBaseMinimal: 0.18,
    shadowBaseHero: 0.14,
    pedestalRoughness: 0.42,
    pedestalMetalness: 0.14,
    pedestalClearcoat: 0.28,
    stageDiscOpacity: 0.04,
    floorMinimalOpacity: 0.0035,
    floorHeroOpacity: 0.038,
    motionSpeed: 0.86,
    hoverLift: 0.06,
  },
  artifact: {
    glassColor: new Color("#FFF4E2"),
    glassAttenuation: new Color("#FFD68A"),
    innerColor: new Color("#FFF2D6"),
    innerAttenuation: new Color("#FFE6AE"),
    coreColor: new Color("#FFE4A3"),
    auraColor: new Color("#FFC84D"),
    fillColor: new Color("#5BE1EC"),
    rimColor: new Color("#FFF0BC"),
    topColor: new Color("#FFE0A0"),
    sideColor: new Color("#FFCF70"),
    floorColor: new Color(COLORS.gold),
    stageDiscColor: new Color("#241B08"),
    pedestalColor: new Color("#1E160A"),
    particleColor: new Color("#FFE7AE"),
    prismRoughnessMin: 0.02,
    prismRoughnessMax: 0.082,
    envMapMin: 0.95,
    envMapMax: 1.9,
    clearcoatRoughnessMin: 0.014,
    clearcoatRoughnessMax: 0.08,
    thickness: 2.65,
    attenuationDistance: 2.7,
    ior: 1.42,
    emissiveBoost: 1.25,
    innerEnvMapMin: 0.82,
    innerEnvMapMax: 1.24,
    innerOpacityBase: 0.34,
    innerOpacityReflection: 0.09,
    wireOpacityBase: 0.44,
    wireOpacityGlow: 0.1,
    coreOpacityBoost: 1.2,
    auraOpacityBoost: 1.18,
    beamBoost: 1.18,
    haloBoost: 1.2,
    floorBoost: 1.15,
    particleBoost: 1.05,
    particleSizeBoost: 1.08,
    topSpotBoost: 1.16,
    sideSpotBoost: 0.66,
    fillIntensityMinimal: 1.04,
    fillIntensityHero: 1.54,
    rimIntensityMinimal: 1.4,
    rimIntensityHero: 2.08,
    shadowBaseMinimal: 0.23,
    shadowBaseHero: 0.18,
    pedestalRoughness: 0.3,
    pedestalMetalness: 0.28,
    pedestalClearcoat: 0.36,
    stageDiscOpacity: 0.18,
    floorMinimalOpacity: 0.0075,
    floorHeroOpacity: 0.07,
    motionSpeed: 1.02,
    hoverLift: 0.085,
  },
};

function clampConfigValue(key, value) {
  const fallback = DEFAULT_CONFIG[key];
  if (!Number.isFinite(value)) return fallback;
  const [min, max] = CONFIG_LIMITS[key] ?? [0, 2];
  return MathUtils.clamp(value, min, max);
}

function normalizeConfig(config = {}) {
  return {
    exposure: clampConfigValue(
      "exposure",
      config.exposure ?? DEFAULT_CONFIG.exposure
    ),
    bloom: clampConfigValue("bloom", config.bloom ?? DEFAULT_CONFIG.bloom),
    glow: clampConfigValue("glow", config.glow ?? DEFAULT_CONFIG.glow),
    motion: clampConfigValue("motion", config.motion ?? DEFAULT_CONFIG.motion),
    reflections: clampConfigValue(
      "reflections",
      config.reflections ?? DEFAULT_CONFIG.reflections
    ),
    particles: clampConfigValue(
      "particles",
      config.particles ?? DEFAULT_CONFIG.particles
    ),
    hover: clampConfigValue("hover", config.hover ?? DEFAULT_CONFIG.hover),
    look: clampConfigValue("look", config.look ?? DEFAULT_CONFIG.look),
    spinX: clampConfigValue("spinX", config.spinX ?? DEFAULT_CONFIG.spinX),
    spinY: clampConfigValue("spinY", config.spinY ?? DEFAULT_CONFIG.spinY),
    spinZ: clampConfigValue("spinZ", config.spinZ ?? DEFAULT_CONFIG.spinZ),
    zoom: clampConfigValue("zoom", config.zoom ?? DEFAULT_CONFIG.zoom),
    speed: clampConfigValue("speed", config.speed ?? DEFAULT_CONFIG.speed),
    tilt: clampConfigValue("tilt", config.tilt ?? DEFAULT_CONFIG.tilt),
    attention: clampConfigValue(
      "attention",
      config.attention ?? DEFAULT_CONFIG.attention
    ),
    anticipation: clampConfigValue(
      "anticipation",
      config.anticipation ?? DEFAULT_CONFIG.anticipation
    ),
    settle: clampConfigValue("settle", config.settle ?? DEFAULT_CONFIG.settle),
    breakup: clampConfigValue(
      "breakup",
      config.breakup ?? DEFAULT_CONFIG.breakup
    ),
    breakupPulse: clampConfigValue(
      "breakupPulse",
      config.breakupPulse ?? DEFAULT_CONFIG.breakupPulse
    ),
    transformSpeed: clampConfigValue(
      "transformSpeed",
      config.transformSpeed ?? DEFAULT_CONFIG.transformSpeed
    ),
    transformForce: clampConfigValue(
      "transformForce",
      config.transformForce ?? DEFAULT_CONFIG.transformForce
    ),
    musicMix: clampConfigValue(
      "musicMix",
      config.musicMix ?? DEFAULT_CONFIG.musicMix
    ),
    musicPulse: clampConfigValue(
      "musicPulse",
      config.musicPulse ?? DEFAULT_CONFIG.musicPulse
    ),
    musicMotion: clampConfigValue(
      "musicMotion",
      config.musicMotion ?? DEFAULT_CONFIG.musicMotion
    ),
    musicShimmer: clampConfigValue(
      "musicShimmer",
      config.musicShimmer ?? DEFAULT_CONFIG.musicShimmer
    ),
  };
}

function setFxaaResolution(pass, width, height, dpr) {
  if (!pass?.material?.uniforms?.resolution?.value) return;
  pass.material.uniforms.resolution.value.x = 1 / (width * dpr);
  pass.material.uniforms.resolution.value.y = 1 / (height * dpr);
}

function smoothLerp(alphaPerSecond, delta) {
  return 1 - Math.exp(-alphaPerSecond * delta);
}

function createBreakupTransform(sourceGeometry) {
  const geometry = sourceGeometry.toNonIndexed();
  geometry.computeVertexNormals();

  const positionAttribute = geometry.getAttribute("position");
  const positions = positionAttribute.array;
  const basePositions = new Float32Array(positions);
  const faceDirections = new Float32Array(positions.length);
  const facePhases = new Float32Array(positions.length / 9);
  const vertexA = new Vector3();
  const vertexB = new Vector3();
  const vertexC = new Vector3();
  const centroid = new Vector3();
  const edgeAB = new Vector3();
  const edgeAC = new Vector3();
  const faceDirection = new Vector3();
  const radial = new Vector3();

  for (
    let offset = 0, faceIndex = 0;
    offset < positions.length;
    offset += 9, faceIndex += 1
  ) {
    vertexA.fromArray(basePositions, offset);
    vertexB.fromArray(basePositions, offset + 3);
    vertexC.fromArray(basePositions, offset + 6);

    centroid
      .copy(vertexA)
      .add(vertexB)
      .add(vertexC)
      .multiplyScalar(1 / 3);
    edgeAB.subVectors(vertexB, vertexA);
    edgeAC.subVectors(vertexC, vertexA);
    faceDirection.copy(edgeAB).cross(edgeAC).normalize();
    radial.copy(centroid).normalize();
    faceDirection.lerp(radial, 0.34).normalize();

    facePhases[faceIndex] =
      radial.x * 1.7 + radial.y * 2.1 + radial.z * 2.5 + faceIndex * 0.18;

    for (let vertexOffset = 0; vertexOffset < 9; vertexOffset += 3) {
      faceDirections[offset + vertexOffset] = faceDirection.x;
      faceDirections[offset + vertexOffset + 1] = faceDirection.y;
      faceDirections[offset + vertexOffset + 2] = faceDirection.z;
    }
  }

  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) {
    geometry.boundingSphere.radius += 0.3;
  }

  return {
    geometry,
    update({ amount = 0, pulse = 0, elapsed = 0, speed = 1 }) {
      for (
        let offset = 0, faceIndex = 0;
        offset < positions.length;
        offset += 9, faceIndex += 1
      ) {
        const wave =
          pulse > 0
            ? 1 +
              ((Math.sin(
                elapsed * (0.72 + pulse * 0.22) * Math.max(speed, 0) +
                  facePhases[faceIndex]
              ) +
                1) *
                0.5 -
                0.5) *
                (0.16 + pulse * 0.24)
            : 1;
        const displacement = amount * wave;

        for (let component = 0; component < 9; component += 1) {
          positions[offset + component] =
            basePositions[offset + component] +
            faceDirections[offset + component] * displacement;
        }
      }

      positionAttribute.needsUpdate = true;
    },
  };
}

function createParticleField({ count, coarsePointer, radiusMin, radiusMax }) {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const drift = new Float32Array(count);
  const phase = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = Math.random() * (radiusMax - radiusMin) + radiusMin;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(MathUtils.randFloatSpread(2));

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi) * 0.72;
    const z = radius * Math.sin(phi) * Math.sin(theta);

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    basePositions[i3] = x;
    basePositions[i3 + 1] = y;
    basePositions[i3 + 2] = z;

    drift[i] = Math.random() * 0.38 + 0.12;
    phase[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: new Color(COLORS.goldSoft),
    size: coarsePointer ? 0.028 : 0.022,
    transparent: true,
    opacity: coarsePointer ? 0.22 : 0.28,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);
  return {
    geometry,
    material,
    points,
    positions,
    basePositions,
    drift,
    phase,
  };
}

function createFloorRings() {
  const configs = [
    { inner: 1.24, outer: 1.34, opacity: 0.24 },
    { inner: 1.62, outer: 1.7, opacity: 0.16 },
    { inner: 1.94, outer: 2.0, opacity: 0.1 },
  ];

  return configs.map((config) => {
    const material = new MeshBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: config.opacity,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
    });
    const mesh = new Mesh(
      new RingGeometry(config.inner, config.outer, 96),
      material
    );
    mesh.rotation.x = -Math.PI / 2;
    return { mesh, material, baseOpacity: config.opacity };
  });
}

function createResponseRings() {
  const rings = [
    { inner: 1.38, outer: 1.44, baseScale: 1, baseOpacity: 0.22 },
    { inner: 1.62, outer: 1.67, baseScale: 1.06, baseOpacity: 0.16 },
    { inner: 1.88, outer: 1.92, baseScale: 1.12, baseOpacity: 0.12 },
  ];

  return rings.map((ring) => {
    const material = new MeshBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
    });
    const mesh = new Mesh(
      new RingGeometry(ring.inner, ring.outer, 96),
      material
    );
    mesh.position.set(0, 0.18, -0.96);
    mesh.visible = false;
    return { mesh, material, ...ring };
  });
}

function createBeam({
  color,
  radiusTop,
  radiusBottom,
  height,
  position,
  rotation,
  opacity,
}) {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
  });

  const mesh = new Mesh(
    new CylinderGeometry(radiusTop, radiusBottom, height, 32, 1, true),
    material
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return { mesh, material };
}

export default function createPrismHeroScene(canvas, options = {}) {
  const {
    reducedMotion = false,
    mode = "idle",
    initialShape = DEFAULT_SHAPE_ID,
    initialExpression = DEFAULT_EXPRESSION_ID,
    enableScroll = true,
    enablePointer = true,
    enableClickCycle = false,
    stageStyle = "hero",
    initialConfig = {},
    onModeChange,
    onShapeChange,
    onExpressionChange,
    onTransitionPhaseChange,
    onShapeAssetsChange,
    onReady,
    onError,
  } = options;

  const fallbackController = {
    destroy() {},
    setMode() {},
    setShape() {},
    setExpression() {},
    setConfig() {},
    setAudioReactivity() {},
    getAvailableShapes() {
      return getFallbackAvailableShapes();
    },
  };

  if (!canvas) {
    return fallbackController;
  }

  try {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const minimalStage = stageStyle === "minimal";
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.2 : 1.5),
    };

    const configTarget = normalizeConfig(initialConfig);
    const configCurrent = { ...configTarget };

    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setPixelRatio(viewport.dpr);
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.setClearColor(new Color(COLORS.background), 1);

    const scene = new Scene();
    scene.background = new Color(COLORS.background);
    scene.fog = new FogExp2(
      COLORS.background,
      minimalStage
        ? coarsePointer
          ? 0.018
          : 0.013
        : coarsePointer
          ? 0.062
          : 0.048
    );

    const camera = new PerspectiveCamera(
      coarsePointer ? 46 : 40,
      viewport.width / viewport.height,
      0.1,
      100
    );
    camera.position.set(
      0,
      minimalStage ? 0.08 : 0.12,
      enableScroll ? 6.5 : 5.1
    );

    const pmremGenerator = new PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environment = pmremGenerator.fromScene(
      roomEnvironment,
      minimalStage ? 0.018 : 0.035
    );
    scene.environment = environment.texture;

    const stageGroup = new Group();
    scene.add(stageGroup);

    const shadowMaterial = new MeshBasicMaterial({
      color: new Color("#000000"),
      transparent: true,
      opacity: minimalStage ? 0.22 : 0.16,
      side: DoubleSide,
      depthWrite: false,
    });
    const shadowMesh = new Mesh(new CircleGeometry(1.45, 96), shadowMaterial);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, -1.53, 0);
    shadowMesh.scale.set(1.25, 0.68, 1);
    stageGroup.add(shadowMesh);

    const pedestalMaterial = new MeshPhysicalMaterial({
      color: new Color("#161616"),
      roughness: 0.54,
      metalness: 0.18,
      clearcoat: 0.2,
      clearcoatRoughness: 0.44,
    });
    const pedestal = new Mesh(
      new CylinderGeometry(1.08, 1.28, 0.34, 64),
      pedestalMaterial
    );
    pedestal.position.set(0, -1.78, 0);
    pedestal.visible = minimalStage;
    stageGroup.add(pedestal);

    const stageDiscMaterial = new MeshBasicMaterial({
      color: new Color("#241D08"),
      transparent: true,
      opacity: minimalStage ? 0.08 : 0.22,
      side: DoubleSide,
      depthWrite: false,
    });
    const stageDisc = new Mesh(new CircleGeometry(4.9, 96), stageDiscMaterial);
    stageDisc.rotation.x = -Math.PI / 2;
    stageDisc.position.set(0, -2.12, 0);
    stageDisc.visible = !minimalStage;
    stageGroup.add(stageDisc);

    const floorGlowMaterial = new MeshBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: minimalStage ? 0.006 : 0.03,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
    });
    const floorGlow = new Mesh(new CircleGeometry(2.0, 96), floorGlowMaterial);
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(0, minimalStage ? -1.61 : -2.11, 0);
    floorGlow.scale.set(minimalStage ? 0.86 : 1, minimalStage ? 0.56 : 1, 1);
    stageGroup.add(floorGlow);

    const floorRings = createFloorRings();
    floorRings.forEach(({ mesh }) => {
      mesh.position.y = -2.1;
      mesh.visible = !minimalStage;
      stageGroup.add(mesh);
    });

    const rearHaloMaterial = new MeshBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: 0.045,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
    });
    const rearHalo = new Mesh(
      new RingGeometry(1.48, 1.72, 80),
      rearHaloMaterial
    );
    rearHalo.position.set(0, 0.16, -0.92);
    rearHalo.visible = !minimalStage;
    scene.add(rearHalo);

    const responseRings = createResponseRings();
    responseRings.forEach(({ mesh }) => scene.add(mesh));

    const beamDefinitions = [
      {
        color: new Color(COLORS.goldSoft),
        radiusTop: 0.06,
        radiusBottom: 1.65,
        height: 6.4,
        position: [0, 3.15, 0],
        rotation: [0, 0, 0],
        opacity: 0.04,
      },
      {
        color: new Color(COLORS.goldSoft),
        radiusTop: 0.045,
        radiusBottom: 1.18,
        height: 6.0,
        position: [-2.12, 2.38, 0],
        rotation: [0, 0, 0.38],
        opacity: 0.032,
      },
      {
        color: new Color(COLORS.goldSoft),
        radiusTop: 0.045,
        radiusBottom: 1.18,
        height: 6.0,
        position: [2.12, 2.38, 0],
        rotation: [0, 0, -0.38],
        opacity: 0.032,
      },
    ];

    const beams = beamDefinitions.map((definition) => createBeam(definition));
    beams.forEach(({ mesh }) => {
      mesh.visible = !minimalStage;
      scene.add(mesh);
    });

    const prismAnchor = new Group();
    prismAnchor.position.set(0, minimalStage ? -0.08 : 0.16, 0);
    scene.add(prismAnchor);

    const fallbackPrismGeometry = new DodecahedronGeometry(1.22, 0);
    let breakupTransform = createBreakupTransform(
      fallbackPrismGeometry.clone()
    );
    let wireframeGeometry = new EdgesGeometry(fallbackPrismGeometry, 1);
    let coreGeometry = fallbackPrismGeometry.clone();
    let auraGeometry = fallbackPrismGeometry.clone();
    const fallbackSourceMaterial = new MeshBasicMaterial({
      color: new Color("#ffffff"),
    });

    const prismMaterial = new MeshPhysicalMaterial({
      color: new Color("#FAFAFA"),
      roughness: 0.035,
      metalness: 0,
      transmission: 1,
      thickness: 2.2,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      specularIntensity: 1,
      attenuationDistance: 2.8,
      attenuationColor: new Color("#FFF2BA"),
      emissive: new Color(COLORS.gold),
      emissiveIntensity: 0.2,
      envMapIntensity: 1.25,
    });

    const innerShellMaterial = new MeshPhysicalMaterial({
      color: new Color("#FFFFFF"),
      roughness: 0.018,
      metalness: 0,
      transmission: 1,
      thickness: 0.9,
      ior: 1.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      specularIntensity: 0.9,
      transparent: true,
      opacity: 0.42,
      side: BackSide,
      envMapIntensity: 0.9,
      attenuationDistance: 1.4,
      attenuationColor: new Color("#FFF4D2"),
    });

    const prismBody = new Mesh(breakupTransform.geometry, prismMaterial);
    prismAnchor.add(prismBody);

    const prismInnerShell = new Mesh(
      breakupTransform.geometry,
      innerShellMaterial
    );
    prismInnerShell.scale.setScalar(0.965);
    prismAnchor.add(prismInnerShell);

    const wireframeMaterial = new LineBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: 0.56,
    });
    const prismWireframe = new LineSegments(
      wireframeGeometry,
      wireframeMaterial
    );
    prismWireframe.scale.setScalar(1.0015);
    prismAnchor.add(prismWireframe);

    const coreMaterial = new MeshBasicMaterial({
      color: new Color(COLORS.gold),
      transparent: true,
      opacity: 0.24,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const coreMesh = new Mesh(coreGeometry, coreMaterial);
    prismAnchor.add(coreMesh);

    const coreAuraMaterial = new MeshBasicMaterial({
      color: new Color(COLORS.goldSoft),
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const coreAura = new Mesh(auraGeometry, coreAuraMaterial);
    prismAnchor.add(coreAura);

    scene.add(
      new AmbientLight(new Color("#FFF8E8"), minimalStage ? 0.1 : 0.14)
    );
    scene.add(
      new HemisphereLight(
        new Color("#FFF4CF"),
        new Color("#0E0E0E"),
        minimalStage ? 0.18 : 0.28
      )
    );

    const keyLight = new PointLight(new Color(COLORS.gold), 4.8, 16, 1.8);
    keyLight.position.set(0, 0.02, 0.18);
    prismAnchor.add(keyLight);

    const fillLight = new PointLight(
      new Color("#78B5C5"),
      minimalStage ? 0.72 : 1.1,
      18,
      2
    );
    fillLight.position.set(-3.6, -1.4, 3.4);
    scene.add(fillLight);

    const rimLight = new PointLight(
      new Color("#FFF6D8"),
      minimalStage ? 1.08 : 1.9,
      22,
      2
    );
    rimLight.position.set(3.4, 2.8, 4.4);
    scene.add(rimLight);

    const topSpot = new SpotLight(
      new Color("#FFF4D2"),
      minimalStage ? 0.14 : 0.42,
      18,
      0.42,
      0.85,
      1
    );
    topSpot.position.set(0, 6.2, 1.2);
    topSpot.target.position.set(0, 0, 0);
    scene.add(topSpot);
    scene.add(topSpot.target);

    const sideSpot = new SpotLight(
      new Color("#FFE7A3"),
      minimalStage ? 0.08 : 0.22,
      18,
      0.35,
      0.9,
      1
    );
    sideSpot.position.set(-4.2, 4.1, 2.3);
    sideSpot.target.position.set(0, -0.3, 0);
    scene.add(sideSpot);
    scene.add(sideSpot.target);

    const particleField = createParticleField({
      count: reducedMotion
        ? 220
        : coarsePointer
          ? 320
          : minimalStage
            ? 460
            : 720,
      coarsePointer,
      radiusMin: minimalStage ? 1.8 : 2.2,
      radiusMax: minimalStage ? 3.6 : 5.4,
    });
    particleField.points.position.set(0, 0.1, 0);
    scene.add(particleField.points);

    const renderTarget = new WebGLRenderTarget(
      Math.max(1, Math.floor(viewport.width * viewport.dpr)),
      Math.max(1, Math.floor(viewport.height * viewport.dpr)),
      { type: HalfFloatType }
    );

    const composer = new EffectComposer(renderer, renderTarget);
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(viewport.width, viewport.height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new Vector2(viewport.width, viewport.height),
      reducedMotion ? 0.52 : coarsePointer ? 0.58 : 0.62,
      0.95,
      0.28
    );
    composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    setFxaaResolution(fxaaPass, viewport.width, viewport.height, viewport.dpr);
    composer.addPass(fxaaPass);

    const raycaster = new Raycaster();
    const pointer = new Vector2(0, 0);
    const pointerTarget = new Vector2(0, 0);
    const pointerNdc = new Vector2(2, 2);
    const cameraLookAt = new Vector2(0, 0);
    const clock = new Clock();
    const basePrismPosition = {
      x: 0,
      y: minimalStage ? -0.08 : 0.16,
    };

    const normalizedInitialExpression = isPrismExpressionId(initialExpression)
      ? initialExpression
      : DEFAULT_EXPRESSION_ID;
    const currentMode = {
      value: MODE_PRESETS[mode]
        ? mode
        : (getExpressionPreset(normalizedInitialExpression)?.mode ?? "idle"),
    };
    const currentShape = {
      value: isPrismShapeId(initialShape)
        ? initialShape
        : (getExpressionPreset(normalizedInitialExpression)?.shape ??
          DEFAULT_SHAPE_ID),
    };
    const currentExpression = {
      value: normalizedInitialExpression,
    };

    const runtime = {
      stateColor: MODE_PRESETS.idle.color.clone(),
      accentColor: MODE_PRESETS.idle.accent.clone(),
      bloomStrength: MODE_PRESETS.idle.bloom,
      coreOpacity: MODE_PRESETS.idle.coreOpacity,
      beamOpacity: MODE_PRESETS.idle.beamOpacity,
      floorOpacity: MODE_PRESETS.idle.floorOpacity,
      haloOpacity: MODE_PRESETS.idle.haloOpacity,
      pointIntensity: MODE_PRESETS.idle.pointIntensity,
      spotIntensity: MODE_PRESETS.idle.spotIntensity,
      particleOpacity: MODE_PRESETS.idle.particleOpacity,
      responseMix: 0,
      hoverMix: 0,
      attentionMix: 0,
    };
    const audioTarget = {
      active: 0,
      playing: 0,
      level: 0,
      bass: 0,
      mids: 0,
      treble: 0,
      transient: 0,
      pulse: 0,
      progress: 0,
    };
    const audioCurrent = { ...audioTarget };
    const tempColors = {
      glass: new Color(),
      glassAttenuation: new Color(),
      inner: new Color(),
      innerAttenuation: new Color(),
      wire: new Color(),
      core: new Color(),
      aura: new Color(),
      fill: new Color(),
      rim: new Color(),
      top: new Color(),
      side: new Color(),
      floor: new Color(),
      stageDisc: new Color(),
      pedestal: new Color(),
      particle: new Color(),
    };
    const assetState = {
      status: "loading",
      shapes: {},
      availableShapes: new Set(getFallbackAvailableShapes()),
    };
    const transitionState = {
      active: false,
      phase: DEFAULT_TRANSITION_PHASE,
      fromShape: currentShape.value,
      toShape: currentShape.value,
      elapsed: 0,
      progress: 0,
      outgoingActor: null,
      incomingActor: null,
      targetInstalled: true,
    };
    const intactMeshes = [
      prismBody,
      prismInnerShell,
      prismWireframe,
      coreMesh,
      coreAura,
    ];
    const coreBaseScale = 0.27;
    const auraBaseScale = 0.49;
    const choreographyState = {
      settleImpulse: 0,
      settleTime: 0,
    };

    let frameId = 0;
    let destroyed = false;
    let scrollProgress = 0;
    let isHoveringPrism = false;
    let pointerInsideViewport = false;

    const emitMode = (nextMode) => {
      if (typeof onModeChange === "function") {
        onModeChange(nextMode);
      }
    };

    const emitShape = (nextShape) => {
      if (typeof onShapeChange === "function") {
        onShapeChange(nextShape);
      }
    };

    const emitExpression = (nextExpression) => {
      if (typeof onExpressionChange === "function") {
        onExpressionChange(nextExpression);
      }
    };

    const emitTransitionPhase = (nextPhase) => {
      if (typeof onTransitionPhaseChange === "function") {
        onTransitionPhaseChange(nextPhase);
      }
    };

    const emitShapeAssets = () => {
      if (typeof onShapeAssetsChange === "function") {
        onShapeAssetsChange({
          status: assetState.status,
          availableShapes: Array.from(assetState.availableShapes),
        });
      }
    };

    const setTransitionPhase = (nextPhase) => {
      if (transitionState.phase === nextPhase) return;
      transitionState.phase = nextPhase;
      emitTransitionPhase(nextPhase);
    };

    const setIntactVisible = (visible) => {
      intactMeshes.forEach((mesh) => {
        mesh.visible = visible;
      });
    };

    const markExpressionCustom = (emit = false) => {
      if (currentExpression.value === CUSTOM_EXPRESSION_ID) return false;
      currentExpression.value = CUSTOM_EXPRESSION_ID;
      if (emit) {
        emitExpression(CUSTOM_EXPRESSION_ID);
      }
      return true;
    };

    const getShapeGeometry = (shapeId) =>
      assetState.shapes[shapeId]?.geometry ?? fallbackPrismGeometry;

    const createSourceObjectForShape = (shapeId) => {
      const asset = assetState.shapes[shapeId];
      if (asset?.createSourceObject) {
        return asset.createSourceObject();
      }

      const fallbackMesh = new Mesh(
        fallbackPrismGeometry.clone(),
        fallbackSourceMaterial
      );
      fallbackMesh.name = shapeId;
      return fallbackMesh;
    };

    const applyShapeGeometry = (shapeId) => {
      const sourceGeometry = getShapeGeometry(shapeId);
      const nextBreakupTransform = createBreakupTransform(
        sourceGeometry.clone()
      );
      const nextWireframeGeometry = new EdgesGeometry(sourceGeometry, 1);
      const nextCoreGeometry = sourceGeometry.clone();
      const nextAuraGeometry = sourceGeometry.clone();
      const previousBreakupGeometry = breakupTransform.geometry;
      const previousWireframeGeometry = wireframeGeometry;
      const previousCoreGeometry = coreGeometry;
      const previousAuraGeometry = auraGeometry;

      breakupTransform = nextBreakupTransform;
      wireframeGeometry = nextWireframeGeometry;
      coreGeometry = nextCoreGeometry;
      auraGeometry = nextAuraGeometry;

      prismBody.geometry = breakupTransform.geometry;
      prismInnerShell.geometry = breakupTransform.geometry;
      prismWireframe.geometry = wireframeGeometry;
      coreMesh.geometry = coreGeometry;
      coreAura.geometry = auraGeometry;

      previousBreakupGeometry.dispose();
      previousWireframeGeometry.dispose();
      previousCoreGeometry.dispose();
      previousAuraGeometry.dispose();
    };

    const disposeTransitionActors = () => {
      if (transitionState.outgoingActor) {
        prismAnchor.remove(transitionState.outgoingActor.group);
        transitionState.outgoingActor.destroy();
        transitionState.outgoingActor = null;
      }

      if (transitionState.incomingActor) {
        prismAnchor.remove(transitionState.incomingActor.group);
        transitionState.incomingActor.destroy();
        transitionState.incomingActor = null;
      }
    };

    const setModeInternal = (nextMode, emit = false, options = {}) => {
      if (!MODE_PRESETS[nextMode] || currentMode.value === nextMode)
        return false;
      currentMode.value = nextMode;

      if (!options.preserveExpression) {
        markExpressionCustom(emit);
      }

      if (emit) {
        emitMode(nextMode);
      }
      return true;
    };

    const startShapeTransition = (nextShape, emit = false, options = {}) => {
      if (!isPrismShapeId(nextShape) || transitionState.active) return false;
      if (currentShape.value === nextShape) return false;
      if (!assetState.availableShapes.has(nextShape)) return false;

      if (!options.preserveExpression) {
        markExpressionCustom(emit);
      }

      disposeTransitionActors();

      const outgoingActor = createPrismBreakupActor({
        name: `${transitionState.fromShape ?? currentShape.value}-outgoing`,
        sourceObject: createSourceObjectForShape(currentShape.value),
      });
      const incomingActor = createPrismBreakupActor({
        name: `${nextShape}-incoming`,
        sourceObject: createSourceObjectForShape(nextShape),
      });

      prismAnchor.add(outgoingActor.group);
      prismAnchor.add(incomingActor.group);
      outgoingActor.group.visible = false;
      incomingActor.group.visible = false;

      transitionState.active = true;
      transitionState.elapsed = 0;
      transitionState.progress = 0;
      transitionState.fromShape = currentShape.value;
      transitionState.toShape = nextShape;
      transitionState.outgoingActor = outgoingActor;
      transitionState.incomingActor = incomingActor;
      transitionState.targetInstalled = false;
      currentShape.value = nextShape;

      if (emit) {
        emitShape(nextShape);
      }

      setTransitionPhase("prebreak");
      return true;
    };

    const setExpressionInternal = (nextExpression, emit = false) => {
      if (!isPrismExpressionId(nextExpression) || transitionState.active) {
        return false;
      }

      const preset = getExpressionPreset(nextExpression);
      if (!preset || !assetState.availableShapes.has(preset.shape)) {
        return false;
      }

      const expressionChanged = currentExpression.value !== nextExpression;
      currentExpression.value = nextExpression;

      if (emit && expressionChanged) {
        emitExpression(nextExpression);
      }

      setModeInternal(preset.mode, emit, { preserveExpression: true });

      if (preset.shape !== currentShape.value) {
        startShapeTransition(preset.shape, emit, { preserveExpression: true });
      }

      return true;
    };

    applyShapeGeometry(
      assetState.availableShapes.has(currentShape.value)
        ? currentShape.value
        : DEFAULT_SHAPE_ID
    );
    emitShapeAssets();
    emitTransitionPhase(DEFAULT_TRANSITION_PHASE);

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointerTarget.x = (event.clientX / viewport.width) * 2 - 1;
      pointerTarget.y = -((event.clientY / viewport.height) * 2 - 1);
      pointerInsideViewport =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerLeave = () => {
      pointerInsideViewport = false;
      pointerTarget.set(0, 0);
      pointerNdc.set(2, 2);
    };

    const onCanvasClick = () => {
      if (!enableClickCycle || !isHoveringPrism || transitionState.active)
        return;
      const currentIndex = MODE_SEQUENCE.indexOf(currentMode.value);
      const nextMode = MODE_SEQUENCE[(currentIndex + 1) % MODE_SEQUENCE.length];
      setModeInternal(nextMode, true, { manual: true });
    };

    loadPrismShapeAssets()
      .then((shapes) => {
        if (destroyed) return;
        assetState.status = "ready";
        assetState.shapes = shapes;
        assetState.availableShapes = new Set(buildAvailableShapeList(shapes));

        if (!assetState.availableShapes.has(currentShape.value)) {
          const nextShape = DEFAULT_SHAPE_ID;
          if (currentShape.value !== nextShape) {
            currentShape.value = nextShape;
            emitShape(nextShape);
          }
          markExpressionCustom(true);
        }

        applyShapeGeometry(currentShape.value);
        emitShapeAssets();
      })
      .catch(() => {
        if (destroyed) return;
        assetState.status = "failed";
        assetState.shapes = {};
        assetState.availableShapes = new Set(getFallbackAvailableShapes());

        if (currentShape.value !== DEFAULT_SHAPE_ID) {
          currentShape.value = DEFAULT_SHAPE_ID;
          emitShape(DEFAULT_SHAPE_ID);
          markExpressionCustom(true);
        }

        applyShapeGeometry(DEFAULT_SHAPE_ID);
        emitShapeAssets();
      });

    const onResize = () => {
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      viewport.dpr = Math.min(
        window.devicePixelRatio || 1,
        coarsePointer ? 1.2 : 1.5
      );

      renderer.setPixelRatio(viewport.dpr);
      renderer.setSize(viewport.width, viewport.height, false);

      camera.aspect = viewport.width / viewport.height;
      camera.updateProjectionMatrix();

      composer.setPixelRatio(viewport.dpr);
      composer.setSize(viewport.width, viewport.height);
      bloomPass.setSize(viewport.width, viewport.height);
      renderTarget.setSize(
        Math.max(1, Math.floor(viewport.width * viewport.dpr)),
        Math.max(1, Math.floor(viewport.height * viewport.dpr))
      );
      setFxaaResolution(
        fxaaPass,
        viewport.width,
        viewport.height,
        viewport.dpr
      );
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;
      const preset = MODE_PRESETS[currentMode.value] ?? MODE_PRESETS.idle;
      const colorAlpha = smoothLerp(4.5, delta);

      for (const key of Object.keys(configCurrent)) {
        configCurrent[key] = MathUtils.damp(
          configCurrent[key],
          configTarget[key],
          6,
          delta
        );
      }

      for (const key of Object.keys(audioCurrent)) {
        audioCurrent[key] = MathUtils.damp(
          audioCurrent[key],
          audioTarget[key],
          key === "playing" ? 10 : 8,
          delta
        );
      }

      runtime.stateColor.lerp(preset.color, colorAlpha);
      runtime.accentColor.lerp(preset.accent, colorAlpha);
      runtime.bloomStrength = MathUtils.damp(
        runtime.bloomStrength,
        preset.bloom,
        4,
        delta
      );
      runtime.coreOpacity = MathUtils.damp(
        runtime.coreOpacity,
        preset.coreOpacity,
        4,
        delta
      );
      runtime.beamOpacity = MathUtils.damp(
        runtime.beamOpacity,
        preset.beamOpacity,
        4,
        delta
      );
      runtime.floorOpacity = MathUtils.damp(
        runtime.floorOpacity,
        preset.floorOpacity,
        4,
        delta
      );
      runtime.haloOpacity = MathUtils.damp(
        runtime.haloOpacity,
        preset.haloOpacity,
        4,
        delta
      );
      runtime.pointIntensity = MathUtils.damp(
        runtime.pointIntensity,
        preset.pointIntensity,
        4,
        delta
      );
      runtime.spotIntensity = MathUtils.damp(
        runtime.spotIntensity,
        preset.spotIntensity,
        4,
        delta
      );
      runtime.particleOpacity = MathUtils.damp(
        runtime.particleOpacity,
        preset.particleOpacity,
        4,
        delta
      );
      runtime.responseMix = MathUtils.damp(
        runtime.responseMix,
        currentMode.value === "response" ? 1 : 0,
        6,
        delta
      );
      const transformSpeedFactor = configCurrent.transformSpeed;
      const transformForceFactor = configCurrent.transformForce;

      if (transitionState.active) {
        const transitionDuration =
          (reducedMotion ? 1.18 : 1.56) /
          Math.max(transformSpeedFactor, CONFIG_LIMITS.transformSpeed[0]);

        transitionState.elapsed += delta;
        transitionState.progress = MathUtils.clamp(
          transitionState.elapsed / transitionDuration,
          0,
          1
        );

        if (
          !transitionState.targetInstalled &&
          transitionState.progress >= 0.52
        ) {
          applyShapeGeometry(transitionState.toShape);
          transitionState.targetInstalled = true;
        }

        if (transitionState.progress < 0.18) {
          setTransitionPhase("prebreak");
        } else if (transitionState.progress < 0.52) {
          setTransitionPhase("explode");
        } else if (transitionState.progress < 0.88) {
          setTransitionPhase("reform");
        } else {
          setTransitionPhase("settle");
        }
      } else {
        transitionState.progress = 0;
      }

      const transitionActive = transitionState.active;
      const transitionProgress = transitionState.progress;
      const transitionPhase = transitionState.phase;
      const transitionEnergy = transitionActive
        ? Math.sin(transitionProgress * Math.PI)
        : 0;
      const intactVisible =
        !transitionActive ||
        transitionPhase === "prebreak" ||
        transitionPhase === "settle";

      setIntactVisible(intactVisible);

      const rawScroll = enableScroll
        ? window.scrollY /
          Math.max(
            document.documentElement.scrollHeight - window.innerHeight,
            1
          )
        : 0;
      scrollProgress = MathUtils.damp(
        scrollProgress,
        reducedMotion ? rawScroll * 0.3 : rawScroll,
        4,
        delta
      );

      pointer.x = MathUtils.damp(pointer.x, pointerTarget.x, 4, delta);
      pointer.y = MathUtils.damp(pointer.y, pointerTarget.y, 4, delta);

      raycaster.setFromCamera(pointerNdc, camera);
      isHoveringPrism =
        !transitionActive &&
        enablePointer &&
        pointerInsideViewport &&
        raycaster.intersectObject(prismBody, false).length > 0;
      runtime.hoverMix = MathUtils.damp(
        runtime.hoverMix,
        isHoveringPrism ? 1 : 0,
        7,
        delta
      );

      canvas.style.cursor =
        enableClickCycle && isHoveringPrism && !transitionActive
          ? "pointer"
          : "default";

      const glowFactor = configCurrent.glow;
      const motionFactor = configCurrent.motion;
      const reflectionFactor = MathUtils.clamp(
        configCurrent.reflections,
        0.2,
        1.8
      );
      const particleFactor = configCurrent.particles;
      const hoverFactor = configCurrent.hover;
      const hoverMix = runtime.hoverMix * hoverFactor;
      const manualSpinX = configCurrent.spinX;
      const manualSpinY = configCurrent.spinY;
      const manualSpinZ = configCurrent.spinZ;
      const zoomFactor = configCurrent.zoom;
      const speedFactor = configCurrent.speed;
      const tiltFactor = configCurrent.tilt;
      const attentionFactor = configCurrent.attention;
      const anticipationFactor = configCurrent.anticipation;
      const settleFactor = configCurrent.settle;
      const breakupFactor = configCurrent.breakup;
      const breakupPulseFactor = configCurrent.breakupPulse;
      const musicMixFactor = configCurrent.musicMix;
      const musicPulseFactor = configCurrent.musicPulse;
      const musicMotionFactor = configCurrent.musicMotion;
      const musicShimmerFactor = configCurrent.musicShimmer;
      const musicBreakupFactor = configCurrent.musicBreakup;
      const lookMix = MathUtils.clamp(configCurrent.look, 0, 1);
      const reflectionMix = reflectionFactor / 2;
      const breakupAmount = breakupFactor * MathUtils.lerp(0.08, 0.16, lookMix);
      const breakupPulseMotion =
        breakupPulseFactor * Math.max(motionFactor, 0.08);
      const motionStyle = MathUtils.lerp(
        LOOK_STYLES.studio.motionSpeed,
        LOOK_STYLES.artifact.motionSpeed,
        lookMix
      );
      const hoverLift = MathUtils.lerp(
        LOOK_STYLES.studio.hoverLift,
        LOOK_STYLES.artifact.hoverLift,
        lookMix
      );
      const beamBoost = MathUtils.lerp(
        LOOK_STYLES.studio.beamBoost,
        LOOK_STYLES.artifact.beamBoost,
        lookMix
      );
      const haloBoost = MathUtils.lerp(
        LOOK_STYLES.studio.haloBoost,
        LOOK_STYLES.artifact.haloBoost,
        lookMix
      );
      const floorBoost = MathUtils.lerp(
        LOOK_STYLES.studio.floorBoost,
        LOOK_STYLES.artifact.floorBoost,
        lookMix
      );
      const particleBoost = MathUtils.lerp(
        LOOK_STYLES.studio.particleBoost,
        LOOK_STYLES.artifact.particleBoost,
        lookMix
      );
      const pointerDistance = Math.min(1, Math.hypot(pointer.x, pointer.y));
      const musicDrive =
        audioCurrent.active *
        audioCurrent.playing *
        Math.max(0, musicMixFactor);
      const musicBass = audioCurrent.bass * musicDrive;
      const musicMids = audioCurrent.mids * musicDrive;
      const musicTreble = audioCurrent.treble * musicDrive;
      const musicTransient = audioCurrent.transient * musicDrive;
      const musicPulse = audioCurrent.pulse * musicDrive * musicPulseFactor;
      const musicSparkle =
        (musicTreble * 0.68 + musicTransient * 0.42) * musicShimmerFactor;
      const musicBounce =
        musicBass * 0.05 * musicMotionFactor + musicPulse * 0.035;
      const musicRingMix = MathUtils.clamp(
        musicTransient * 0.76 + musicTreble * 0.18 * musicShimmerFactor,
        0,
        1.5
      );
      const musicPhase =
        elapsed * (1.8 + musicMotionFactor * 0.9) +
        audioCurrent.progress * Math.PI * 4;
      const breakupDrive = Math.max(0, musicBreakupFactor);
      const danceBreakMix = MathUtils.smoothstep(breakupDrive, 0.42, 1.08);
      const beatBreakPattern = Math.pow(
        Math.max(0, Math.sin(musicPhase * 0.92 - 0.35)),
        1.8
      );
      const trebleBreakPattern =
        (Math.sin(musicPhase * 3.6 + 0.8) + 1) *
        0.5 *
        ((Math.cos(musicPhase * 5.2 - 0.3) + 1) * 0.5);
      const musicBreakupAmount =
        (musicTransient *
          (0.004 + beatBreakPattern * (0.008 + danceBreakMix * 0.01)) +
          musicTreble * (0.002 + trebleBreakPattern * 0.005) +
          musicBass * 0.0024 * danceBreakMix) *
        (0.35 + breakupDrive * 0.92) *
        musicMotionFactor;
      const musicBreakupPulse =
        (musicTransient *
          (0.085 + beatBreakPattern * (0.06 + danceBreakMix * 0.08)) +
          musicTreble * (0.024 + trebleBreakPattern * 0.04) +
          musicBass * 0.018 * danceBreakMix) *
        (0.42 + breakupDrive * 0.9) *
        musicMotionFactor;
      const attentionTarget =
        pointerInsideViewport && !transitionActive
          ? Math.min(1, 0.16 + pointerDistance * 0.82 + runtime.hoverMix * 0.2)
          : 0;
      runtime.attentionMix = MathUtils.damp(
        runtime.attentionMix,
        attentionTarget,
        5,
        delta
      );
      const attentionMix = runtime.attentionMix * attentionFactor;
      const prebreakProgress = transitionActive
        ? MathUtils.clamp(transitionProgress / 0.18, 0, 1)
        : 0;
      const anticipationPulse =
        transitionActive && transitionPhase === "prebreak"
          ? Math.sin(prebreakProgress * Math.PI)
          : 0;
      const anticipationTighten = anticipationPulse * anticipationFactor;
      choreographyState.settleImpulse = MathUtils.damp(
        choreographyState.settleImpulse,
        0,
        4.8,
        delta
      );
      choreographyState.settleTime +=
        delta * (4.8 + Math.max(0, settleFactor) * 1.6);
      const liveSettleProgress =
        transitionActive && transitionPhase === "settle"
          ? MathUtils.smoothstep(transitionProgress, 0.88, 1)
          : 0;
      const liveSettleWave =
        Math.sin(liveSettleProgress * Math.PI * 1.12) *
        (1 - liveSettleProgress * 0.28) *
        settleFactor;
      const postSettleWave =
        Math.sin(choreographyState.settleTime + 0.8) *
        choreographyState.settleImpulse *
        settleFactor;
      const settleWave = liveSettleWave * 0.55 + postSettleWave;

      renderer.toneMappingExposure =
        (minimalStage ? 0.92 : 1) *
        MathUtils.lerp(0.98, 1.02, lookMix) *
        configCurrent.exposure *
        (1 + transitionEnergy * 0.03 + attentionMix * 0.015);

      tempColors.glass.lerpColors(
        LOOK_STYLES.studio.glassColor,
        LOOK_STYLES.artifact.glassColor,
        lookMix
      );
      tempColors.glassAttenuation.lerpColors(
        LOOK_STYLES.studio.glassAttenuation,
        LOOK_STYLES.artifact.glassAttenuation,
        lookMix
      );
      tempColors.inner.lerpColors(
        LOOK_STYLES.studio.innerColor,
        LOOK_STYLES.artifact.innerColor,
        lookMix
      );
      tempColors.innerAttenuation.lerpColors(
        LOOK_STYLES.studio.innerAttenuation,
        LOOK_STYLES.artifact.innerAttenuation,
        lookMix
      );
      tempColors.wire.lerpColors(
        runtime.accentColor,
        runtime.stateColor,
        0.3 + lookMix * 0.45
      );
      tempColors.core.lerpColors(
        LOOK_STYLES.studio.coreColor,
        LOOK_STYLES.artifact.coreColor,
        lookMix
      );
      tempColors.core.lerp(runtime.accentColor, 0.3 + lookMix * 0.38);
      tempColors.aura.lerpColors(
        LOOK_STYLES.studio.auraColor,
        LOOK_STYLES.artifact.auraColor,
        lookMix
      );
      tempColors.aura.lerp(runtime.stateColor, 0.24 + lookMix * 0.4);
      tempColors.fill.lerpColors(
        LOOK_STYLES.studio.fillColor,
        LOOK_STYLES.artifact.fillColor,
        lookMix
      );
      tempColors.fill.lerp(runtime.stateColor, 0.18 + lookMix * 0.34);
      tempColors.rim.lerpColors(
        LOOK_STYLES.studio.rimColor,
        LOOK_STYLES.artifact.rimColor,
        lookMix
      );
      tempColors.rim.lerp(runtime.accentColor, 0.24 + lookMix * 0.38);
      tempColors.top.lerpColors(
        LOOK_STYLES.studio.topColor,
        LOOK_STYLES.artifact.topColor,
        lookMix
      );
      tempColors.top.lerp(runtime.accentColor, 0.14 + lookMix * 0.3);
      tempColors.side.lerpColors(
        LOOK_STYLES.studio.sideColor,
        LOOK_STYLES.artifact.sideColor,
        lookMix
      );
      tempColors.side.lerp(runtime.stateColor, 0.16 + lookMix * 0.42);
      tempColors.floor.lerpColors(
        LOOK_STYLES.studio.floorColor,
        LOOK_STYLES.artifact.floorColor,
        lookMix
      );
      tempColors.floor.lerp(runtime.stateColor, 0.08 + lookMix * 0.22);
      tempColors.stageDisc.lerpColors(
        LOOK_STYLES.studio.stageDiscColor,
        LOOK_STYLES.artifact.stageDiscColor,
        lookMix
      );
      tempColors.pedestal.lerpColors(
        LOOK_STYLES.studio.pedestalColor,
        LOOK_STYLES.artifact.pedestalColor,
        lookMix
      );
      tempColors.particle.lerpColors(
        LOOK_STYLES.studio.particleColor,
        LOOK_STYLES.artifact.particleColor,
        lookMix
      );
      tempColors.particle.lerp(runtime.accentColor, 0.18 + lookMix * 0.26);
      breakupTransform.update({
        amount: transitionActive
          ? 0
          : breakupAmount +
            musicBass * 0.01 * musicMotionFactor +
            musicBreakupAmount,
        pulse: transitionActive
          ? 0
          : breakupPulseMotion +
            musicTransient * 0.14 * musicMotionFactor +
            musicBreakupPulse,
        elapsed,
        speed: speedFactor,
      });

      prismMaterial.color.copy(tempColors.glass);
      prismMaterial.attenuationColor.copy(tempColors.glassAttenuation);
      prismMaterial.thickness = MathUtils.lerp(
        LOOK_STYLES.studio.thickness,
        LOOK_STYLES.artifact.thickness,
        lookMix
      );
      prismMaterial.ior = MathUtils.lerp(
        LOOK_STYLES.studio.ior,
        LOOK_STYLES.artifact.ior,
        lookMix
      );
      prismMaterial.attenuationDistance = MathUtils.lerp(
        LOOK_STYLES.studio.attenuationDistance,
        LOOK_STYLES.artifact.attenuationDistance,
        lookMix
      );
      prismMaterial.specularIntensity =
        MathUtils.lerp(0.94, 1.22, lookMix) +
        hoverMix * 0.08 +
        attentionMix * 0.05 +
        musicSparkle * 0.06;

      prismMaterial.roughness = MathUtils.lerp(
        MathUtils.lerp(
          LOOK_STYLES.studio.prismRoughnessMax,
          LOOK_STYLES.artifact.prismRoughnessMax,
          lookMix
        ),
        MathUtils.lerp(
          LOOK_STYLES.studio.prismRoughnessMin,
          LOOK_STYLES.artifact.prismRoughnessMin,
          lookMix
        ),
        reflectionMix
      );
      prismMaterial.envMapIntensity = MathUtils.lerp(
        MathUtils.lerp(
          LOOK_STYLES.studio.envMapMin,
          LOOK_STYLES.artifact.envMapMin,
          lookMix
        ) * (minimalStage ? 0.95 : 1),
        MathUtils.lerp(
          LOOK_STYLES.studio.envMapMax,
          LOOK_STYLES.artifact.envMapMax,
          lookMix
        ) * (minimalStage ? 0.92 : 0.82),
        reflectionMix
      );
      prismMaterial.clearcoatRoughness = MathUtils.lerp(
        MathUtils.lerp(
          LOOK_STYLES.studio.clearcoatRoughnessMax,
          LOOK_STYLES.artifact.clearcoatRoughnessMax,
          lookMix
        ),
        MathUtils.lerp(
          LOOK_STYLES.studio.clearcoatRoughnessMin,
          LOOK_STYLES.artifact.clearcoatRoughnessMin,
          lookMix
        ),
        reflectionMix
      );
      prismMaterial.emissive.copy(runtime.stateColor);

      innerShellMaterial.color.copy(tempColors.inner);
      innerShellMaterial.attenuationColor.copy(tempColors.innerAttenuation);
      innerShellMaterial.thickness = MathUtils.lerp(0.7, 1.08, lookMix);
      innerShellMaterial.roughness = MathUtils.lerp(0.008, 0.024, lookMix);
      innerShellMaterial.ior = MathUtils.lerp(1.08, 1.16, lookMix);
      innerShellMaterial.envMapIntensity = MathUtils.lerp(
        MathUtils.lerp(
          LOOK_STYLES.studio.innerEnvMapMin,
          LOOK_STYLES.artifact.innerEnvMapMin,
          lookMix
        ),
        MathUtils.lerp(
          LOOK_STYLES.studio.innerEnvMapMax,
          LOOK_STYLES.artifact.innerEnvMapMax,
          lookMix
        ),
        reflectionMix
      );
      innerShellMaterial.opacity =
        MathUtils.lerp(
          LOOK_STYLES.studio.innerOpacityBase,
          LOOK_STYLES.artifact.innerOpacityBase,
          lookMix
        ) +
        reflectionFactor *
          MathUtils.lerp(
            LOOK_STYLES.studio.innerOpacityReflection,
            LOOK_STYLES.artifact.innerOpacityReflection,
            lookMix
          ) +
        hoverMix * 0.04;

      wireframeMaterial.color.copy(tempColors.wire);
      wireframeMaterial.opacity =
        MathUtils.lerp(
          LOOK_STYLES.studio.wireOpacityBase,
          LOOK_STYLES.artifact.wireOpacityBase,
          lookMix
        ) +
        glowFactor *
          MathUtils.lerp(
            LOOK_STYLES.studio.wireOpacityGlow,
            LOOK_STYLES.artifact.wireOpacityGlow,
            lookMix
          ) +
        hoverMix * 0.12 -
        breakupFactor * 0.16;

      coreMaterial.color.copy(tempColors.core);
      coreAuraMaterial.color.copy(tempColors.aura);
      keyLight.color.copy(tempColors.wire);
      fillLight.color.copy(tempColors.fill);
      rimLight.color.copy(tempColors.rim);
      topSpot.color.copy(tempColors.top);
      sideSpot.color.copy(tempColors.side);
      rearHaloMaterial.color.copy(tempColors.aura);
      floorGlowMaterial.color.copy(tempColors.floor);
      stageDiscMaterial.color.copy(tempColors.stageDisc);
      pedestalMaterial.color.copy(tempColors.pedestal);
      pedestalMaterial.roughness = MathUtils.lerp(
        LOOK_STYLES.studio.pedestalRoughness,
        LOOK_STYLES.artifact.pedestalRoughness,
        lookMix
      );
      pedestalMaterial.metalness = MathUtils.lerp(
        LOOK_STYLES.studio.pedestalMetalness,
        LOOK_STYLES.artifact.pedestalMetalness,
        lookMix
      );
      pedestalMaterial.clearcoat = MathUtils.lerp(
        LOOK_STYLES.studio.pedestalClearcoat,
        LOOK_STYLES.artifact.pedestalClearcoat,
        lookMix
      );
      particleField.material.color.copy(tempColors.particle);
      particleField.material.opacity =
        runtime.particleOpacity * particleFactor * particleBoost +
        musicSparkle * 0.08;
      particleField.material.size =
        (coarsePointer ? 0.028 : 0.022) *
        (0.84 + particleFactor * 0.28) *
        MathUtils.lerp(
          LOOK_STYLES.studio.particleSizeBoost,
          LOOK_STYLES.artifact.particleSizeBoost,
          lookMix
        ) *
        (1 + musicSparkle * 0.08);

      beams.forEach(({ material }, index) => {
        material.color.copy(index === 0 ? tempColors.aura : tempColors.wire);
        material.opacity =
          runtime.beamOpacity *
          (index === 0 ? 1 : 0.72) *
          (1 + runtime.responseMix * 0.16) *
          glowFactor *
          beamBoost;
      });

      rearHaloMaterial.opacity = minimalStage
        ? 0
        : runtime.haloOpacity *
            (1 + runtime.responseMix * 0.28) *
            glowFactor *
            haloBoost +
          musicSparkle * 0.02;
      floorGlowMaterial.opacity = minimalStage
        ? MathUtils.lerp(
            LOOK_STYLES.studio.floorMinimalOpacity,
            LOOK_STYLES.artifact.floorMinimalOpacity,
            lookMix
          ) *
            glowFactor *
            floorBoost +
          musicBass * 0.014
        : runtime.floorOpacity *
            MathUtils.lerp(
              LOOK_STYLES.studio.floorHeroOpacity,
              LOOK_STYLES.artifact.floorHeroOpacity,
              lookMix
            ) *
            (1 + runtime.responseMix * 0.36) *
            glowFactor *
            floorBoost +
          musicBass * 0.024;
      stageDiscMaterial.opacity = minimalStage
        ? 0.06
        : MathUtils.lerp(
            LOOK_STYLES.studio.stageDiscOpacity,
            LOOK_STYLES.artifact.stageDiscOpacity,
            lookMix
          ) +
          runtime.floorOpacity * 0.06;
      shadowMaterial.opacity =
        MathUtils.lerp(
          minimalStage
            ? LOOK_STYLES.studio.shadowBaseMinimal
            : LOOK_STYLES.studio.shadowBaseHero,
          minimalStage
            ? LOOK_STYLES.artifact.shadowBaseMinimal
            : LOOK_STYLES.artifact.shadowBaseHero,
          lookMix
        ) +
        hoverMix * 0.04;

      floorRings.forEach(({ material, mesh, baseOpacity }, index) => {
        material.color.copy(tempColors.wire);
        material.opacity = mesh.visible
          ? baseOpacity *
            runtime.floorOpacity *
            (1 + runtime.responseMix * (0.5 - index * 0.08)) *
            glowFactor *
            floorBoost
          : 0;
        const ringScale = 1 + runtime.responseMix * (0.08 + index * 0.04);
        mesh.scale.setScalar(ringScale);
      });

      responseRings.forEach(
        ({ mesh, material, baseScale, baseOpacity }, index) => {
          const ringPulse = (Math.sin(elapsed * 3.1 - index * 0.65) + 1) * 0.5;
          const reactiveRingMix = Math.max(runtime.responseMix, musicRingMix);
          mesh.visible = reactiveRingMix > 0.02;
          mesh.quaternion.copy(camera.quaternion);
          mesh.scale.setScalar(
            baseScale + reactiveRingMix * (ringPulse * 0.44 + index * 0.06)
          );
          material.color.copy(tempColors.aura);
          material.opacity =
            reactiveRingMix *
            baseOpacity *
            (1 - ringPulse * 0.55) *
            glowFactor *
            MathUtils.lerp(0.78, 1.18, lookMix);
        }
      );

      if (transitionState.outgoingActor) {
        const outgoingVisible =
          transitionActive && transitionPhase === "explode";
        transitionState.outgoingActor.group.visible = outgoingVisible;

        if (outgoingVisible) {
          transitionState.outgoingActor.update({
            delta,
            elapsed,
            progress: MathUtils.smoothstep(transitionProgress, 0.18, 0.52),
            transformForce: transformForceFactor,
            dimmed: false,
            surfaceColor: tempColors.glass,
            wireColor: tempColors.wire,
            auraColor: tempColors.aura,
            coreColor: tempColors.core,
          });
        }
      }

      if (transitionState.incomingActor) {
        const incomingVisible =
          transitionActive && transitionPhase === "reform";
        transitionState.incomingActor.group.visible = incomingVisible;

        if (incomingVisible) {
          transitionState.incomingActor.update({
            delta,
            elapsed,
            progress: 1 - MathUtils.smoothstep(transitionProgress, 0.52, 0.88),
            transformForce: transformForceFactor,
            dimmed: false,
            surfaceColor: tempColors.glass,
            wireColor: tempColors.wire,
            auraColor: tempColors.aura,
            coreColor: tempColors.core,
          });
        }
      }

      const breathCycle =
        (Math.sin((elapsed / 10) * Math.PI * 2 - Math.PI / 2) + 1) * 0.5;
      const pulse = breathCycle * preset.pulseAmplitude;
      const elegance = reducedMotion ? 0.004 : 0.009;
      const breathScale = 1 + elegance * pulse + hoverMix * 0.024;
      const scaleBase = breathScale + settleWave * 0.024 + musicPulse * 0.026;
      const anticipationScale = anticipationTighten * 0.05;

      prismAnchor.scale.set(
        scaleBase * (1 - anticipationScale),
        scaleBase * (1 + anticipationScale * 0.44),
        scaleBase * (1 - anticipationScale * 0.82)
      );
      prismMaterial.emissiveIntensity =
        0.08 +
        lookMix * 0.02 +
        pulse *
          0.42 *
          glowFactor *
          MathUtils.lerp(
            LOOK_STYLES.studio.emissiveBoost,
            LOOK_STYLES.artifact.emissiveBoost,
            lookMix
          ) +
        runtime.responseMix * 0.12 * glowFactor +
        hoverMix * 0.08 +
        transitionEnergy * 0.12 +
        attentionMix * 0.05 +
        anticipationTighten * 0.06 +
        Math.max(settleWave, 0) * 0.04 +
        musicPulse * 0.12 +
        musicSparkle * 0.04;
      coreMaterial.opacity =
        runtime.coreOpacity *
          glowFactor *
          MathUtils.lerp(
            LOOK_STYLES.studio.coreOpacityBoost,
            LOOK_STYLES.artifact.coreOpacityBoost,
            lookMix
          ) +
        runtime.responseMix * 0.06 +
        hoverMix * 0.06 +
        transitionEnergy * 0.08 +
        attentionMix * 0.05 +
        musicBass * 0.06 +
        musicTransient * 0.05;
      coreAuraMaterial.opacity =
        0.05 * glowFactor +
        pulse *
          0.14 *
          glowFactor *
          MathUtils.lerp(
            LOOK_STYLES.studio.auraOpacityBoost,
            LOOK_STYLES.artifact.auraOpacityBoost,
            lookMix
          ) +
        runtime.responseMix * 0.08 +
        hoverMix * 0.06 +
        transitionEnergy * 0.1 +
        attentionMix * 0.04 +
        Math.max(settleWave, 0) * 0.06 +
        musicPulse * 0.08 +
        musicSparkle * 0.05;
      coreMesh.scale.setScalar(
        coreBaseScale *
          (MathUtils.lerp(0.94, 1.16, lookMix) +
            pulse * 0.1 +
            runtime.responseMix * 0.12 +
            hoverMix * 0.04 +
            breakupFactor * 0.05 +
            transitionEnergy * 0.08 +
            attentionMix * 0.05 +
            settleWave * 0.04 +
            musicPulse * 0.07)
      );
      coreAura.scale.setScalar(
        auraBaseScale *
          (MathUtils.lerp(0.96, 1.22, lookMix) +
            pulse * 0.18 +
            runtime.responseMix * 0.16 +
            hoverMix * 0.06 +
            breakupFactor * 0.08 +
            transitionEnergy * 0.12 +
            attentionMix * 0.06 +
            settleWave * 0.06 +
            musicPulse * 0.1 +
            musicSparkle * 0.05)
      );
      keyLight.intensity =
        (runtime.pointIntensity +
          pulse * 1.8 * glowFactor +
          hoverMix * 0.8 +
          transitionEnergy * 0.7 +
          attentionMix * 0.42 +
          anticipationTighten * 0.3 +
          musicPulse * 0.88) *
        MathUtils.lerp(0.9, 1.1, lookMix);
      fillLight.intensity =
        MathUtils.lerp(
          minimalStage
            ? LOOK_STYLES.studio.fillIntensityMinimal
            : LOOK_STYLES.studio.fillIntensityHero,
          minimalStage
            ? LOOK_STYLES.artifact.fillIntensityMinimal
            : LOOK_STYLES.artifact.fillIntensityHero,
          lookMix
        ) +
        runtime.responseMix * 0.18 +
        hoverMix * 0.12 +
        transitionEnergy * 0.18 +
        attentionMix * 0.08;
      rimLight.intensity =
        MathUtils.lerp(
          minimalStage
            ? LOOK_STYLES.studio.rimIntensityMinimal
            : LOOK_STYLES.studio.rimIntensityHero,
          minimalStage
            ? LOOK_STYLES.artifact.rimIntensityMinimal
            : LOOK_STYLES.artifact.rimIntensityHero,
          lookMix
        ) +
        runtime.responseMix * 0.24 +
        hoverMix * 0.16 +
        transitionEnergy * 0.22 +
        attentionMix * 0.12 +
        musicSparkle * 0.24;
      topSpot.intensity =
        runtime.spotIntensity *
        glowFactor *
        MathUtils.lerp(
          LOOK_STYLES.studio.topSpotBoost,
          LOOK_STYLES.artifact.topSpotBoost,
          lookMix
        ) *
        (1 + anticipationTighten * 0.18);
      sideSpot.intensity =
        runtime.spotIntensity *
        glowFactor *
        MathUtils.lerp(
          LOOK_STYLES.studio.sideSpotBoost,
          LOOK_STYLES.artifact.sideSpotBoost,
          lookMix
        ) *
        (1 + attentionMix * 0.14);
      bloomPass.strength =
        runtime.bloomStrength *
          configCurrent.bloom *
          MathUtils.lerp(0.88, 1.06, lookMix) +
        pulse * 0.08 * glowFactor +
        runtime.responseMix * 0.12 * glowFactor +
        transitionEnergy * 0.1 * glowFactor +
        anticipationTighten * 0.04 * glowFactor +
        Math.max(settleWave, 0) * 0.03 * glowFactor +
        musicPulse * 0.08 * glowFactor +
        musicSparkle * 0.06 * glowFactor;

      const spin = elapsed * preset.rotationSpeed * motionFactor * motionStyle;
      const manualSpinScale = reducedMotion ? 0.24 : 0.42;
      const spinXOffset =
        elapsed * manualSpinX * manualSpinScale * motionFactor * speedFactor;
      const spinYOffset =
        elapsed *
        manualSpinY *
        (manualSpinScale + 0.06) *
        motionFactor *
        speedFactor;
      const spinZOffset =
        elapsed *
        manualSpinZ *
        (manualSpinScale - 0.04) *
        motionFactor *
        speedFactor;
      const attentionPitch =
        pointer.y * MathUtils.lerp(0.028, 0.052, lookMix) * attentionMix;
      const attentionYaw =
        pointer.x * MathUtils.lerp(0.048, 0.084, lookMix) * attentionMix;
      const attentionRoll = pointer.x * -0.016 * attentionMix;
      const settlePitch = settleWave * 0.045;
      const settleYaw = settleWave * 0.09;
      const settleRoll = settleWave * 0.03;
      const musicPitch =
        Math.sin(musicPhase) * musicBass * 0.034 * musicMotionFactor -
        musicTransient * 0.015;
      const musicYaw =
        Math.cos(musicPhase * 0.78) * musicMids * 0.048 * musicMotionFactor +
        musicPulse * 0.018;
      const musicRoll =
        Math.sin(musicPhase * 1.92) * musicTreble * 0.038 * musicMotionFactor +
        musicTransient * 0.014;
      prismAnchor.rotation.x =
        -0.16 +
        spinXOffset +
        pointer.y * MathUtils.lerp(0.06, 0.09, lookMix) * tiltFactor +
        scrollProgress * 0.18 +
        hoverMix * 0.06 * tiltFactor +
        attentionPitch -
        anticipationTighten * 0.05 +
        settlePitch +
        musicPitch;
      prismAnchor.rotation.y =
        spin * speedFactor +
        spinYOffset +
        pointer.x * MathUtils.lerp(0.1, 0.16, lookMix) * tiltFactor +
        scrollProgress * 0.42 +
        hoverMix * 0.12 * tiltFactor +
        attentionYaw +
        anticipationTighten * 0.036 +
        settleYaw +
        musicYaw;
      prismAnchor.rotation.z =
        0.08 +
        spinZOffset +
        Math.sin(elapsed * 0.16) * MathUtils.lerp(0.014, 0.024, lookMix) +
        pointer.x * -0.03 * tiltFactor +
        runtime.responseMix * 0.015 +
        breakupPulseMotion * 0.008 +
        attentionRoll +
        anticipationTighten * 0.02 +
        settleRoll +
        musicRoll;
      prismWireframe.scale.setScalar(
        1.0015 +
          breakupFactor * 0.02 +
          musicBreakupAmount * 0.09 +
          musicBreakupPulse * 0.016
      );

      const jitterX =
        currentMode.value === "error"
          ? Math.sin(elapsed * 11) * preset.jitter
          : 0;
      const jitterY =
        currentMode.value === "error"
          ? Math.cos(elapsed * 8.2) * preset.jitter * 0.6
          : 0;
      const attentionShiftX = pointer.x * 0.08 * attentionMix;
      const attentionShiftY =
        pointerDistance * 0.01 * attentionMix -
        pointer.y * 0.018 * attentionMix;
      prismAnchor.position.set(
        basePrismPosition.x + jitterX + attentionShiftX,
        basePrismPosition.y +
          jitterY +
          hoverMix * hoverLift +
          attentionShiftY -
          anticipationTighten * 0.028 +
          settleWave * 0.04 +
          musicBounce,
        0
      );

      camera.position.x =
        MathUtils.lerp(0, 0.28, scrollProgress) +
        pointer.x * (enableScroll ? 0.18 : 0.08) * Math.max(0.35, tiltFactor);
      camera.position.y =
        MathUtils.lerp(minimalStage ? 0.08 : 0.12, -0.06, scrollProgress) +
        pointer.y * (enableScroll ? 0.1 : 0.06) * Math.max(0.35, tiltFactor);
      const baseCameraZ = MathUtils.lerp(
        enableScroll ? 6.5 : 5.1,
        2.45,
        scrollProgress
      );
      camera.position.z = baseCameraZ / zoomFactor;

      cameraLookAt.x = MathUtils.damp(
        cameraLookAt.x,
        pointer.x * (0.12 * tiltFactor + attentionMix * 0.05) +
          scrollProgress * 0.08,
        4,
        delta
      );
      cameraLookAt.y = MathUtils.damp(
        cameraLookAt.y,
        pointer.y * (0.04 * tiltFactor + attentionMix * 0.02) -
          scrollProgress * 0.05 +
          settleWave * 0.01,
        4,
        delta
      );
      camera.lookAt(cameraLookAt.x, cameraLookAt.y, 0);

      const positions = particleField.geometry.attributes.position.array;
      for (let i = 0; i < particleField.drift.length; i += 1) {
        const i3 = i * 3;
        const drift = particleField.drift[i];
        const phase = particleField.phase[i];
        const amplitude =
          (0.08 + particleFactor * 0.04 + musicSparkle * 0.03) *
          MathUtils.lerp(0.9, 1.08, lookMix);

        positions[i3] =
          particleField.basePositions[i3] +
          Math.cos(elapsed * drift + phase) * amplitude;
        positions[i3 + 1] =
          particleField.basePositions[i3 + 1] +
          Math.sin(elapsed * drift * 1.2 + phase) * (amplitude * 1.4);
        positions[i3 + 2] =
          particleField.basePositions[i3 + 2] +
          Math.sin(elapsed * drift * 0.7 + phase) * amplitude;
      }
      particleField.geometry.attributes.position.needsUpdate = true;
      particleField.points.rotation.y =
        elapsed * 0.01 * motionFactor * motionStyle * speedFactor +
        musicMids * 0.03 * musicMotionFactor;

      if (transitionActive && transitionProgress >= 1) {
        choreographyState.settleImpulse = Math.max(
          choreographyState.settleImpulse,
          (reducedMotion ? 0.2 : 0.34) + settleFactor * 0.5
        );
        choreographyState.settleTime = 0;
        transitionState.active = false;
        transitionState.elapsed = 0;
        transitionState.progress = 0;
        transitionState.fromShape = currentShape.value;
        transitionState.toShape = currentShape.value;
        transitionState.targetInstalled = true;
        disposeTransitionActors();
        setIntactVisible(true);
        setTransitionPhase(DEFAULT_TRANSITION_PHASE);
      }

      composer.render();
    };

    window.addEventListener("resize", onResize);
    if (enablePointer) {
      window.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      if (enableClickCycle) {
        canvas.addEventListener("click", onCanvasClick);
      }
    }

    animate();
    emitMode(currentMode.value);
    emitShape(currentShape.value);
    emitExpression(currentExpression.value);
    if (typeof onReady === "function") onReady();

    const destroy = () => {
      destroyed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      if (enablePointer) {
        window.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        if (enableClickCycle) {
          canvas.removeEventListener("click", onCanvasClick);
        }
      }
      canvas.style.cursor = "default";

      composer.dispose();
      renderTarget.dispose();
      pmremGenerator.dispose();
      environment.dispose();
      roomEnvironment.dispose?.();
      disposeTransitionActors();
      fallbackPrismGeometry.dispose();
      fallbackSourceMaterial.dispose();
      breakupTransform.geometry.dispose();
      wireframeGeometry.dispose();
      coreGeometry.dispose();
      auraGeometry.dispose();
      prismMaterial.dispose();
      innerShellMaterial.dispose();
      wireframeMaterial.dispose();
      coreMaterial.dispose();
      coreAuraMaterial.dispose();
      shadowMesh.geometry.dispose();
      shadowMaterial.dispose();
      pedestal.geometry.dispose();
      pedestalMaterial.dispose();
      stageDisc.geometry.dispose();
      stageDiscMaterial.dispose();
      floorGlow.geometry.dispose();
      floorGlowMaterial.dispose();
      rearHalo.geometry.dispose();
      rearHaloMaterial.dispose();
      floorRings.forEach(({ mesh, material }) => {
        mesh.geometry.dispose();
        material.dispose();
      });
      responseRings.forEach(({ mesh, material }) => {
        mesh.geometry.dispose();
        material.dispose();
      });
      beams.forEach(({ mesh, material }) => {
        mesh.geometry.dispose();
        material.dispose();
      });
      particleField.geometry.dispose();
      particleField.material.dispose();
      renderer.dispose();
    };

    return {
      destroy,
      setMode(nextMode) {
        setModeInternal(nextMode, true, { manual: true });
      },
      setShape(nextShape) {
        startShapeTransition(nextShape, true);
      },
      setExpression(nextExpression) {
        setExpressionInternal(nextExpression, true);
      },
      setConfig(nextConfig) {
        const merged = normalizeConfig({ ...configTarget, ...nextConfig });
        for (const [key, value] of Object.entries(merged)) {
          configTarget[key] = value;
        }
      },
      setAudioReactivity(nextAudio) {
        const safeAudio = nextAudio ?? {};
        audioTarget.active = MathUtils.clamp(safeAudio.active ?? 0, 0, 1);
        audioTarget.playing = MathUtils.clamp(safeAudio.playing ?? 0, 0, 1);
        audioTarget.level = MathUtils.clamp(safeAudio.level ?? 0, 0, 1.6);
        audioTarget.bass = MathUtils.clamp(safeAudio.bass ?? 0, 0, 1.6);
        audioTarget.mids = MathUtils.clamp(safeAudio.mids ?? 0, 0, 1.6);
        audioTarget.treble = MathUtils.clamp(safeAudio.treble ?? 0, 0, 1.6);
        audioTarget.transient = MathUtils.clamp(
          safeAudio.transient ?? 0,
          0,
          1.6
        );
        audioTarget.pulse = MathUtils.clamp(safeAudio.pulse ?? 0, 0, 1.6);
        audioTarget.progress = MathUtils.clamp(safeAudio.progress ?? 0, 0, 1);
      },
      getAvailableShapes() {
        return Array.from(assetState.availableShapes);
      },
    };
  } catch (error) {
    if (typeof onError === "function") onError(error);
    return fallbackController;
  }
}
