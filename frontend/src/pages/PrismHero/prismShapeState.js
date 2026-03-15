export const PRISM_SHAPES = [
  {
    id: "tetrahedron",
    label: "Tetrahedron",
    nodeName: "Tetrahedron",
    description: "Four sharp triangular faces.",
    defaultExpression: "angry",
    targetRadius: 1.22,
  },
  {
    id: "cube",
    label: "Cube",
    nodeName: "Cube",
    description: "Six square faces with rigid symmetry.",
    defaultExpression: "constrained",
    targetRadius: 1.22,
  },
  {
    id: "octahedron",
    label: "Octahedron",
    nodeName: "Octahedron",
    description: "Eight triangular faces and clean focus.",
    defaultExpression: "focused",
    targetRadius: 1.22,
  },
  {
    id: "dodecahedron",
    label: "Dodecahedron",
    nodeName: "Dodecahedron",
    description: "Twelve pentagonal faces in balanced harmony.",
    defaultExpression: "friendly",
    targetRadius: 1.22,
  },
  {
    id: "icosahedron",
    label: "Icosahedron",
    nodeName: "Icosahedron",
    description: "Twenty faces for denser, brighter presence.",
    defaultExpression: "expansive",
    targetRadius: 1.22,
  },
  {
    id: "starTetrahedron",
    label: "Star Tetrahedron",
    nodeName: "StarTetrahedron",
    description: "Two interlocked tetrahedra in a mythic star.",
    defaultExpression: "mythic",
    targetRadius: 1.22,
  },
];

export const SHAPE_CATALOG = Object.freeze(
  PRISM_SHAPES.reduce((catalog, shape) => {
    catalog[shape.id] = shape;
    return catalog;
  }, {})
);

export const PRISM_SHAPE_IDS = Object.freeze(
  PRISM_SHAPES.map((shape) => shape.id)
);

export const CUSTOM_EXPRESSION_ID = "custom";

export const PRISM_EXPRESSIONS = [
  {
    id: "friendly",
    label: "Friendly",
    description: "Balanced, warm, and open.",
    shape: "dodecahedron",
    mode: "idle",
    configPatch: {
      glow: 0.92,
      motion: 0.74,
      breakup: 0.08,
      speed: 0.98,
      attention: 0.88,
      anticipation: 0.56,
      settle: 0.82,
      transformSpeed: 0.96,
      transformForce: 0.84,
    },
  },
  {
    id: "focused",
    label: "Focused",
    description: "Sharper, narrow, and work-oriented.",
    shape: "octahedron",
    mode: "thinking",
    configPatch: {
      glow: 0.82,
      motion: 0.64,
      breakup: 0.04,
      speed: 0.86,
      attention: 1.16,
      anticipation: 0.82,
      settle: 0.48,
      transformSpeed: 1.14,
      transformForce: 0.72,
    },
  },
  {
    id: "angry",
    label: "Angry",
    description: "Concentrated, sharp, and defensive.",
    shape: "tetrahedron",
    mode: "error",
    configPatch: {
      glow: 1.06,
      motion: 0.9,
      breakup: 0.16,
      speed: 1.14,
      attention: 1.38,
      anticipation: 1.22,
      settle: 0.62,
      transformSpeed: 1.2,
      transformForce: 1.18,
    },
  },
  {
    id: "constrained",
    label: "Constrained",
    description: "Rigid, calm, and boxed-in.",
    shape: "cube",
    mode: "idle",
    configPatch: {
      glow: 0.7,
      motion: 0.56,
      breakup: 0.03,
      speed: 0.76,
      attention: 0.42,
      anticipation: 0.66,
      settle: 0.38,
      transformSpeed: 0.82,
      transformForce: 0.66,
    },
  },
  {
    id: "expansive",
    label: "Expansive",
    description: "Growing, bright, and enthusiastic.",
    shape: "icosahedron",
    mode: "response",
    configPatch: {
      glow: 1.12,
      motion: 0.92,
      breakup: 0.12,
      speed: 1.08,
      attention: 0.96,
      anticipation: 0.72,
      settle: 1.16,
      transformSpeed: 0.92,
      transformForce: 1.08,
    },
  },
  {
    id: "mythic",
    label: "Mythic",
    description: "Ceremonial, dramatic, and larger-than-life.",
    shape: "starTetrahedron",
    mode: "response",
    configPatch: {
      glow: 1.18,
      motion: 0.98,
      breakup: 0.18,
      speed: 1.02,
      attention: 0.72,
      anticipation: 1.08,
      settle: 1.28,
      transformSpeed: 0.88,
      transformForce: 1.22,
    },
  },
];

export const EXPRESSION_PRESETS = Object.freeze(
  PRISM_EXPRESSIONS.reduce((catalog, expression) => {
    catalog[expression.id] = expression;
    return catalog;
  }, {})
);

export const PRISM_TRANSITION_PHASES = Object.freeze([
  "idle",
  "prebreak",
  "explode",
  "reform",
  "settle",
]);

export function isPrismShapeId(value) {
  return PRISM_SHAPE_IDS.includes(value);
}

export function isPrismExpressionId(value) {
  return Object.hasOwn(EXPRESSION_PRESETS, value);
}

export function getExpressionPreset(expressionId) {
  return EXPRESSION_PRESETS[expressionId] ?? null;
}
