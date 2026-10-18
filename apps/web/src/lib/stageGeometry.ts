import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The R03 architecture is static. Batch identical materials, retaining the
// material objects used by the light controller, instead of thousands of draws.
export function batchStageGeometry(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const result = new THREE.Group();
  const batches = new Map<string, { material: THREE.Material; geometry: THREE.BufferGeometry[]; names: string[] }>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    if (Array.isArray(object.material)) {
      const copy = object.clone();
      copy.matrix.copy(object.matrixWorld);
      copy.matrixAutoUpdate = false;
      result.add(copy);
      return;
    }
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const key = `${object.material.uuid}:${Boolean(geometry.index)}:${Object.keys(geometry.attributes).sort().join(',')}`;
    const batch = batches.get(key) ?? { material: object.material, geometry: [] as THREE.BufferGeometry[], names: [] as string[] };
    batch.geometry.push(geometry);
    batch.names.push(object.name);
    batches.set(key, batch);
  });
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometry, false);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.name = batch.material.name;
      mesh.userData.sourceNames = batch.names;
      geometry.computeBoundingSphere();
      result.add(mesh);
      batch.geometry.forEach((item) => item.dispose());
    } else {
      batch.geometry.forEach((item) => result.add(new THREE.Mesh(item, batch.material)));
    }
  }
  return result;
}

// Same row/sector layout as the source Blender build_arena.py. One instanced
// draw for all seat-back strips; no extra real-time light per seat.
export function seatLightMatrices() {
  const matrices: Array<{ matrix: THREE.Matrix4; phase: number }> = [];
  const dummy = new THREE.Object3D();
  for (const [radius, height, rows] of [[32, 1.1, 10], [40, 8.8, 9]] as const) {
    for (let sector = 0; sector < 10; sector++) {
      const start = THREE.MathUtils.degToRad(50 + sector * 26 + 1.8);
      const end = THREE.MathUtils.degToRad(50 + (sector + 1) * 26 - 1.8);
      for (let row = 0; row < rows; row++) {
        const r = radius + row * 0.78;
        const count = Math.floor((end - start) * (r + 0.4) / 0.68);
        for (let i = 0; i < count; i++) {
          const angle = start + (end - start) * (i + 0.5) / count;
          dummy.position.set((r + 0.58) * Math.sin(angle), height + row * 0.49 + 0.775, 2 - (r + 0.58) * Math.cos(angle));
          dummy.rotation.set(0, -angle, 0);
          dummy.updateMatrix();
          matrices.push({ matrix: dummy.matrix.clone(), phase: (THREE.MathUtils.radToDeg(angle) - 50) / 260 });
        }
      }
    }
  }
  return matrices;
}
