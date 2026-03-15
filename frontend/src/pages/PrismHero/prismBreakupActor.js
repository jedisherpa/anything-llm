import {
  AdditiveBlending,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
} from "three";
import { createObjectBreakupShards } from "./objectBreakupShards";

function stageProgress(progress, start, end) {
  return MathUtils.smoothstep(progress, start, end);
}

export function createPrismBreakupActor({ name, sourceObject, intensity = 1 }) {
  const shardSet = createObjectBreakupShards(name, sourceObject, intensity);
  sourceObject.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.dispose();
    }
  });
  const group = new Group();
  const carrier = new Group();
  const warmColor = new Color("#ffd59a");
  const coolColor = new Color("#97efff");
  const edgeColor = new Color();

  group.name = `${name}-breakup-actor`;
  group.visible = false;
  group.add(carrier);

  const surfaceMaterial = new MeshPhysicalMaterial({
    color: "#f6eee2",
    metalness: 0.08,
    roughness: 0.16,
    transmission: 0.18,
    thickness: 1.1,
    ior: 1.2,
    clearcoat: 0.48,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.9,
    side: DoubleSide,
    depthWrite: true,
    toneMapped: true,
  });

  const edgeMaterial = new LineBasicMaterial({
    color: coolColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const coreMaterial = new MeshBasicMaterial({
    color: coolColor,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const haloMaterial = new MeshBasicMaterial({
    color: warmColor,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const coreGeometry = new IcosahedronGeometry(
    Math.max(0.12, shardSet.radius * 0.16),
    2
  );
  const haloGeometry = new IcosahedronGeometry(
    Math.max(0.26, shardSet.radius * 0.34),
    1
  );

  const coreMesh = new Mesh(coreGeometry, coreMaterial);
  const haloMesh = new Mesh(haloGeometry, haloMaterial);
  carrier.add(haloMesh);
  carrier.add(coreMesh);

  const shardEntries = shardSet.shards.map((shard) => {
    const mesh = new Mesh(shard.geometry, surfaceMaterial);
    const edges = new LineSegments(
      new EdgesGeometry(shard.geometry, 18),
      edgeMaterial
    );
    mesh.add(edges);
    carrier.add(mesh);
    return { edges, mesh, shard };
  });

  return {
    group,
    update({
      delta,
      elapsed,
      progress,
      transformForce = 1,
      dimmed = false,
      surfaceColor,
      wireColor,
      auraColor,
      coreColor,
    }) {
      const clampedProgress = MathUtils.clamp(progress, 0, 1);
      const seam = stageProgress(clampedProgress, 0.03, 0.18);
      const orbitBase = stageProgress(clampedProgress, 0.24, 0.9);
      const settle = stageProgress(clampedProgress, 0.72, 1);
      const seamGlow = seam * (1 - settle * 0.48);
      const shimmer = (Math.sin(elapsed * 2.05) + 1) * 0.5;
      const motionScale =
        Math.max(0.16, shardSet.radius * 0.22) * Math.max(0.35, transformForce);
      const edgeScale = MathUtils.clamp(
        12 / shardSet.trianglesPerShard,
        0.14,
        1
      );

      surfaceMaterial.color.copy(surfaceColor);
      surfaceMaterial.opacity = dimmed ? 0.14 : 0.96;
      surfaceMaterial.roughness = MathUtils.lerp(0.2, 0.08, seamGlow);
      surfaceMaterial.clearcoat = MathUtils.lerp(0.28, 0.82, seamGlow);
      surfaceMaterial.clearcoatRoughness = MathUtils.lerp(0.1, 0.03, seamGlow);
      surfaceMaterial.emissive.copy(coreColor);
      surfaceMaterial.emissiveIntensity =
        (dimmed ? 0.02 : 0.08) + seamGlow * (dimmed ? 0.04 : 0.18);

      edgeMaterial.opacity =
        ((dimmed ? 0.04 : 0.18) * seamGlow +
          orbitBase * (dimmed ? 0.01 : 0.05)) *
        edgeScale;
      edgeColor.copy(warmColor).lerp(coolColor, orbitBase);
      edgeColor.lerp(wireColor, 0.5);
      edgeMaterial.color.copy(edgeColor);

      coreMaterial.color.copy(coreColor);
      coreMaterial.opacity = dimmed
        ? 0
        : 0.05 + seamGlow * 0.18 + shimmer * orbitBase * 0.03;
      haloMaterial.color.copy(auraColor);
      haloMaterial.opacity = dimmed ? 0 : seamGlow * 0.05 + orbitBase * 0.08;

      const driftSway =
        orbitBase * Math.sin(elapsed * 0.34) * motionScale * 0.36;
      carrier.rotation.y = MathUtils.damp(
        carrier.rotation.y,
        clampedProgress * 0.24 + driftSway,
        2.8,
        delta
      );
      carrier.rotation.x = MathUtils.damp(
        carrier.rotation.x,
        -clampedProgress * 0.08 +
          Math.sin(elapsed * 0.48 + 0.6) * orbitBase * 0.04,
        2.8,
        delta
      );
      carrier.position.y = MathUtils.damp(
        carrier.position.y,
        orbitBase * motionScale * 0.2 +
          Math.sin(elapsed * 0.62) * orbitBase * motionScale * 0.12,
        2.8,
        delta
      );

      const coreScale = 1 + seamGlow * 1.2 + orbitBase * 0.22;
      coreMesh.scale.setScalar(coreScale);
      coreMesh.rotation.y += delta * 0.45;

      const haloScale = 1 + orbitBase * 0.75 + shimmer * 0.05;
      haloMesh.scale.setScalar(haloScale);
      haloMesh.rotation.y -= delta * 0.22;

      shardEntries.forEach(({ mesh, shard }) => {
        const burst = stageProgress(
          clampedProgress,
          0.09 + shard.delay,
          0.34 + shard.delay
        );
        const orbit = stageProgress(
          clampedProgress,
          0.22 + shard.delay * 0.7,
          0.84
        );
        const settleShard = stageProgress(
          clampedProgress,
          0.72 + shard.phase * 0.08,
          1
        );
        const orbitAngle =
          elapsed * (0.56 + shard.phase * 0.42) + shard.phase * Math.PI * 4.2;
        const orbitLift =
          Math.sin(orbitAngle * 0.9) * orbit * motionScale * 0.14;
        const orbitRadius =
          orbit *
          motionScale *
          (0.22 + 0.08 * Math.sin(orbitAngle * 1.24 + shard.phase * 5.1));

        mesh.position.set(0, 0, 0);
        mesh.position
          .copy(shard.centroid)
          .addScaledVector(
            shard.normal,
            motionScale * (seam * 0.16 + burst * 0.5 + orbit * 0.18)
          )
          .addScaledVector(
            shard.driftDirection,
            motionScale * (burst * 1.1 + orbit * 0.32)
          )
          .addScaledVector(shard.radialDirection, motionScale * orbit * 0.44)
          .addScaledVector(
            shard.tangentDirection,
            orbitRadius * (1 - settleShard * 0.18)
          )
          .addScaledVector(shard.spinAxis, orbitLift);

        const spinAngle =
          burst * (0.18 + shard.phase * 0.58) +
          orbit *
            (0.18 * Math.sin(orbitAngle) + 0.06 * Math.cos(orbitAngle * 1.4)) -
          settleShard * 0.04;

        mesh.quaternion.setFromAxisAngle(shard.spinAxis, spinAngle);
        mesh.scale.setScalar(
          1 +
            seamGlow * 0.03 +
            orbit * 0.024 * Math.sin(elapsed * 1.28 + shard.phase * 12)
        );
      });
    },
    destroy() {
      shardEntries.forEach(({ edges, shard }) => {
        edges.geometry.dispose();
        shard.geometry.dispose();
      });
      coreGeometry.dispose();
      haloGeometry.dispose();
      surfaceMaterial.dispose();
      edgeMaterial.dispose();
      coreMaterial.dispose();
      haloMaterial.dispose();
    },
  };
}
