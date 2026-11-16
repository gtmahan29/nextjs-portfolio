"use client";

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { ZoneUniformState } from "./types";
import {
  CelMaterialOptions,
  createCardSkeletonTexture,
  createCelMaterial,
  createEdgeLineMaterial,
  createInkOutlineMaterial,
  createTileGridTexture,
} from "./toonShader";

export function useCelMaterial(
  opts: CelMaterialOptions,
  deps: React.DependencyList = []
): THREE.ShaderMaterial {
  const material = useMemo(
    () => createCelMaterial(opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.color, opts.emissiveColor, opts.baseEmissive, opts.glowBoost, opts.map, opts.opacity, ...deps]
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
}

export function useEdgeMaterial(zone: ZoneUniformState): THREE.ShaderMaterial {
  const mat = useMemo(() => createEdgeLineMaterial(zone), [zone]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export function useHullOutlineMaterial(
  zone: ZoneUniformState,
  thickness = 0.032
): THREE.ShaderMaterial {
  const mat = useMemo(() => createInkOutlineMaterial(zone, thickness), [zone, thickness]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

interface CommonProps {
  zone: ZoneUniformState;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  color: string | number;
  emissiveColor?: string | number;
  baseEmissive?: number;
  glowBoost?: number;
  keepGlowInDim?: number;
  opacity?: number;
  map?: THREE.Texture | null;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function InkBox({
  zone,
  args = [1, 1, 1],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
  emissiveColor,
  baseEmissive,
  glowBoost,
  keepGlowInDim,
  opacity,
  map,
  edgeThreshold = 20,
  onClick,
  onPointerOver,
  onPointerOut,
  castShadow = true,
  receiveShadow = true,
}: CommonProps & { args?: [number, number, number]; edgeThreshold?: number }) {
  const celMat = useCelMaterial({
    color,
    zone,
    emissiveColor,
    baseEmissive,
    glowBoost,
    keepGlowInDim,
    opacity,
    map,
  });
  const edgeMat = useEdgeMaterial(zone);

  const [geo, edgesGeo] = useMemo(() => {
    const g = new THREE.BoxGeometry(args[0], args[1], args[2]);
    const eg = new THREE.EdgesGeometry(g, edgeThreshold);
    return [g, eg];
  }, [args[0], args[1], args[2], edgeThreshold]);

  useEffect(() => {
    return () => {
      geo.dispose();
      edgesGeo.dispose();
    };
  }, [geo, edgesGeo]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh
        geometry={geo}
        material={celMat}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      <lineSegments geometry={edgesGeo} material={edgeMat} />
    </group>
  );
}

export function InkCylinder({
  zone,
  args = [0.5, 0.5, 1, 24],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
  emissiveColor,
  baseEmissive,
  glowBoost,
  keepGlowInDim,
  opacity,
  outlineThickness = 0.025,
  useEdges = true,
  useHull = false,
  onClick,
  onPointerOver,
  onPointerOut,
  castShadow = true,
  receiveShadow = true,
}: CommonProps & {
  args?: [number, number, number, number];
  outlineThickness?: number;
  useEdges?: boolean;
  useHull?: boolean;
}) {
  const celMat = useCelMaterial({
    color,
    zone,
    emissiveColor,
    baseEmissive,
    glowBoost,
    keepGlowInDim,
    opacity,
  });
  const edgeMat = useEdgeMaterial(zone);
  const hullMat = useHullOutlineMaterial(zone, outlineThickness);

  const [geo, edgesGeo] = useMemo(() => {
    const g = new THREE.CylinderGeometry(args[0], args[1], args[2], args[3]);
    const eg = new THREE.EdgesGeometry(g, 26);
    return [g, eg];
  }, [args[0], args[1], args[2], args[3]]);

  useEffect(() => {
    return () => {
      geo.dispose();
      edgesGeo.dispose();
    };
  }, [geo, edgesGeo]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh
        geometry={geo}
        material={celMat}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      {useEdges && <lineSegments geometry={edgesGeo} material={edgeMat} />}
      {useHull && <mesh geometry={geo} material={hullMat} />}
    </group>
  );
}

export function InkSphere({
  zone,
  args = [0.5, 24, 18],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
  emissiveColor,
  baseEmissive,
  glowBoost,
  keepGlowInDim,
  opacity,
  outlineThickness = 0.032,
  onClick,
  onPointerOver,
  onPointerOut,
  castShadow = true,
  receiveShadow = true,
}: CommonProps & { args?: [number, number, number]; outlineThickness?: number }) {
  const celMat = useCelMaterial({
    color,
    zone,
    emissiveColor,
    baseEmissive,
    glowBoost,
    keepGlowInDim,
    opacity,
  });
  const hullMat = useHullOutlineMaterial(zone, outlineThickness);

  const geo = useMemo(() => new THREE.SphereGeometry(args[0], args[1], args[2]), [args[0], args[1], args[2]]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh
        geometry={geo}
        material={celMat}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      <mesh geometry={geo} material={hullMat} />
    </group>
  );
}

export function InkTorus({
  zone,
  args = [1, 0.14, 16, 48],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color,
  emissiveColor,
  baseEmissive,
  glowBoost,
  keepGlowInDim,
  outlineThickness = 0.028,
  onClick,
  onPointerOver,
  onPointerOut,
}: CommonProps & { args?: [number, number, number, number]; outlineThickness?: number }) {
  const celMat = useCelMaterial({
    color,
    zone,
    emissiveColor,
    baseEmissive,
    glowBoost,
    keepGlowInDim,
  });
  const hullMat = useHullOutlineMaterial(zone, outlineThickness);
  const geo = useMemo(
    () => new THREE.TorusGeometry(args[0], args[1], args[2], args[3]),
    [args[0], args[1], args[2], args[3]]
  );
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh
        geometry={geo}
        material={celMat}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      <mesh geometry={geo} material={hullMat} />
    </group>
  );
}

export function PlatformTile({
  zone,
  topHex,
  sideHex,
  gridHex,
  size = 8.2,
  height = 0.44,
}: {
  zone: ZoneUniformState;
  topHex: string;
  sideHex: string;
  gridHex: string;
  size?: number;
  height?: number;
}) {
  const topTex = useMemo(() => createTileGridTexture(topHex, gridHex, 6), [topHex, gridHex]);
  useEffect(() => () => topTex.dispose(), [topTex]);

  const sideMat = useCelMaterial({ color: sideHex, zone });
  const topMat = useCelMaterial({ color: "#FFFFFF", map: topTex, zone });
  const edgeMat = useEdgeMaterial(zone);

  const [baseGeo, baseEdges, topGeo] = useMemo(() => {
    const bg = new THREE.BoxGeometry(size, height, size);
    const beg = new THREE.EdgesGeometry(bg, 20);
    const tg = new THREE.PlaneGeometry(size - 0.02, size - 0.02);
    return [bg, beg, tg];
  }, [size, height]);

  useEffect(() => {
    return () => {
      baseGeo.dispose();
      baseEdges.dispose();
      topGeo.dispose();
    };
  }, [baseGeo, baseEdges, topGeo]);

  return (
    <group>
      <mesh geometry={baseGeo} material={sideMat} receiveShadow castShadow />
      <lineSegments geometry={baseEdges} material={edgeMat} />
      <mesh
        geometry={topGeo}
        material={topMat}
        position={[0, height / 2 + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
    </group>
  );
}

export function TinyPerson({
  zone,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  shirtHex,
  pantsHex = "#2A2B36",
  skinHex = "#F5C6A5",
  hardhatHex,
  sitting = false,
}: {
  zone: ZoneUniformState;
  position?: [number, number, number];
  rotation?: [number, number, number];
  shirtHex: string;
  pantsHex?: string;
  skinHex?: string;
  hardhatHex?: string;
  sitting?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      {sitting ? (
        <>
          <InkBox zone={zone} args={[0.08, 0.08, 0.22]} position={[-0.05, 0.04, 0.1]} color={pantsHex} />
          <InkBox zone={zone} args={[0.08, 0.08, 0.22]} position={[0.05, 0.04, 0.1]} color={pantsHex} />
          <InkCylinder zone={zone} args={[0.09, 0.11, 0.24, 10]} position={[0, 0.19, 0]} color={shirtHex} useHull useEdges={false} outlineThickness={0.016} />
          <InkSphere zone={zone} args={[0.085, 12, 10]} position={[0, 0.39, 0]} color={skinHex} outlineThickness={0.016} />
        </>
      ) : (
        <>
          <InkCylinder zone={zone} args={[0.036, 0.032, 0.22, 8]} position={[-0.045, 0.11, 0]} color={pantsHex} useEdges={false} useHull outlineThickness={0.014} />
          <InkCylinder zone={zone} args={[0.036, 0.032, 0.22, 8]} position={[0.045, 0.11, 0]} color={pantsHex} useEdges={false} useHull outlineThickness={0.014} />
          <InkCylinder zone={zone} args={[0.085, 0.105, 0.25, 10]} position={[0, 0.34, 0]} color={shirtHex} useEdges={false} useHull outlineThickness={0.016} />
          <InkSphere zone={zone} args={[0.085, 12, 10]} position={[0, 0.54, 0]} color={skinHex} outlineThickness={0.016} />
          {hardhatHex && (
            <InkCylinder zone={zone} args={[0.09, 0.11, 0.06, 12]} position={[0, 0.6, 0]} color={hardhatHex} useEdges={false} useHull outlineThickness={0.014} />
          )}
        </>
      )}
    </group>
  );
}

/**
 * Multi-sphere cartoon cloud with a single clean outer silhouette ink outline
 * (Pass 1 BackFace spheres + Pass 2 FrontFace cel spheres prevent interior seam lines).
 */
export function PuffyCloud({
  zone,
  position = [0, 0, 0],
  scale = 1,
  rotationY = 0,
}: {
  zone: ZoneUniformState;
  position?: [number, number, number];
  scale?: number;
  rotationY?: number;
}) {
  const celMat = useCelMaterial({ color: "#FFFFFF", zone, glowBoost: 0.06 });
  const hullMat = useHullOutlineMaterial(zone, 0.055);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.5, 18, 14), []);
  useEffect(() => () => sphereGeo.dispose(), [sphereGeo]);

  const puffs: Array<[number, number, number, number]> = [
    [0, 0.15, 0, 1.0],
    [-0.58, 0.02, 0.08, 0.72],
    [0.6, 0.04, -0.06, 0.78],
    [0.2, 0.25, 0.24, 0.66],
    [-0.25, 0.22, -0.2, 0.65],
  ];

  return (
    <group position={position} scale={[scale, scale * 0.85, scale]} rotation={[0, rotationY, 0]}>
      {puffs.map(([x, y, z, r], idx) => (
        <mesh
          key={`hull-${idx}`}
          geometry={sphereGeo}
          material={hullMat}
          position={[x, y, z]}
          scale={r}
          renderOrder={1}
        />
      ))}
      {puffs.map(([x, y, z, r], idx) => (
        <mesh
          key={`body-${idx}`}
          geometry={sphereGeo}
          material={celMat}
          position={[x, y, z]}
          scale={r}
          castShadow
          renderOrder={2}
        />
      ))}
    </group>
  );
}

export function LollipopTree({
  zone,
  position = [0, 0, 0],
  scale = 1,
  leafHex = "#34B86A",
  trunkHex = "#1A5E3A",
}: {
  zone: ZoneUniformState;
  position?: [number, number, number];
  scale?: number;
  leafHex?: string;
  trunkHex?: string;
}) {
  const leafMat = useCelMaterial({ color: leafHex, zone, glowBoost: 0.12 });
  const hullMat = useHullOutlineMaterial(zone, 0.04);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.45, 16, 14), []);
  useEffect(() => () => sphereGeo.dispose(), [sphereGeo]);

  return (
    <group position={position} scale={scale}>
      <InkCylinder
        zone={zone}
        args={[0.055, 0.08, 0.65, 10]}
        position={[0, 0.325, 0]}
        color={trunkHex}
        useEdges={false}
        useHull
        outlineThickness={0.018}
      />
      {/* Double-lobed puff crown with clean outer ink silhouette */}
      <mesh geometry={sphereGeo} material={hullMat} position={[0, 0.82, 0]} scale={[1, 1.05, 1]} renderOrder={1} />
      <mesh geometry={sphereGeo} material={hullMat} position={[0, 1.18, 0]} scale={0.76} renderOrder={1} />
      <mesh geometry={sphereGeo} material={leafMat} position={[0, 0.82, 0]} scale={[1, 1.05, 1]} castShadow renderOrder={2} />
      <mesh geometry={sphereGeo} material={leafMat} position={[0, 1.18, 0]} scale={0.76} castShadow renderOrder={2} />
    </group>
  );
}

export function FloatingCard({
  zone,
  accentHex,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = [1.35, 1.65, 0.07],
  onClick,
}: {
  zone: ZoneUniformState;
  accentHex: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const cardTex = useMemo(() => createCardSkeletonTexture(accentHex), [accentHex]);
  useEffect(() => () => cardTex.dispose(), [cardTex]);

  return (
    <InkBox
      zone={zone}
      args={size}
      position={position}
      rotation={rotation}
      color="#FFFFFF"
      map={cardTex}
      glowBoost={0.14}
      onClick={onClick}
    />
  );
}

export function MiniTruck({
  zone,
  cabHex = "#FF682C",
  cargoHex = "#FFFFFF",
}: {
  zone: ZoneUniformState;
  cabHex?: string;
  cargoHex?: string;
}) {
  return (
    <group>
      {/* Cargo box */}
      <InkBox zone={zone} args={[0.48, 0.36, 0.34]} position={[-0.12, 0.25, 0]} color={cargoHex} />
      {/* Cab */}
      <InkBox zone={zone} args={[0.24, 0.26, 0.32]} position={[0.24, 0.2, 0]} color={cabHex} />
      {/* Windshield */}
      <InkBox zone={zone} args={[0.04, 0.12, 0.24]} position={[0.35, 0.24, 0]} color="#1D2230" />
      {/* Wheels */}
      {[
        [-0.22, 0.07, 0.17],
        [-0.22, 0.07, -0.17],
        [0.24, 0.07, 0.17],
        [0.24, 0.07, -0.17],
      ].map(([x, y, z], idx) => (
        <InkCylinder
          key={idx}
          zone={zone}
          args={[0.07, 0.07, 0.05, 12]}
          position={[x, y, z]}
          rotation={[Math.PI / 2, 0, 0]}
          color="#1D1D22"
          useEdges={false}
          useHull
          outlineThickness={0.012}
        />
      ))}
    </group>
  );
}
