"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { MuscleId } from "../types";
import { buildMeshIndex, type Involvement } from "../utils/anatomy";
import { STATE_COLORS, muscleVisualState, type MuscleVisualState } from "../utils/highlight";

export const MODEL_URL = "/models/anatomy.glb";

type Props = {
  selected: MuscleId | null;
  hovered: MuscleId | null;
  exerciseHighlight: Map<MuscleId, Involvement>;
  onHover: (id: MuscleId | null) => void;
  onSelect: (id: MuscleId | null) => void;
  reducedMotion: boolean;
};

const FADE_MS = 180;

/**
 * The BodyParts3D-derived model. Each selectable mesh gets its own material so its colour can fade
 * between states; everything else (context muscles, bones) keeps the shared materials from the file.
 */
export function AnatomyModel({ selected, hovered, exerciseHighlight, onHover, onSelect, reducedMotion }: Props) {
  // Draco off (the file uses meshopt, whose decoder is bundled), so nothing is fetched from a CDN.
  const { scene } = useGLTF(MODEL_URL, false, true);
  const invalidate = useThree((s) => s.invalidate);
  const meshIndex = useMemo(() => buildMeshIndex(), []);

  // Prepare once per loaded scene: per-muscle materials, and the list of meshes per muscle.
  const { muscleMeshes, owned } = useMemo(() => {
    const byMuscle = new Map<MuscleId, THREE.Mesh[]>();
    const created: THREE.Material[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const id = meshIndex.get(obj.name);
      if (!id) return;
      const base = STATE_COLORS.default;
      const material = new THREE.MeshStandardMaterial({ color: base.color, emissive: base.emissive, emissiveIntensity: base.emissiveIntensity, roughness: 0.58, metalness: 0 });
      obj.material = material;
      created.push(material);
      byMuscle.set(id, [...(byMuscle.get(id) ?? []), obj]);
    });
    return { muscleMeshes: byMuscle, owned: created };
  }, [scene, meshIndex]);

  useEffect(() => () => owned.forEach((m) => m.dispose()), [owned]);

  // Fade each muscle's material toward its target colours whenever states change.
  const frame = useRef(0);
  useEffect(() => {
    const targets = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; emissive: THREE.Color; intensity: number }>();
    for (const [id, meshes] of muscleMeshes) {
      const state: MuscleVisualState = muscleVisualState(id, { hovered, selected, exerciseHighlight });
      const t = STATE_COLORS[state];
      for (const mesh of meshes) targets.set(mesh.material as THREE.MeshStandardMaterial, { color: new THREE.Color(t.color), emissive: new THREE.Color(t.emissive), intensity: t.emissiveIntensity });
    }
    const starts = new Map([...targets.keys()].map((m) => [m, { color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity }]));
    const begin = performance.now();
    cancelAnimationFrame(frame.current);
    const step = () => {
      const k = reducedMotion ? 1 : Math.min(1, (performance.now() - begin) / FADE_MS);
      for (const [mat, to] of targets) {
        const from = starts.get(mat)!;
        mat.color.lerpColors(from.color, to.color, k);
        mat.emissive.lerpColors(from.emissive, to.emissive, k);
        mat.emissiveIntensity = from.intensity + (to.intensity - from.intensity) * k;
      }
      invalidate();
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(frame.current);
  }, [muscleMeshes, hovered, selected, exerciseHighlight, reducedMotion, invalidate]);

  // Only report hover changes, so pointer movement over one muscle doesn't re-render the page.
  const lastHover = useRef<MuscleId | null>(null);
  const setHover = (id: MuscleId | null) => {
    if (lastHover.current === id) return;
    lastHover.current = id;
    document.body.style.cursor = id ? "pointer" : "";
    onHover(id);
  };

  // The nearest hit decides: bones and context muscles are solid and stop the pointer too.
  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => meshIndex.get(e.intersections[0]?.object.name ?? "") ?? null;

  return (
    <primitive
      object={scene}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(idOf(e));
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const id = idOf(e);
        if (id) onSelect(id);
      }}
    />
  );
}
