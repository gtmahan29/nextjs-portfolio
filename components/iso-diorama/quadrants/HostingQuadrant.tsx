"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { ZoneUniformState } from "../types";
import {
  FloatingCard,
  InkBox,
  InkCylinder,
  InkSphere,
  MiniTruck,
  PlatformTile,
  PuffyCloud,
  TinyPerson,
  useCelMaterial,
  useEdgeMaterial,
  useHullOutlineMaterial,
} from "../InkParts";
import { createServerRackTexture } from "../toonShader";

interface HostingQuadrantProps {
  zone: ZoneUniformState;
  position: [number, number, number];
  onHoverZone: (hovering: boolean) => void;
  onSelectZone: () => void;
  onPropAction: (label: string, scoreDelta?: number) => void;
  onPropHover: (hint: string | null) => void;
}

export function HostingQuadrant({
  zone,
  position,
  onHoverZone,
  onSelectZone,
  onPropAction,
  onPropHover,
}: HostingQuadrantProps) {
  const globeRef = useRef<THREE.Group>(null);
  const gearRef = useRef<THREE.Group>(null);
  const craneJibRef = useRef<THREE.Group>(null);
  const payloadRef = useRef<THREE.Group>(null);
  const truck1Ref = useRef<THREE.Group>(null);
  const truck2Ref = useRef<THREE.Group>(null);
  const cloud1Ref = useRef<THREE.Group>(null);
  const cloud2Ref = useRef<THREE.Group>(null);

  const globeTurboRef = useRef(0);
  const gearBoostRef = useRef(0);
  const craneLiftRef = useRef(0);

  const serverTex = useMemo(() => createServerRackTexture("#E94F21", "#FFE89E"), []);
  useEffect(() => () => serverTex.dispose(), [serverTex]);

  // Extruded 8-tooth White Gear Geometry
  const [gearGeo, gearEdges] = useMemo(() => {
    const teeth = 8;
    const outerR = 1.68;
    const rootR = 1.32;
    const innerR = 0.66;
    const shape = new THREE.Shape();

    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.34;
      const a3 = a0 + step * 0.66;
      const a4 = a0 + step * 0.78;

      if (i === 0) {
        shape.moveTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
      } else {
        shape.lineTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
      }
      shape.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
      shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
      shape.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
    }
    shape.closePath();

    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    g.center();
    const eg = new THREE.EdgesGeometry(g, 24);
    return [g, eg];
  }, []);

  useEffect(() => {
    return () => {
      gearGeo.dispose();
      gearEdges.dispose();
    };
  }, [gearGeo, gearEdges]);

  const gearMat = useCelMaterial({ color: "#FFF8F4", glowBoost: 0.14, zone });
  const edgeMat = useEdgeMaterial(zone);
  const wireRingMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#191514" }), []);
  useEffect(() => () => wireRingMat.dispose(), [wireRingMat]);

  // Latitude & Longitude Torus Rings for the Globe
  const globeRingGeo = useMemo(() => new THREE.TorusGeometry(2.01, 0.018, 6, 48), []);
  const latRingGeo1 = useMemo(() => new THREE.TorusGeometry(1.74, 0.017, 6, 44), []);
  const latRingGeo2 = useMemo(() => new THREE.TorusGeometry(1.04, 0.016, 6, 36), []);
  useEffect(() => {
    return () => {
      globeRingGeo.dispose();
      latRingGeo1.dispose();
      latRingGeo2.dispose();
    };
  }, [globeRingGeo, latRingGeo1, latRingGeo2]);

  const globeMat = useCelMaterial({
    color: "#FF966E",
    emissiveColor: "#FFC0A0",
    glowBoost: 0.2,
    zone,
  });
  const globeHullMat = useHullOutlineMaterial(zone, 0.035);
  const globeSphereGeo = useMemo(() => new THREE.SphereGeometry(2.0, 28, 22), []);
  useEffect(() => () => globeSphereGeo.dispose(), [globeSphereGeo]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    globeTurboRef.current = Math.max(0, globeTurboRef.current - delta * 0.85);
    gearBoostRef.current = Math.max(0, gearBoostRef.current - delta * 1.1);
    craneLiftRef.current = Math.max(0, craneLiftRef.current - delta * 0.7);

    // Globe rotation
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * (0.28 + globeTurboRef.current * 4.2);
    }

    // White 8-tooth gear steady spin
    if (gearRef.current) {
      gearRef.current.rotation.y -= delta * (0.45 + gearBoostRef.current * 2.8);
    }

    // Tower crane swivel + hoisting payload
    if (craneJibRef.current) {
      craneJibRef.current.rotation.y = -0.35 + Math.sin(t * 0.45) * 0.28 + Math.sin(craneLiftRef.current * Math.PI) * 0.45;
    }
    if (payloadRef.current) {
      const liftOffset = Math.sin(t * 1.1) * 0.14 + Math.sin(craneLiftRef.current * Math.PI) * 0.72;
      payloadRef.current.position.y = -1.25 + liftOffset;
    }

    // Delivery trucks patrolling
    if (truck1Ref.current) {
      truck1Ref.current.position.x = -1.3 + Math.sin(t * 0.55) * 1.45;
      truck1Ref.current.rotation.y = Math.cos(t * 0.55) >= 0 ? 0 : Math.PI;
    }
    if (truck2Ref.current) {
      truck2Ref.current.position.z = -1.7 + Math.cos(t * 0.48) * 1.15;
      truck2Ref.current.rotation.y = -Math.sin(t * 0.48) >= 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    // Clouds drifting
    if (cloud1Ref.current) {
      cloud1Ref.current.position.z = 1.65 + Math.sin(t * 0.35) * 0.35;
    }
    if (cloud2Ref.current) {
      cloud2Ref.current.position.x = 1.9 + Math.cos(t * 0.3) * 0.3;
    }
  });

  const stopAnd = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    fn();
  };

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHoverZone(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHoverZone(false);
        onPropHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectZone();
      }}
    >
      {/* Base Tile */}
      <PlatformTile zone={zone} topHex="#FF7438" sideHex="#CE4718" gridHex="#EA5A22" />

      {/* Giant Wireframe Globe */}
      <group
        ref={globeRef}
        position={[-0.45, 2.38, -1.25]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Global CDN Network — click for turbo spin");
        }}
        onClick={stopAnd(() => {
          globeTurboRef.current = 1;
          onPropAction("CDN Globe Boost!");
        })}
      >
        <mesh geometry={globeSphereGeo} material={globeMat} castShadow />
        <mesh geometry={globeSphereGeo} material={globeHullMat} />
        {/* Meridian Rings */}
        {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((ry, i) => (
          <mesh key={`m-${i}`} geometry={globeRingGeo} material={wireRingMat} rotation={[0, ry, 0]} />
        ))}
        {/* Equator & Latitude Rings */}
        <mesh geometry={globeRingGeo} material={wireRingMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={latRingGeo1} material={wireRingMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.0, 0]} />
        <mesh geometry={latRingGeo1} material={wireRingMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.0, 0]} />
        <mesh geometry={latRingGeo2} material={wireRingMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.72, 0]} />
        <mesh geometry={latRingGeo2} material={wireRingMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.72, 0]} />
      </group>

      {/* Two Tall Data-Center Server Towers */}
      {[
        { pos: [-2.85, 0.22, -0.75] as [number, number, number], h: 2.85, name: "Primary Rack A" },
        { pos: [2.75, 0.22, -0.55] as [number, number, number], h: 2.95, name: "Primary Rack B" },
        { pos: [2.45, 0.22, -1.95] as [number, number, number], h: 2.25, name: "Edge Node C" },
      ].map((srv, idx) => (
        <group
          key={idx}
          position={srv.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverZone(true);
            onPropHover(`${srv.name} — click to ping servers`);
          }}
          onClick={stopAnd(() => {
            gearBoostRef.current = 0.7;
            onPropAction(`${srv.name}: 99.99% Uptime`);
          })}
        >
          <InkBox
            zone={zone}
            args={[0.92, srv.h, 0.92]}
            position={[0, srv.h / 2, 0]}
            color="#FFFFFF"
            map={serverTex}
            emissiveColor="#FFB27D"
            glowBoost={0.22}
          />
          {/* Roof Cooling Unit */}
          <InkBox zone={zone} args={[0.66, 0.2, 0.66]} position={[0, srv.h + 0.1, 0]} color="#FF8657" />
          <InkCylinder
            zone={zone}
            args={[0.14, 0.14, 0.08, 12]}
            position={[0, srv.h + 0.23, 0]}
            color="#FFF2EA"
            emissiveColor="#FFE1A8"
            baseEmissive={0.25}
            glowBoost={0.5}
          />
        </group>
      ))}

      {/* Giant Rotating White 8-Tooth Gear */}
      <group
        ref={gearRef}
        position={[1.55, 0.42, 1.5]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Infra Engine Gear — click to overdrive");
        }}
        onClick={stopAnd(() => {
          gearBoostRef.current = 1;
          onPropAction("Engine Overdrive!");
        })}
      >
        <mesh geometry={gearGeo} material={gearMat} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
        <lineSegments geometry={gearEdges} material={edgeMat} rotation={[-Math.PI / 2, 0, 0]} />
      </group>

      {/* Tower Crane Lifting Stepped Block */}
      <group
        position={[-0.45, 0.22, 1.6]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Deployment Crane — click to hoist module");
        }}
        onClick={stopAnd(() => {
          craneLiftRef.current = 1;
          onPropAction("Deploying Container Block!");
        })}
      >
        {/* Crane base pad */}
        <InkBox zone={zone} args={[0.72, 0.24, 0.72]} position={[0, 0.12, 0]} color="#FFF5EF" />
        {/* Lattice mast */}
        <InkBox zone={zone} args={[0.24, 3.15, 0.24]} position={[0, 1.8, 0]} color="#FFFFFF" />
        {/* Turret + Jib */}
        <group ref={craneJibRef} position={[0, 3.45, 0]}>
          <InkBox zone={zone} args={[0.38, 0.28, 0.38]} position={[0, 0, 0]} color="#FF7A45" />
          {/* Long boom arm */}
          <InkBox zone={zone} args={[2.35, 0.16, 0.18]} position={[0.75, 0.08, 0]} color="#FFFFFF" />
          {/* Counterweight */}
          <InkBox zone={zone} args={[0.42, 0.28, 0.3]} position={[-0.55, 0.08, 0]} color="#E64A19" />
          {/* Top peak + stay cables */}
          <InkBox zone={zone} args={[0.14, 0.55, 0.14]} position={[0, 0.4, 0]} color="#FFFFFF" />

          {/* Hanging Cable + Stepped Block Payload */}
          <group position={[1.45, 0, 0]}>
            <InkCylinder zone={zone} args={[0.02, 0.02, 1.25, 6]} position={[0, -0.62, 0]} color="#1B1918" />
            <group ref={payloadRef} position={[0, -1.25, 0]}>
              <InkBox zone={zone} args={[0.85, 0.24, 0.85]} position={[0, 0, 0]} color="#FF7C48" />
              <InkBox zone={zone} args={[0.62, 0.22, 0.62]} position={[0, 0.23, 0]} color="#FF966B" />
              <InkBox zone={zone} args={[0.38, 0.18, 0.38]} position={[0, 0.43, 0]} color="#FFB391" />
            </group>
          </group>
        </group>
      </group>

      {/* Floating Browser Window on Scaffolding */}
      <group position={[-1.45, 0.22, -2.55]} rotation={[0, 0.35, 0]}>
        <InkCylinder zone={zone} args={[0.04, 0.04, 1.45, 8]} position={[-0.4, 0.72, -0.06]} color="#2A1E1B" />
        <InkCylinder zone={zone} args={[0.04, 0.04, 1.45, 8]} position={[0.4, 0.72, -0.06]} color="#2A1E1B" />
        <FloatingCard
          zone={zone}
          accentHex="#F35B25"
          position={[0, 1.8, 0]}
          size={[1.25, 1.45, 0.07]}
        />
      </group>

      {/* Patrolling Delivery Trucks */}
      <group ref={truck1Ref} position={[-1.3, 0.22, 3.35]}>
        <MiniTruck zone={zone} cabHex="#FF5E24" cargoHex="#FFFFFF" />
      </group>
      <group ref={truck2Ref} position={[3.35, 0.22, -1.7]}>
        <MiniTruck zone={zone} cabHex="#E54614" cargoHex="#FFF6F0" />
      </group>

      {/* Tiny Hardhat Workers */}
      <TinyPerson zone={zone} position={[0.35, 0.22, 2.75]} rotation={[0, -0.4, 0]} shirtHex="#FFFFFF" hardhatHex="#FFC83D" />
      <TinyPerson zone={zone} position={[2.85, 0.22, 2.65]} rotation={[0, 0.8, 0]} shirtHex="#C83A12" hardhatHex="#FFC83D" />
      <TinyPerson zone={zone} position={[-2.15, 0.22, 2.1]} rotation={[0, 0.4, 0]} shirtHex="#FF9166" hardhatHex="#FFFFFF" />

      {/* Drifting Cartoon Clouds */}
      <group ref={cloud1Ref} position={[-2.4, 2.45, 1.65]}>
        <PuffyCloud zone={zone} scale={1.15} rotationY={0.35} />
      </group>
      <group ref={cloud2Ref} position={[1.9, 3.65, 0.85]}>
        <PuffyCloud zone={zone} scale={0.78} rotationY={-0.3} />
      </group>
    </group>
  );
}
