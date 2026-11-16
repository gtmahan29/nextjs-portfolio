"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { ZoneUniformState } from "../types";
import {
  InkBox,
  InkCylinder,
  InkSphere,
  LollipopTree,
  PlatformTile,
  PuffyCloud,
  TinyPerson,
  useCelMaterial,
  useEdgeMaterial,
  useHullOutlineMaterial,
} from "../InkParts";
import { createHeartBadgeTexture } from "../toonShader";

interface SocialQuadrantProps {
  zone: ZoneUniformState;
  position: [number, number, number];
  onHoverZone: (hovering: boolean) => void;
  onSelectZone: () => void;
  onPropAction: (label: string, scoreDelta?: number) => void;
  onPropHover: (hint: string | null) => void;
}

export function SocialQuadrant({
  zone,
  position,
  onHoverZone,
  onSelectZone,
  onPropAction,
  onPropHover,
}: SocialQuadrantProps) {
  const droneRef = useRef<THREE.Group>(null);
  const rotorRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null]);
  const heartBubbleRef = useRef<THREE.Group>(null);
  const speechGroupRef = useRef<THREE.Group>(null);
  const typingDotsRef = useRef<Array<THREE.Group | null>>([null, null, null]);
  const dishRef = useRef<THREE.Group>(null);
  const floatingHeartsRef = useRef<THREE.Group>(null);
  const cloud1Ref = useRef<THREE.Group>(null);
  const cloud2Ref = useRef<THREE.Group>(null);

  const heartBurstRef = useRef(0);
  const typingBurstRef = useRef(0);
  const dishPingRef = useRef(0);

  const heartTex = useMemo(() => createHeartBadgeTexture("#38C872"), []);
  useEffect(() => () => heartTex.dispose(), [heartTex]);

  // Extruded rounded Speech Bubble with pointer tail
  const [speechGeo, speechEdges] = useMemo(() => {
    const w = 2.6;
    const h = 1.45;
    const r = 0.42;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    // Pointer tail on bottom-left
    shape.lineTo(-w / 2 + 0.52, -h / 2);
    shape.lineTo(-w / 2 + 0.25, -h / 2 - 0.36);
    shape.lineTo(-w / 2 + 0.88, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(w / 2, h / 2 - r);
    shape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    g.center();
    const eg = new THREE.EdgesGeometry(g, 28);
    return [g, eg];
  }, []);

  // Curved S-Ramp / ribbon wall geometry
  const [sRampGeo, sRampEdges] = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.9, 0.0, 0.3, 1.4, 1.25, 1.4);
    shape.bezierCurveTo(2.1, 1.4, 1.75, 0.25, 2.55, 0.25);
    shape.lineTo(2.55, -0.15);
    shape.bezierCurveTo(1.55, -0.15, 1.9, 1.0, 1.25, 1.0);
    shape.bezierCurveTo(0.5, 1.0, 1.05, -0.35, 0, -0.35);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    g.center();
    const eg = new THREE.EdgesGeometry(g, 26);
    return [g, eg];
  }, []);

  // Parabolic satellite dish geometry
  const dishGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const r = (i / 10) * 0.48;
      const y = r * r * 0.9;
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 20);
  }, []);

  useEffect(() => {
    return () => {
      speechGeo.dispose();
      speechEdges.dispose();
      sRampGeo.dispose();
      sRampEdges.dispose();
      dishGeo.dispose();
    };
  }, [speechGeo, speechEdges, sRampGeo, sRampEdges, dishGeo]);

  const speechMat = useCelMaterial({
    color: "#38C272",
    emissiveColor: "#5AF09A",
    glowBoost: 0.22,
    zone,
  });
  const sRampMat = useCelMaterial({ color: "#218B4F", glowBoost: 0.14, zone });
  const dishMat = useCelMaterial({ color: "#F6FAF7", glowBoost: 0.16, zone, side: THREE.DoubleSide });
  const dishHullMat = useHullOutlineMaterial(zone, 0.022);
  const edgeMat = useEdgeMaterial(zone);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    heartBurstRef.current = Math.max(0, heartBurstRef.current - delta * 0.95);
    typingBurstRef.current = Math.max(0, typingBurstRef.current - delta * 1.3);
    dishPingRef.current = Math.max(0, dishPingRef.current - delta * 1.1);

    // Drone hover + rotor spin
    if (droneRef.current) {
      const hop = Math.sin(heartBurstRef.current * Math.PI) * 0.45;
      droneRef.current.position.y = 4.35 + Math.sin(t * 2.2) * 0.14 + hop;
      droneRef.current.rotation.z = Math.sin(t * 1.4) * 0.06;
      droneRef.current.rotation.x = Math.cos(t * 1.1) * 0.05;
    }

    rotorRefs.current.forEach((m, idx) => {
      if (!m) return;
      m.rotation.y += delta * (26 + idx * 2 + heartBurstRef.current * 24);
    });

    if (heartBubbleRef.current) {
      heartBubbleRef.current.rotation.y = Math.sin(t * 1.6) * 0.18;
      const pulse = 1 + Math.sin(t * 3.5) * 0.04 + heartBurstRef.current * 0.18;
      heartBubbleRef.current.scale.set(pulse, pulse, pulse);
    }

    // Floating burst hearts rising from speech/drone
    if (floatingHeartsRef.current) {
      const b = heartBurstRef.current;
      floatingHeartsRef.current.visible = b > 0.01;
      floatingHeartsRef.current.children.forEach((child, idx) => {
        const progress = 1 - b;
        child.position.y = progress * (1.8 + idx * 0.35);
        child.position.x = Math.sin(progress * 6 + idx * 2) * 0.32;
        const s = Math.sin(b * Math.PI) * (0.85 - idx * 0.12);
        child.scale.setScalar(Math.max(0.01, s));
      });
    }

    // Speech bubble typing dots wave
    typingDotsRef.current.forEach((grp, idx) => {
      if (!grp) return;
      const speed = typingBurstRef.current > 0 ? 9.5 : 4.2;
      const jump = Math.max(0, Math.sin(t * speed - idx * 0.85)) * (0.14 + typingBurstRef.current * 0.18);
      grp.position.y = jump;
    });

    if (speechGroupRef.current) {
      speechGroupRef.current.position.y = 2.65 + Math.sin(t * 1.5) * 0.07;
    }

    // Satellite dish tracking
    if (dishRef.current) {
      dishRef.current.rotation.y = Math.sin(t * 0.7) * 0.45 + dishPingRef.current * Math.PI * 2;
    }

    // Drifting clouds
    if (cloud1Ref.current) {
      cloud1Ref.current.position.x = -0.35 + Math.sin(t * 0.32) * 0.35;
    }
    if (cloud2Ref.current) {
      cloud2Ref.current.position.x = 2.35 + Math.cos(t * 0.28) * 0.35;
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
      {/* Base Platform */}
      <PlatformTile zone={zone} topHex="#4BC882" sideHex="#1E8449" gridHex="#34A867" />

      {/* Stepped Green Voxel Terraces */}
      <group position={[-0.95, 0.22, 0.45]}>
        <InkBox zone={zone} args={[3.1, 0.45, 2.7]} position={[0, 0.225, 0]} color="#3BC073" />
        <InkBox zone={zone} args={[1.9, 0.55, 1.8]} position={[0.35, 0.725, -0.25]} color="#2FA661" />
        <InkBox zone={zone} args={[1.15, 0.65, 1.15]} position={[0.45, 1.32, -0.4]} color="#238E50" />
        {/* Step stairs */}
        <InkBox zone={zone} args={[0.9, 0.24, 0.65]} position={[-1.05, 0.57, 0.4]} color="#53D289" />
        <InkBox zone={zone} args={[0.7, 0.28, 0.7]} position={[-0.4, 0.85, 0.45]} color="#42C478" />
      </group>

      {/* Tiny Conversing People & Dog on the Grass Terrace */}
      <TinyPerson zone={zone} position={[-0.45, 1.87, 0.05]} rotation={[0, -0.4, 0]} shirtHex="#1C6B3D" />
      <TinyPerson zone={zone} position={[-1.95, 0.67, 1.15]} rotation={[0, 0.7, 0]} shirtHex="#E6F5EC" />
      {/* Tiny Dog */}
      <group position={[-2.28, 0.67, 0.92]} rotation={[0, 0.6, 0]}>
        <InkBox zone={zone} args={[0.24, 0.14, 0.11]} position={[0, 0.11, 0]} color="#FFFFFF" />
        <InkBox zone={zone} args={[0.11, 0.12, 0.11]} position={[0.12, 0.19, 0]} color="#FFFFFF" />
      </group>

      {/* Giant Typing Speech Bubble (•••) */}
      <group
        ref={speechGroupRef}
        position={[0.45, 2.65, -1.65]}
        rotation={[0, -0.2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Live Chat Bubble — click for reaction burst");
        }}
        onClick={stopAnd(() => {
          typingBurstRef.current = 1;
          heartBurstRef.current = 1;
          onPropAction("Live Chat Reaction ♥!");
        })}
      >
        <mesh geometry={speechGeo} material={speechMat} castShadow />
        <lineSegments geometry={speechEdges} material={edgeMat} />
        {/* 3 animated typing dots */}
        {[-0.68, 0, 0.68].map((dx, idx) => (
          <group
            key={idx}
            ref={(el) => {
              typingDotsRef.current[idx] = el;
            }}
            position={[dx, 0.08, 0.28]}
          >
            <InkSphere
              zone={zone}
              args={[0.21, 16, 12]}
              color="#FFFFFF"
              emissiveColor="#B8FFDA"
              baseEmissive={0.18}
              glowBoost={0.45}
              outlineThickness={0.022}
            />
          </group>
        ))}
      </group>

      {/* Hovering Quad-Rotor Drone + Glowing Heart Bubble */}
      <group
        ref={droneRef}
        position={[-2.55, 4.35, -2.1]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Heart Drone — click to drop likes!");
        }}
        onClick={stopAnd(() => {
          heartBurstRef.current = 1;
          onPropAction("Liked by Drone ♥ +1", 1);
        })}
      >
        {/* Drone center body */}
        <InkBox zone={zone} args={[0.42, 0.16, 0.42]} color="#FFFFFF" />
        {/* 4 arms + rotors */}
        {[
          [-0.45, 0.06, -0.45],
          [0.45, 0.06, -0.45],
          [-0.45, 0.06, 0.45],
          [0.45, 0.06, 0.45],
        ].map(([ax, ay, az], idx) => (
          <group key={idx} position={[ax, ay, az]}>
            <InkCylinder
              zone={zone}
              args={[0.04, 0.04, 0.62, 8]}
              position={[-ax * 0.48, -0.02, -az * 0.48]}
              rotation={[0, (idx === 0 || idx === 3 ? 1 : -1) * (Math.PI / 4), Math.PI / 2]}
              color="#22232B"
            />
            <InkCylinder zone={zone} args={[0.08, 0.08, 0.1, 10]} color="#22232B" />
            <mesh
              ref={(el) => {
                rotorRefs.current[idx] = el;
              }}
              position={[0, 0.07, 0]}
            >
              <boxGeometry args={[0.56, 0.015, 0.07]} />
              <meshBasicMaterial color="#19191E" />
            </mesh>
          </group>
        ))}

        {/* Suspension wire */}
        <InkCylinder zone={zone} args={[0.016, 0.016, 0.85, 6]} position={[0, -0.48, 0]} color="#1B1B20" />

        {/* Glowing Heart Speech Bubble (keeps glow in dim mode like video!) */}
        <group ref={heartBubbleRef} position={[0, -1.18, 0]} rotation={[0, 0.45, 0]}>
          <InkBox
            zone={zone}
            args={[0.92, 0.82, 0.22]}
            color="#FFFFFF"
            map={heartTex}
            emissiveColor="#4AF58E"
            baseEmissive={0.28}
            glowBoost={0.75}
            keepGlowInDim={0.55}
          />
        </group>

        {/* Burst mini hearts when clicked */}
        <group ref={floatingHeartsRef} position={[0, -0.6, 0]} visible={false}>
          {[0, 1, 2].map((hIdx) => (
            <InkSphere
              key={hIdx}
              zone={zone}
              args={[0.14, 12, 10]}
              position={[(hIdx - 1) * 0.25, 0, 0]}
              color="#4AF58E"
              emissiveColor="#8AFFB9"
              baseEmissive={0.5}
              glowBoost={0.5}
              keepGlowInDim={0.5}
              outlineThickness={0.014}
            />
          ))}
        </group>
      </group>

      {/* Curved S-Ramp Wall + Satellite Dish */}
      <group position={[2.25, 1.0, 0.35]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={sRampGeo} material={sRampMat} castShadow receiveShadow />
        <lineSegments geometry={sRampEdges} material={edgeMat} />
      </group>

      {/* Satellite Dish & Engineer */}
      <group
        position={[2.05, 0.22, 2.25]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Social Uplink Dish — click to broadcast");
        }}
        onClick={stopAnd(() => {
          dishPingRef.current = 1;
          onPropAction("Social Signal Broadcast!");
        })}
      >
        <InkCylinder zone={zone} args={[0.25, 0.32, 0.35, 14]} position={[0, 0.175, 0]} color="#E6ECE8" />
        <group ref={dishRef} position={[0, 0.5, 0]}>
          <group rotation={[0.68, 0, 0]}>
            <mesh geometry={dishGeo} material={dishMat} castShadow />
            <mesh geometry={dishGeo} material={dishHullMat} />
            <InkCylinder zone={zone} args={[0.025, 0.025, 0.45, 8]} position={[0, 0.25, 0]} color="#25262E" />
            <InkSphere
              zone={zone}
              args={[0.08, 10, 8]}
              position={[0, 0.48, 0]}
              color="#FF6B4A"
              emissiveColor="#FF8669"
              baseEmissive={0.45}
              glowBoost={0.6}
              keepGlowInDim={0.2}
              outlineThickness={0.012}
            />
          </group>
        </group>
      </group>
      <TinyPerson zone={zone} position={[1.35, 0.22, 2.45]} rotation={[0, 0.5, 0]} shirtHex="#E45735" />

      {/* Stylized Lollipop Trees & Bushes */}
      <LollipopTree zone={zone} position={[-2.95, 0.22, -2.55]} scale={1.15} leafHex="#49C87B" />
      <LollipopTree zone={zone} position={[-2.05, 0.22, -2.9]} scale={0.85} leafHex="#2FA661" />
      <LollipopTree zone={zone} position={[0.1, 0.22, -2.95]} scale={0.78} leafHex="#3BBC6E" />
      <LollipopTree zone={zone} position={[1.45, 0.22, -2.65]} scale={1.05} leafHex="#279253" />

      {/* Drifting Cartoon Clouds */}
      <group ref={cloud1Ref} position={[-0.35, 4.15, -3.15]}>
        <PuffyCloud zone={zone} scale={0.55} />
      </group>
      <group ref={cloud2Ref} position={[2.35, 4.3, -1.75]}>
        <PuffyCloud zone={zone} scale={0.95} rotationY={0.4} />
      </group>
    </group>
  );
}
