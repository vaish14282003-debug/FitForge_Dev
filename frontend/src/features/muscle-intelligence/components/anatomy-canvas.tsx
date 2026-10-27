"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import { BASE_SHAPES, MUSCLE_SHAPES, VIEW_PRESETS, mirrorX, type ShapeDef, type ViewPreset } from "../anatomy/procedural-body";
import type { MuscleId } from "../types";
import type { Involvement } from "../utils/anatomy";
import { STATE_COLORS, muscleVisualState, type MuscleVisualState } from "../utils/highlight";

export type AnatomyCanvasHandle = { setView: (view: ViewPreset) => void };

type Props = {
  selected: MuscleId | null;
  hovered: MuscleId | null;
  exerciseHighlight: Map<MuscleId, Involvement>;
  onHover: (id: MuscleId | null) => void;
  onSelect: (id: MuscleId | null) => void;
  reducedMotion: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Geometry and transform for one shape, optionally mirrored to the figure's right side. */
function build(shape: ShapeDef, mirrored: boolean, sphere: THREE.SphereGeometry) {
  if (shape.kind === "ellipsoid") {
    const [x, y, z] = mirrored ? mirrorX(shape.center) : shape.center;
    const [rx, ry, rz] = shape.rotation ?? [0, 0, 0];
    return {
      geometry: sphere,
      position: new THREE.Vector3(x, y, z),
      // Mirroring flips rotation about Y and Z.
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, mirrored ? -ry : ry, mirrored ? -rz : rz)),
      scale: new THREE.Vector3(...shape.radii),
      owned: false,
    };
  }
  const from = new THREE.Vector3(...(mirrored ? mirrorX(shape.from) : shape.from));
  const to = new THREE.Vector3(...(mirrored ? mirrorX(shape.to) : shape.to));
  const dir = to.clone().sub(from);
  return {
    geometry: new THREE.CapsuleGeometry(shape.radius, Math.max(0.001, dir.length()), 6, 16),
    position: from.clone().add(to).multiplyScalar(0.5),
    quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
    scale: new THREE.Vector3(1, 1, 1),
    owned: true,
  };
}

function Figure({ selected, hovered, exerciseHighlight, onHover, onSelect }: Omit<Props, "reducedMotion">) {
  // One material per visual state and one shared sphere, reused by every mesh; disposed on unmount.
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  const materials = useMemo(() => {
    const entries = (Object.keys(STATE_COLORS) as MuscleVisualState[]).map((state) => {
      const { color, emissive, emissiveIntensity } = STATE_COLORS[state];
      return [state, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.62, metalness: 0.05 })] as const;
    });
    return Object.fromEntries(entries) as Record<MuscleVisualState, THREE.MeshStandardMaterial>;
  }, []);
  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a302d", roughness: 0.85, metalness: 0 }), []);

  const base = useMemo(() => BASE_SHAPES.flatMap((s) => (s.mirror ? [build(s, false, sphere), build(s, true, sphere)] : [build(s, false, sphere)])), [sphere]);
  const muscles = useMemo(
    () => MUSCLE_SHAPES.flatMap((s) => [false, ...(s.mirror ? [true] : [])].map((m) => ({ muscle: s.muscle, ...build(s, m, sphere) }))),
    [sphere],
  );

  useEffect(
    () => () => {
      sphere.dispose();
      baseMaterial.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      [...base, ...muscles].forEach((p) => p.owned && p.geometry.dispose());
    },
    [sphere, baseMaterial, materials, base, muscles],
  );

  const blockPointer = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    onHover(null);
    document.body.style.cursor = "";
  };

  const handlers = (id: MuscleId) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    },
  });

  return (
    <group>
      {base.map((p, i) => (
        <mesh
          key={`base-${i}`}
          geometry={p.geometry}
          position={p.position}
          quaternion={p.quaternion}
          scale={p.scale}
          material={baseMaterial}
          // The body is solid: it stops the pointer, so a click between two muscles can't reach one behind.
          onPointerOver={blockPointer}
          onClick={blockPointer}
        />
      ))}
      {muscles.map((p, i) => (
        <mesh
          key={`${p.muscle}-${i}`}
          name={p.muscle}
          geometry={p.geometry}
          position={p.position}
          quaternion={p.quaternion}
          scale={p.scale}
          material={materials[muscleVisualState(p.muscle, { hovered, selected, exerciseHighlight })]}
          {...handlers(p.muscle)}
        />
      ))}
    </group>
  );
}

/** The 3D viewport. Renders only when something changes (camera, hover, selection), not every frame. */
const AnatomyCanvas = forwardRef<AnatomyCanvasHandle, Props>(function AnatomyCanvas({ reducedMotion, ...figure }, ref) {
  const controls = useRef<CameraControls>(null);

  useImperativeHandle(ref, () => ({
    setView(view) {
      const { position, target } = VIEW_PRESETS[view];
      controls.current?.setLookAt(...position, ...target, !reducedMotion);
    },
  }));

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const start = VIEW_PRESETS.default;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [...start.position], fov: 32, near: 0.1, far: 30 }}
      onPointerMissed={() => figure.onSelect(null)}
      gl={{ antialias: true, powerPreference: "default" }}
      aria-label="3D model of the human muscular system"
    >
      <color attach="background" args={["#0d0909"]} />
      <hemisphereLight args={["#fff4ee", "#1a0d0b", 0.9]} />
      <directionalLight position={[2.5, 3, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2.5]} intensity={0.7} color="#ffd9cf" />
      <Figure {...figure} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[0.7, 48]} />
        <meshStandardMaterial color="#1a1110" roughness={1} />
      </mesh>
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={1.2}
        maxDistance={5}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI - 0.35}
        smoothTime={reducedMotion ? 0 : 0.35}
      />
      <InitialTarget controls={controls} />
    </Canvas>
  );
});

// CameraControls needs its look-at target set after it mounts.
function InitialTarget({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  useEffect(() => {
    const { position, target } = VIEW_PRESETS.default;
    controls.current?.setLookAt(...position, ...target, false);
  }, [controls]);
  return null;
}

export default AnatomyCanvas;
