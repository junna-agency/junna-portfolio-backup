/**
 * Bake one or two meshes into a compact point-and-line cloud for the hero.
 *
 * Dots sit on the model's vertices (downsampled if there are more than
 * POINTS). Lines are the mesh's own edges, not a nearest-neighbour scribble.
 *
 * Two sources: B is reordered so each particle flies to a nearby point, and
 * B's original edges are remapped to that order.
 *
 *   node scripts/sample-mesh.mjs head.glb
 *   node scripts/sample-mesh.mjs head.glb sculpture.glb
 *   node scripts/sample-mesh.mjs public/hero-cloud.bin sculpture.glb
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Vector3 } from "three";

/** Cap. The bake also cannot exceed the smaller mesh's vertex count. */
const POINTS = 8000;
const FIT = 1.4;

const srcA = process.argv[2];
const srcB = process.argv[3];
if (!srcA) {
  console.error(
    "usage: node scripts/sample-mesh.mjs <from.glb|stl|hero-cloud.bin> [to.glb|stl]",
  );
  process.exit(1);
}

const meshA = await extract(srcA);
const meshB = srcB ? await extract(srcB) : null;
const cap = Math.min(POINTS, meshA.count, meshB?.count ?? POINTS);
let cloudA = prepare(clusterTo(meshA, cap));
let cloudB = meshB ? prepare(clusterTo(meshB, cap)) : null;
const n = Math.min(cloudA.count, cloudB?.count ?? cloudA.count);
cloudA = clip(cloudA, n);
if (cloudB) cloudB = clip(cloudB, n);

let posB = Float32Array.from(cloudA.positions);
let idxB = cloudA.indices;
if (cloudB) {
  const matched = matchPoints(cloudA.positions, cloudB.positions);
  posB = matched.positions;
  idxB = remapEdges(cloudB.indices, matched.inv);
}

const header = Buffer.alloc(16);
header.write("CLD2", 0);
header.writeUInt32LE(n, 4);
header.writeUInt32LE(cloudA.indices.length / 2, 8);
header.writeUInt32LE(idxB.length / 2, 12);
const out = Buffer.concat([
  header,
  Buffer.from(cloudA.positions.buffer),
  Buffer.from(posB.buffer),
  Buffer.from(new Uint32Array(cloudA.indices).buffer),
  Buffer.from(new Uint32Array(idxB).buffer),
]);

const dest = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/hero-cloud.bin",
);
writeFileSync(dest, out);
console.log(
  `wrote ${dest} (${(out.length / 1024).toFixed(1)} KB, ${n} vertex-dots, ${cloudA.indices.length / 2}+${idxB.length / 2} mesh edges)`,
);

function prepare(mesh) {
  fit(mesh.positions);
  return mesh;
}

function clip(cloud, n) {
  if (cloud.count <= n) return cloud;
  const positions = new Float32Array(n * 3);
  positions.set(cloud.positions.subarray(0, n * 3));
  const indices = [];
  for (let e = 0; e < cloud.indices.length; e += 2) {
    const a = cloud.indices[e];
    const b = cloud.indices[e + 1];
    if (a < n && b < n && a !== b) indices.push(a, b);
  }
  return { positions, indices, count: n };
}

/**
 * Merge vertices that share a grid cell so the kept dots still share the
 * original edges. Farthest-point sampling was throwing those edges away.
 */
function clusterTo(mesh, target) {
  const count = mesh.count;
  if (count <= target) return mesh;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = mesh.positions[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  let lo = span / 512;
  let hi = span;
  let best = clusterOnce(mesh, min, hi);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const next = clusterOnce(mesh, min, mid);
    if (next.count > target) lo = mid;
    else {
      best = next;
      hi = mid;
    }
  }
  return best.count <= target ? best : clusterOnce(mesh, min, lo * 1.05);
}

function clusterOnce(mesh, origin, cell) {
  const map = new Map();
  const id = new Int32Array(mesh.count);
  const sums = [];
  const ns = [];
  for (let i = 0; i < mesh.count; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    const key = `${Math.floor((x - origin[0]) / cell)},${Math.floor((y - origin[1]) / cell)},${Math.floor((z - origin[2]) / cell)}`;
    let ni = map.get(key);
    if (ni === undefined) {
      ni = map.size;
      map.set(key, ni);
      sums.push(x, y, z);
      ns.push(1);
    } else {
      sums[ni * 3] += x;
      sums[ni * 3 + 1] += y;
      sums[ni * 3 + 2] += z;
      ns[ni]++;
    }
    id[i] = ni;
  }
  const n = map.size;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const w = ns[i];
    positions[i * 3] = sums[i * 3] / w;
    positions[i * 3 + 1] = sums[i * 3 + 1] / w;
    positions[i * 3 + 2] = sums[i * 3 + 2] / w;
  }
  const indices = [];
  const seen = new Set();
  for (let e = 0; e < mesh.indices.length; e += 2) {
    const a = id[mesh.indices[e]];
    const b = id[mesh.indices[e + 1]];
    if (a === b) continue;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = `${lo},${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    indices.push(lo, hi);
  }
  return { positions, indices, count: n };
}

async function extract(src) {
  const buf = readFileSync(src);
  const ext = extname(src).toLowerCase();
  if (ext === ".bin") return extractCloud(buf);
  return ext === ".glb" || ext === ".gltf"
    ? extractGltf(buf)
    : extractStl(buf);
}

/** Reuse the first baked shape when only the project sculpture is changing. */
function extractCloud(file) {
  if (file.subarray(0, 4).toString() !== "CLD2") {
    throw new Error("Expected a CLD2 hero cloud");
  }
  const count = file.readUInt32LE(4);
  const lineCount = file.readUInt32LE(8);
  const positions = Float32Array.from(
    new Float32Array(
      file.buffer,
      file.byteOffset + 16,
      count * 3,
    ),
  );
  const indexOffset = 16 + count * 12 * 2;
  const rawIndices = new Uint32Array(
    file.buffer,
    file.byteOffset + indexOffset,
    lineCount * 2,
  );
  return {
    positions,
    indices: Array.from(rawIndices),
    count,
  };
}

function fit(positions) {
  const count = positions.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const center = min.map((v, k) => (v + max[k]) / 2);
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const scale = FIT / span;
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      positions[i * 3 + k] = (positions[i * 3 + k] - center[k]) * scale;
    }
  }
}

function matchPoints(posA, posB) {
  const count = posA.length / 3;
  const used = new Uint8Array(count);
  const out = new Float32Array(count * 3);
  const inv = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const ax = posA[i * 3];
    const ay = posA[i * 3 + 1];
    const az = posA[i * 3 + 2];
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < count; j++) {
      if (used[j]) continue;
      const dx = ax - posB[j * 3];
      const dy = ay - posB[j * 3 + 1];
      const dz = az - posB[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    used[best] = 1;
    inv[best] = i;
    out[i * 3] = posB[best * 3];
    out[i * 3 + 1] = posB[best * 3 + 1];
    out[i * 3 + 2] = posB[best * 3 + 2];
  }
  return { positions: out, inv };
}

function remapEdges(edges, inv) {
  const indices = [];
  const seen = new Set();
  for (let e = 0; e < edges.length; e += 2) {
    const a = inv[edges[e]];
    const b = inv[edges[e + 1]];
    if (a === b) continue;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = (lo << 16) + hi;
    if (seen.has(key)) continue;
    seen.add(key);
    indices.push(lo, hi);
  }
  return indices;
}

function extractStl(file) {
  const n = file.readUInt32LE(80);
  const map = new Map();
  const pos = [];
  const indices = [];
  const seen = new Set();
  const vert = (x, y, z) => {
    const key = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
    let i = map.get(key);
    if (i === undefined) {
      i = map.size;
      map.set(key, i);
      pos.push(x, y, z);
    }
    return i;
  };
  const edge = (a, b) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = (lo << 16) + hi;
    if (seen.has(key) || lo === hi) return;
    seen.add(key);
    indices.push(lo, hi);
  };
  let offset = 84;
  for (let t = 0; t < n; t++) {
    offset += 12;
    const a = vert(
      file.readFloatLE(offset),
      file.readFloatLE(offset + 4),
      file.readFloatLE(offset + 8),
    );
    const b = vert(
      file.readFloatLE(offset + 12),
      file.readFloatLE(offset + 16),
      file.readFloatLE(offset + 20),
    );
    const c = vert(
      file.readFloatLE(offset + 24),
      file.readFloatLE(offset + 28),
      file.readFloatLE(offset + 32),
    );
    edge(a, b);
    edge(b, c);
    edge(c, a);
    offset += 38;
  }
  return {
    positions: new Float32Array(pos),
    indices,
    count: pos.length / 3,
  };
}

async function extractGltf(file) {
  const loader = new GLTFLoader();
  const geometryOnly = stripGlbMaterials(file);
  const copy = geometryOnly.buffer.slice(
    geometryOnly.byteOffset,
    geometryOnly.byteOffset + geometryOnly.byteLength,
  );
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(copy, "", resolve, reject);
  });
  gltf.scene.updateMatrixWorld(true);

  const v = new Vector3();
  const pos = [];
  const indices = [];
  const seen = new Set();
  let base = 0;

  const edge = (a, b) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = `${lo},${hi}`;
    if (seen.has(key) || lo === hi) return;
    seen.add(key);
    indices.push(lo, hi);
  };

  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const attr = o.geometry.getAttribute("position");
    if (!attr) return;
    const idx = o.geometry.index;
    const m = o.matrixWorld;
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
    }
    const corner = (i) => base + (idx ? idx.getX(i) : i);
    const triCount = idx ? idx.count : attr.count;
    for (let i = 0; i < triCount; i += 3) {
      const a = corner(i);
      const b = corner(i + 1);
      const c = corner(i + 2);
      edge(a, b);
      edge(b, c);
      edge(c, a);
    }
    base += attr.count;
  });

  return {
    positions: new Float32Array(pos),
    indices,
    count: pos.length / 3,
  };
}

/**
 * GLTFLoader tries to decode embedded textures even though this bake only uses
 * geometry. Remove material references in-place so textured GLBs work in Node.
 */
function stripGlbMaterials(file) {
  if (file.readUInt32LE(0) !== 0x46546c67) return file;
  const jsonLength = file.readUInt32LE(12);
  const jsonOffset = 20;
  const json = JSON.parse(
    file.subarray(jsonOffset, jsonOffset + jsonLength).toString("utf8").trim(),
  );
  delete json.materials;
  delete json.textures;
  delete json.images;
  delete json.samplers;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  }
  const encoded = Buffer.from(JSON.stringify(json));
  if (encoded.length > jsonLength) {
    throw new Error("Geometry-only GLB metadata exceeded its source chunk");
  }
  const out = Buffer.from(file);
  out.fill(0x20, jsonOffset, jsonOffset + jsonLength);
  encoded.copy(out, jsonOffset);
  return out;
}
