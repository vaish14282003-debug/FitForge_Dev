#!/usr/bin/env node
/**
 * Builds public/models/anatomy.glb from BodyParts3D (DBCLS) OBJ files.
 *
 *   1. Download from https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html:
 *      isa_BP3D_4.0_obj_99.zip, isa_element_parts.txt, isa_parts_list_e.txt, isa_inclusion_relation_list.txt
 *   2. unzip -j isa_BP3D_4.0_obj_99.zip '*.obj' -d <data>/obj
 *   3. node scripts/anatomy/build-model.mjs <data>
 *
 * Writes the GLB and src/features/muscle-intelligence/anatomy/model-manifest.json (muscle ID ->
 * mesh names). Mesh names are stable: `<muscle-id or context or bone>__<side>__<n>`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const data = process.argv[2];
if (!data) throw new Error("Usage: node build-model.mjs <bodyparts3d data dir>");
const mapping = JSON.parse(fs.readFileSync(path.join(here, "bp3d-mapping.json"), "utf8"));

const tsv = (file) =>
  fs
    .readFileSync(path.join(data, file), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.replace(/\r$/, "").split("\t"));

const elementsByName = new Map();
for (const [, name, fj] of tsv("isa_element_parts.txt")) {
  if (!elementsByName.has(name)) elementsByName.set(name, new Set());
  elementsByName.get(name).add(fj);
}

// Every bone, found through the dataset's own is-a hierarchy under "bone organ" (FMA5018).
const children = new Map();
for (const [parent, , child] of tsv("isa_inclusion_relation_list.txt")) {
  if (!children.has(parent)) children.set(parent, []);
  children.get(parent).push(child);
}
const conceptName = new Map(tsv("isa_parts_list_e.txt").map(([id, , name]) => [id, name]));
const boneConcepts = new Set();
(function walk(id) {
  for (const c of children.get(id) ?? []) {
    if (boneConcepts.has(c)) continue;
    boneConcepts.add(c);
    walk(c);
  }
})("FMA5018");
const boneNames = [...boneConcepts].map((id) => conceptName.get(id)).filter((n) => n && elementsByName.has(n));

const used = new Set();
const missing = [];
/** Element files for a concept name, each used once (a bone shared by two concepts is drawn once). */
function elementsFor(name) {
  const fjs = [...(elementsByName.get(name) ?? [])].filter((fj) => !used.has(fj));
  if (!elementsByName.has(name)) missing.push(name);
  fjs.forEach((fj) => used.add(fj));
  return fjs;
}

// BodyParts3D: millimetres, Z up, body faces -Y, anatomical left is +X.
// FitForge scene: metres, Y up, body faces +Z, feet on y = 0, centred on x/z.
const FEET_Z = -70;
const DEPTH_Y = -60;
function readObj(fj) {
  const positions = [];
  const indices = [];
  for (const line of fs.readFileSync(path.join(data, "obj", `${fj}.obj`), "utf8").split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      positions.push(x / 1000, (z - FEET_Z) / 1000, -(y - DEPTH_Y) / 1000);
    } else if (line.startsWith("f ")) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => Number(t.split("/")[0]) - 1);
      for (let i = 1; i + 1 < idx.length; i++) indices.push(idx[0], idx[i], idx[i + 1]);
    }
  }
  return { positions, indices };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("anatomy");
const materials = {
  // Linear-space colours matching #6e342d (selectable, recoloured at runtime) and a slightly deeper context tone.
  muscle: doc.createMaterial("muscle").setBaseColorFactor([0.155, 0.034, 0.026, 1]).setRoughnessFactor(0.58),
  context: doc.createMaterial("context").setBaseColorFactor([0.13, 0.03, 0.024, 1]).setRoughnessFactor(0.62),
  bone: doc.createMaterial("bone").setBaseColorFactor([0.78, 0.74, 0.66, 1]).setRoughnessFactor(0.75),
};

/** One mesh per concept and side, merging that concept's element files. */
function addMesh(meshName, fjs, material) {
  if (!fjs.length) return false;
  const positions = [];
  const indices = [];
  for (const fj of fjs) {
    const part = readObj(fj);
    const offset = positions.length / 3;
    for (const v of part.positions) positions.push(v);
    for (const i of part.indices) indices.push(i + offset);
  }
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(indices)).setBuffer(buffer))
    .setMaterial(material);
  const mesh = doc.createMesh(meshName).addPrimitive(prim);
  scene.addChild(doc.createNode(meshName).setMesh(mesh));
  return true;
}

const manifest = { muscles: {}, missingMuscles: mapping.missing, missingConcepts: [], counts: {} };
for (const [muscleId, concepts] of Object.entries(mapping.muscles)) {
  manifest.muscles[muscleId] = [];
  for (const side of ["left", "right"]) {
    concepts.forEach((c, i) => {
      const name = `${muscleId}__${side}__${i}`;
      if (addMesh(name, elementsFor(c.replace("{side}", side)), materials.muscle)) manifest.muscles[muscleId].push(name);
    });
  }
}
let n = 0;
for (const side of ["left", "right"]) for (const c of mapping.context.names) addMesh(`context__${side}__${n++}`, elementsFor(c.replace("{side}", side)), materials.context);
for (const [i, bone] of boneNames.entries()) addMesh(`bone__${i}`, elementsFor(bone), materials.bone);
manifest.missingConcepts = [...new Set(missing)].sort();

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

// Weld first so simplification sees connected surfaces; error is relative to each mesh's size.
/** Smooth, area-weighted vertex normals on the welded mesh (glTF-Transform's normals() is flat). */
function smoothNormals() {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION").getArray();
        const idx = prim.getIndices().getArray();
        const n = new Float32Array(pos.length);
        for (let i = 0; i < idx.length; i += 3) {
          const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
          const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
          const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
          const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
          for (const k of [a, b, c]) {
            n[k] += cx;
            n[k + 1] += cy;
            n[k + 2] += cz;
          }
        }
        for (let i = 0; i < n.length; i += 3) {
          const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
          n[i] /= len;
          n[i + 1] /= len;
          n[i + 2] /= len;
        }
        prim.setAttribute("NORMAL", document.createAccessor().setType("VEC3").setArray(n).setBuffer(buffer));
      }
    }
  };
}

// Weld first so simplification sees connected surfaces; smooth normals follow the simplified surface.
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.18, error: 0.006 }), smoothNormals(), dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize());

const out = path.join(root, "public/models/anatomy.glb");
await io.write(out, doc);
manifest.counts = {
  meshes: doc.getRoot().listMeshes().length,
  triangles: doc.getRoot().listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0), 0),
  bytes: fs.statSync(out).size,
};
fs.writeFileSync(path.join(root, "src/features/muscle-intelligence/anatomy/model-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${path.relative(root, out)}: ${(manifest.counts.bytes / 1e6).toFixed(2)} MB, ${manifest.counts.meshes} meshes, ${manifest.counts.triangles} triangles`);
if (manifest.missingConcepts.length) console.log("Concepts not found:", manifest.missingConcepts.join("; "));
