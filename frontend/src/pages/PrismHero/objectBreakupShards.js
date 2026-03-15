import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function subdivideTriangle([a, b, c]) {
  const ab = a.clone().lerp(b, 0.5);
  const bc = b.clone().lerp(c, 0.5);
  const ca = c.clone().lerp(a, 0.5);

  return [
    [a.clone(), ab.clone(), ca.clone()],
    [ab.clone(), b.clone(), bc.clone()],
    [ca.clone(), bc.clone(), c.clone()],
    [ab, bc, ca],
  ];
}

function averageVectors(points) {
  return points
    .reduce((total, point) => total.add(point), new Vector3())
    .multiplyScalar(1 / points.length);
}

function orthogonalDirection(axis) {
  const reference =
    Math.abs(axis.y) > 0.82 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  return new Vector3().crossVectors(axis, reference).normalize();
}

function buildShardGeometry(points, centroid) {
  const geometry = new BufferGeometry();
  const localVertices = points.flatMap((point) => {
    const localPoint = point.clone().sub(centroid);
    return [localPoint.x, localPoint.y, localPoint.z];
  });

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(localVertices, 3)
  );
  const merged = mergeVertices(geometry, 1e-4);
  geometry.dispose();
  merged.computeVertexNormals();
  return merged;
}

function getTrianglesPerShard(triangleCount, intensity) {
  const shardBudget = intensity === 2 ? 540 : 180;

  if (triangleCount <= shardBudget) {
    return 1;
  }

  return Math.max(2, Math.ceil(triangleCount / shardBudget));
}

function collectTriangles(object) {
  const triangles = [];
  object.updateWorldMatrix(true, true);

  const rootInverse = object.matrixWorld.clone().invert();
  let meshIndex = 0;

  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const geometry = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    const position = geometry.getAttribute("position");

    if (!position) {
      geometry.dispose();
      meshIndex += 1;
      return;
    }

    const localMatrix = rootInverse.clone().multiply(child.matrixWorld);

    for (let index = 0; index < position.count; index += 3) {
      const a = new Vector3()
        .fromBufferAttribute(position, index)
        .applyMatrix4(localMatrix);
      const b = new Vector3()
        .fromBufferAttribute(position, index + 1)
        .applyMatrix4(localMatrix);
      const c = new Vector3()
        .fromBufferAttribute(position, index + 2)
        .applyMatrix4(localMatrix);

      const normal = new Vector3().crossVectors(
        b.clone().sub(a),
        c.clone().sub(a)
      );

      if (normal.lengthSq() === 0) {
        continue;
      }

      normal.normalize();

      triangles.push({
        centroid: averageVectors([a, b, c]),
        meshIndex,
        normal,
        vertices: [a, b, c],
      });
    }

    geometry.dispose();
    meshIndex += 1;
  });

  return triangles;
}

export function createObjectBreakupShards(name, object, intensity = 1) {
  const baseTriangles = collectTriangles(object);
  const triangles =
    intensity === 2
      ? baseTriangles.flatMap((triangle) =>
          subdivideTriangle(triangle.vertices).map((vertices) => ({
            centroid: averageVectors(vertices),
            meshIndex: triangle.meshIndex,
            normal: triangle.normal.clone(),
            vertices,
          }))
        )
      : baseTriangles;

  if (!triangles.length) {
    return {
      radius: 1,
      shards: [],
      trianglesPerShard: 1,
    };
  }

  const allVertices = triangles.flatMap((triangle) => triangle.vertices);
  const center = averageVectors(allVertices);
  const radius = allVertices.reduce(
    (maxRadius, vertex) => Math.max(maxRadius, vertex.distanceTo(center)),
    0.001
  );
  const trianglesPerShard = getTrianglesPerShard(triangles.length, intensity);

  const sortedTriangles = [...triangles].sort((left, right) => {
    if (left.meshIndex !== right.meshIndex) {
      return left.meshIndex - right.meshIndex;
    }

    const leftDirection = left.centroid.clone().sub(center);
    const rightDirection = right.centroid.clone().sub(center);
    const leftTheta = Math.atan2(leftDirection.z, leftDirection.x);
    const rightTheta = Math.atan2(rightDirection.z, rightDirection.x);

    if (leftTheta !== rightTheta) {
      return leftTheta - rightTheta;
    }

    const leftPhi = Math.atan2(
      leftDirection.y,
      Math.hypot(leftDirection.x, leftDirection.z)
    );
    const rightPhi = Math.atan2(
      rightDirection.y,
      Math.hypot(rightDirection.x, rightDirection.z)
    );

    if (leftPhi !== rightPhi) {
      return leftPhi - rightPhi;
    }

    return leftDirection.lengthSq() - rightDirection.lengthSq();
  });

  const shardCount = Math.ceil(sortedTriangles.length / trianglesPerShard);
  const shards = Array.from({ length: shardCount }, (_, shardIndex) => {
    const start = shardIndex * trianglesPerShard;
    const batch = sortedTriangles.slice(start, start + trianglesPerShard);
    const shardVertices = batch.flatMap((triangle) => triangle.vertices);
    const centroid = averageVectors(shardVertices);
    const normal = batch
      .reduce((total, triangle) => total.add(triangle.normal), new Vector3())
      .normalize();

    if (normal.lengthSq() === 0) {
      normal.set(0, 1, 0);
    }

    const radialDirection = centroid.clone().sub(center);
    if (radialDirection.lengthSq() === 0) {
      radialDirection.copy(normal);
    } else {
      radialDirection.normalize();
    }

    const tangentDirection = new Vector3().crossVectors(
      normal,
      radialDirection
    );
    if (tangentDirection.lengthSq() === 0) {
      tangentDirection.copy(orthogonalDirection(normal));
    } else {
      tangentDirection.normalize();
    }

    const spinAxis = new Vector3().crossVectors(normal, tangentDirection);
    if (spinAxis.lengthSq() === 0) {
      spinAxis.copy(orthogonalDirection(normal));
    } else {
      spinAxis.normalize();
    }

    const driftDirection = normal
      .clone()
      .multiplyScalar(0.72)
      .add(radialDirection.clone().multiplyScalar(0.94))
      .normalize();
    const phase = shardCount <= 1 ? 0 : shardIndex / (shardCount - 1);

    return {
      key: `${name}-shard-${shardIndex}`,
      centroid,
      delay: phase * 0.18,
      driftDirection,
      geometry: buildShardGeometry(shardVertices, centroid),
      normal,
      phase,
      radialDirection,
      spinAxis,
      tangentDirection,
    };
  });

  return {
    radius,
    shards,
    trianglesPerShard,
  };
}
