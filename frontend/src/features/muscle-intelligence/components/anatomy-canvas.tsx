"use client";

import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, ContactShadows } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import { BASE_SHAPES, MUSCLE_SHAPES, VIEW_PRESETS, mirrorX, type ShapeDef, type ViewPreset } from "../anatomy/procedural-body";
import type { MuscleId } from "../types";
import type { Involvement } from "../utils/anatomy";
import { STATE_COLORS, muscleVisualState, type MuscleVisualState } from "../utils/highlight";
import { AnatomyModel } from "./anatomy-model";

export type AnatomyCanvasHandle = { setView: (view: ViewPreset) => void };

type Props = {
  /** "model" is the BodyParts3D-derived anatomy; "simple" is the stylized fallback. */
  variant: "model" | "simple";
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

/** Stylized fallback figure from primitive shapes, used only if the anatomy model can't load. */
function SimpleFigure({ selected, hovered, exerciseHighlight, onHover, onSelect }: Omit<Props, "reducedMotion" | "variant">) {
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
const AnatomyCanvas = forwardRef<AnatomyCanvasHandle, Props>(function AnatomyCanvas({ reducedMotion, variant, ...figure }, ref) {
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
      scene={{ environmentIntensity: 0.35 }}
      aria-label="3D model of the human muscular system"
    >
      <color attach="background" args={["#0d0909"]} />
      <StudioEnvironment />
      {/* Key, fill and rim: soft studio light that keeps contours readable from every side. */}
      <directionalLight position={[2.2, 3.2, 2.6]} intensity={2.1} color="#fff1ea" />
      <directionalLight position={[-2.6, 1.6, 1.8]} intensity={0.7} color="#ffe3d8" />
      <directionalLight position={[0, 2.4, -3]} intensity={1.1} color="#ffcfc2" />
      <ambientLight intensity={0.12} />
      {variant === "model" ? (
        <Suspense fallback={null}>
          <AnatomyModel {...figure} reducedMotion={reducedMotion} />
        </Suspense>
      ) : (
        <SimpleFigure {...figure} />
      )}
      <ContactShadows position={[0, 0.001, 0]} scale={2.2} blur={2.4} far={1.2} opacity={0.55} resolution={512} frames={1} color="#000000" />
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

/** Soft reflections from three's built-in RoomEnvironment: no HDR file to download. */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return env;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive attach="environment" object={texture} />;
}

// CameraControls needs its look-at target set after it mounts.
function InitialTarget({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  useEffect(() => {
    const { position, target } = VIEW_PRESETS.default;
    controls.current?.setLookAt(...position, ...target, false);
  }, [controls]);
  return null;
}

export default AnatomyCanvas;
