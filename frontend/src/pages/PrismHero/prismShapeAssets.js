import { Box3, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PRISM_SHAPES, SHAPE_CATALOG } from "./prismShapeState";

const loader = new GLTFLoader();
const sourceMaterial = new MeshBasicMaterial({ color: 0xffffff });
let assetPromise = null;

function stripGeometryAttributes(geometry) {
  [
    "normal",
    "uv",
    "uv1",
    "uv2",
    "tangent",
    "color",
    "skinIndex",
    "skinWeight",
  ].forEach((attribute) => {
    if (geometry.getAttribute(attribute)) {
      geometry.deleteAttribute(attribute);
    }
  });
}

function mergeObjectGeometry(sourceObject) {
  const clone = sourceObject.clone(true);
  clone.updateWorldMatrix(true, true);

  const geometries = [];
  const inverseRootMatrix = clone.matrixWorld.clone().invert();
  const localMatrix = new Matrix4();

  clone.traverse((child) => {
    if (!child.isMesh) return;

    const nextGeometry = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    stripGeometryAttributes(nextGeometry);
    localMatrix.multiplyMatrices(inverseRootMatrix, child.matrixWorld);
    nextGeometry.applyMatrix4(localMatrix);
    geometries.push(nextGeometry);
  });

  if (!geometries.length) {
    return null;
  }

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) {
    return null;
  }

  stripGeometryAttributes(merged);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const box =
    merged.boundingBox ??
    new Box3().setFromBufferAttribute(merged.getAttribute("position"));
  const center = new Vector3();
  box.getCenter(center);
  merged.translate(-center.x, -center.y, -center.z);

  merged.computeBoundingSphere();
  const radius = Math.max(merged.boundingSphere?.radius ?? 1, 0.001);
  return { geometry: merged, radius };
}

function buildShapeAsset(shape, scene) {
  const sourceObject = scene.getObjectByName(shape.nodeName);
  if (!sourceObject) {
    return null;
  }

  const merged = mergeObjectGeometry(sourceObject);
  if (!merged) {
    return null;
  }

  const scale = shape.targetRadius / merged.radius;
  merged.geometry.scale(scale, scale, scale);
  merged.geometry.computeVertexNormals();
  merged.geometry.computeBoundingBox();
  merged.geometry.computeBoundingSphere();

  const sourceGeometry = merged.geometry.clone();
  sourceGeometry.computeBoundingBox();
  sourceGeometry.computeBoundingSphere();

  return {
    ...shape,
    geometry: merged.geometry,
    createSourceObject() {
      const sourceMesh = new Mesh(sourceGeometry.clone(), sourceMaterial);
      sourceMesh.name = shape.nodeName;
      return sourceMesh;
    },
  };
}

function buildShapeAssetMap(scene) {
  const assets = {};
  PRISM_SHAPES.forEach((shape) => {
    const asset = buildShapeAsset(shape, scene);
    if (asset) {
      assets[shape.id] = asset;
    }
  });
  return assets;
}

export async function loadPrismShapeAssets() {
  if (!assetPromise) {
    assetPromise = new Promise((resolve, reject) => {
      loader.load(
        "/models/platonic-solids.glb",
        (gltf) => {
          resolve(buildShapeAssetMap(gltf.scene));
        },
        undefined,
        reject
      );
    });
  }

  return assetPromise;
}

export function getFallbackAvailableShapes() {
  return ["dodecahedron"];
}

export function buildAvailableShapeList(assets = {}) {
  return PRISM_SHAPES.filter((shape) => assets[shape.id]).map(
    (shape) => shape.id
  );
}

export function getShapeCatalogItem(shapeId) {
  return SHAPE_CATALOG[shapeId] ?? SHAPE_CATALOG.dodecahedron;
}
