"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { ZoneUniformState } from "../types";
import {
  FloatingCard,
  InkBox,
  InkCylinder,
  InkSphere,
  InkTorus,
  PlatformTile,
  TinyPerson,
  useCelMaterial,
  useEdgeMaterial,
} from "../InkParts";
import { createTextLabelTexture } from "../toonShader";

interface SeoQuadrantProps {
  zone: ZoneUniformState;
  position: [number, number, number];
  onHoverZone: (hovering: boolean) => void;
  onSelectZone: () => void;
  onPropAction: (label: string, scoreDelta?: number) => void;
  onPropHover: (hint: string | null) => void;
}

const KEYWORDS = ["KEYWORD_", "RANK #1", "TRAFFIC ↑", "ORGANIC"];

export function SeoQuadrant({
  zone,
  position,
  onHoverZone,
  onSelectZone,
  onPropAction,
  onPropHover,
}: SeoQuadrantProps) {
  const [kwIdx, setKwIdx] = useState(0);
  const barSurgeRef = useRef(0);
  const trainBoostRef = useRef(0);

  const barRefs = useRef<Array<THREE.Group | null>>([null, null, null]);
  const trainRef = useRef<THREE.Group>(null);
  const wifiArcsRef = useRef<Array<THREE.Group | null>>([null, null, null]);
  const cardsRef = useRef<Array<THREE.Group | null>>([null, null, null]);
  const cyclistRef = useRef<THREE.Group>(null);

  const textures = useMemo(() => {
    const seoTitle = createTextLabelTexture("SEO", {
      bg: "#AEA5E8",
      fg: "#171622",
      border: "#171622",
      width: 320,
      height: 220,
      fontSize: 120,
      radius: 20,
    });
    const keywordBar = createTextLabelTexture(KEYWORDS[kwIdx], {
      bg: "#FFFFFF",
      fg: "#171624",
      border: "#171624",
      width: 640,
      height: 176,
      fontSize: 78,
      radius: 28,
      subBadge: "search",
    });
    return { seoTitle, keywordBar };
  }, [kwIdx]);

  useEffect(() => {
    return () => {
      textures.seoTitle.dispose();
      textures.keywordBar.dispose();
    };
  }, [textures]);

  // Extruded tunnel arch geometry
  const [tunnelGeo, tunnelEdges] = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.1, 0);
    shape.lineTo(-1.1, 1.55);
    shape.lineTo(1.1, 1.55);
    shape.lineTo(1.1, 0);
    shape.lineTo(0.55, 0);
    shape.absarc(0, 0.25, 0.55, 0, Math.PI, false);
    shape.lineTo(-1.1, 0);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 2.3,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    g.center();
    const eg = new THREE.EdgesGeometry(g, 24);
    return [g, eg];
  }, []);

  useEffect(() => {
    return () => {
      tunnelGeo.dispose();
      tunnelEdges.dispose();
    };
  }, [tunnelGeo, tunnelEdges]);

  const tunnelMat = useCelMaterial({ color: "#9C92DE", zone, glowBoost: 0.14 });
  const seoDecalMat = useCelMaterial({
    color: "#FFFFFF",
    map: textures.seoTitle,
    emissiveColor: "#C3B8FF",
    glowBoost: 0.24,
    zone,
  });
  const keywordDecalMat = useCelMaterial({
    color: "#FFFFFF",
    map: textures.keywordBar,
    emissiveColor: "#CFC8FF",
    glowBoost: 0.25,
    zone,
  });
  const edgeMat = useEdgeMaterial(zone);
  const lensGlassMat = useCelMaterial({
    color: "#B4ACEF",
    emissiveColor: "#A598FF",
    baseEmissive: 0.15,
    glowBoost: 0.35,
    keepGlowInDim: 0.12,
    opacity: 0.28,
    transparent: true,
    zone,
  });

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    barSurgeRef.current = Math.max(0, barSurgeRef.current - delta * 1.2);
    trainBoostRef.current = Math.max(0, trainBoostRef.current - delta * 0.9);

    // Ascending bar chart pulse
    const baseHeights = [1.45, 2.25, 3.05];
    barRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      const surge =
        barSurgeRef.current > 0
          ? Math.sin(barSurgeRef.current * Math.PI) * (0.28 + idx * 0.14)
          : Math.sin(t * 1.7 + idx * 0.9) * 0.04;
      const targetScaleY = 1 + surge / baseHeights[idx];
      grp.scale.y = THREE.MathUtils.lerp(grp.scale.y, targetScaleY, 0.15);
    });

    // Express metro train emerging along Z out of the tunnel
    if (trainRef.current) {
      const speed = trainBoostRef.current > 0 ? 1.8 : 0.48;
      const phase = ((t * speed) % 2) / 2; // 0..1 loop
      // Smooth back-and-forth glide out of tunnel into view
      const zPos = -0.3 + Math.sin(phase * Math.PI * 2) * 1.15 + 0.55;
      trainRef.current.position.z = zPos;
    }

    // Pulsing WiFi arcs
    wifiArcsRef.current.forEach((grp, idx) => {
      if (!grp) return;
      const wave = (Math.sin(t * 3.4 - idx * 0.9) + 1) * 0.5;
      const s = 0.94 + wave * 0.1;
      grp.scale.set(s, s, s);
    });

    // Floating search result cards
    cardsRef.current.forEach((grp, idx) => {
      if (!grp) return;
      grp.position.y = [2.45, 1.95, 1.5][idx] + Math.sin(t * 1.6 + idx * 1.3) * 0.09;
    });

    // Cyclist gentle patrol
    if (cyclistRef.current) {
      cyclistRef.current.position.x = 1.95 + Math.sin(t * 0.8) * 0.55;
      cyclistRef.current.rotation.y = Math.cos(t * 0.8) >= 0 ? Math.PI / 2 : -Math.PI / 2;
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
      <PlatformTile zone={zone} topHex="#D1CBF4" sideHex="#8D84D4" gridHex="#ACA4E4" />

      {/* 3 Ascending Bar Chart Columns + Ladder */}
      <group
        position={[-2.55, 0.22, -1.65]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Traffic Analytics Bars — click to surge");
        }}
        onClick={stopAnd(() => {
          barSurgeRef.current = 1;
          onPropAction("Organic Traffic Surge!");
        })}
      >
        {[
          { x: -0.95, z: 0.75, h: 1.45, col: "#746AD2" },
          { x: -0.2, z: 0.0, h: 2.25, col: "#857CE0" },
          { x: 0.55, z: -0.75, h: 3.05, col: "#665CC4" },
        ].map((bar, idx) => (
          <group
            key={idx}
            ref={(el) => {
              barRefs.current[idx] = el;
            }}
            position={[bar.x, 0, bar.z]}
          >
            <InkBox
              zone={zone}
              args={[0.72, bar.h, 0.72]}
              position={[0, bar.h / 2, 0]}
              color={bar.col}
              glowBoost={0.18}
            />
          </group>
        ))}

        {/* Tiny leaning ladder against tallest/middle bar */}
        <group position={[-0.25, 0.85, 0.52]} rotation={[-0.22, 0, 0]}>
          <InkBox zone={zone} args={[0.04, 1.75, 0.04]} position={[-0.14, 0, 0]} color="#1D1B2A" />
          <InkBox zone={zone} args={[0.04, 1.75, 0.04]} position={[0.14, 0, 0]} color="#1D1B2A" />
          {[-0.6, -0.3, 0, 0.3, 0.6].map((y, rIdx) => (
            <InkBox key={rIdx} zone={zone} args={[0.26, 0.035, 0.035]} position={[0, y, 0]} color="#1D1B2A" />
          ))}
        </group>
      </group>

      {/* Metro Station Tunnel + Express Train + WiFi Beacon */}
      <group
        position={[-0.55, 0.22, -0.2]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("SEO Express Tunnel — click to dispatch train");
        }}
        onClick={stopAnd(() => {
          trainBoostRef.current = 1;
          onPropAction("SEO Train Dispatched!");
        })}
      >
        <mesh geometry={tunnelGeo} material={tunnelMat} position={[0, 0.82, 0]} castShadow receiveShadow />
        <lineSegments geometry={tunnelEdges} material={edgeMat} position={[0, 0.82, 0]} />

        {/* Dark tunnel interior core */}
        <InkBox zone={zone} args={[0.92, 0.78, 1.9]} position={[0, 0.41, 0]} color="#1C1A28" />

        {/* Twin Rails extending forward */}
        <InkBox zone={zone} args={[0.06, 0.05, 2.3]} position={[-0.26, 0.03, 1.45]} color="#4B456B" />
        <InkBox zone={zone} args={[0.06, 0.05, 2.3]} position={[0.26, 0.03, 1.45]} color="#4B456B" />

        {/* Animated Express Train */}
        <group ref={trainRef} position={[0, 0.26, 0.9]}>
          <InkBox zone={zone} args={[0.64, 0.56, 1.35]} position={[0, 0.28, 0]} color="#685EC6" glowBoost={0.18} />
          <InkBox zone={zone} args={[0.66, 0.14, 1.36]} position={[0, 0.42, 0]} color="#FFFFFF" />
          {/* Front windshield + glowing headlights */}
          <InkBox zone={zone} args={[0.5, 0.2, 0.04]} position={[0, 0.36, 0.68]} color="#1D1B2B" />
          <InkSphere
            zone={zone}
            args={[0.065, 10, 8]}
            position={[-0.18, 0.16, 0.69]}
            color="#FFF7CE"
            emissiveColor="#FFE77A"
            baseEmissive={0.65}
            glowBoost={0.7}
            keepGlowInDim={0.25}
            outlineThickness={0.01}
          />
          <InkSphere
            zone={zone}
            args={[0.065, 10, 8]}
            position={[0.18, 0.16, 0.69]}
            color="#FFF7CE"
            emissiveColor="#FFE77A"
            baseEmissive={0.65}
            glowBoost={0.7}
            keepGlowInDim={0.25}
            outlineThickness={0.01}
          />
        </group>

        {/* Station Roof WiFi Transmitter Arcs */}
        <group position={[-0.35, 1.65, -0.35]} rotation={[0, 0.35, 0]}>
          <InkSphere
            zone={zone}
            args={[0.11, 12, 10]}
            position={[0, 0.1, 0]}
            color="#FFFFFF"
            emissiveColor="#C8BFFF"
            baseEmissive={0.35}
            glowBoost={0.65}
            keepGlowInDim={0.2}
            outlineThickness={0.015}
          />
          {[0.28, 0.48, 0.68].map((rad, idx) => (
            <group
              key={idx}
              ref={(el) => {
                wifiArcsRef.current[idx] = el;
              }}
              position={[0, 0.1, 0]}
            >
              <mesh rotation={[0, 0, Math.PI * 0.25]}>
                <torusGeometry args={[rad, 0.036, 8, 20, Math.PI * 0.5]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            </group>
          ))}
        </group>

        {/* Tiny Roof Spotter */}
        <TinyPerson zone={zone} position={[0.5, 1.62, 0.45]} rotation={[0, 0.4, 0]} shirtHex="#584FB5" />
      </group>

      {/* SEO Corner Block with Sitting Figure */}
      <group position={[-0.55, 0.22, 2.4]}>
        <InkBox zone={zone} args={[1.65, 0.92, 1.35]} position={[0, 0.46, 0]} color="#9A90DC" />
        {/* SEO Label Plaque flat on top */}
        <group position={[0, 0.95, 0]}>
          <InkBox
            zone={zone}
            args={[1.25, 0.08, 0.92]}
            color="#AEA5E8"
            emissiveColor="#C3B8FF"
            glowBoost={0.2}
          />
          <mesh position={[0, 0.044, 0]} rotation={[-Math.PI / 2, 0, 0]} material={seoDecalMat}>
            <planeGeometry args={[1.18, 0.85]} />
          </mesh>
        </group>
        {/* Side circular tunnel port */}
        <InkCylinder
          zone={zone}
          args={[0.28, 0.28, 0.12, 20]}
          position={[0.84, 0.42, 0]}
          rotation={[0, 0, Math.PI / 2]}
          color="#1E1C2D"
        />
        <TinyPerson
          zone={zone}
          position={[0.45, 0.94, 0.45]}
          rotation={[0, 0.4, 0]}
          shirtHex="#5F54BF"
          sitting
        />
      </group>

      {/* Giant Magnifying Glass + Interactive KEYWORD_ Search Bar */}
      <group position={[1.75, 0.22, 0.65]}>
        {/* Pedestal */}
        <InkCylinder zone={zone} args={[0.38, 0.45, 0.2, 20]} position={[0, 0.1, 0]} color="#7D73D0" />
        <InkCylinder zone={zone} args={[0.14, 0.16, 1.25, 16]} position={[0, 0.72, 0]} color="#685EC6" />

        {/* Magnifying Ring Lens angled toward isometric camera */}
        <group position={[0, 2.48, 0]} rotation={[0, 0.48, 0]}>
          <InkTorus
            zone={zone}
            args={[1.22, 0.16, 16, 48]}
            color="#685EC6"
            emissiveColor="#A498FF"
            glowBoost={0.28}
            outlineThickness={0.03}
          />
          <mesh material={lensGlassMat}>
            <circleGeometry args={[1.12, 36]} />
          </mesh>

          {/* Interactive KEYWORD_ Search Bar passing horizontally */}
          <group
            position={[0.2, -0.05, 0.16]}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverZone(true);
              onPropHover("KEYWORD_ Search — click to cycle rankings");
            }}
            onClick={stopAnd(() => {
              const next = (kwIdx + 1) % KEYWORDS.length;
              setKwIdx(next);
              onPropAction(`Query: ${KEYWORDS[next]}`);
            })}
          >
            {/* Clean white frame */}
            <InkBox
              zone={zone}
              args={[2.45, 0.68, 0.16]}
              color="#FFFFFF"
              emissiveColor="#CFC8FF"
              glowBoost={0.18}
            />
            {/* Front & back crisp KEYWORD_ face decals */}
            <mesh position={[0, 0, 0.084]} material={keywordDecalMat}>
              <planeGeometry args={[2.38, 0.62]} />
            </mesh>
            <mesh position={[0, 0, -0.084]} rotation={[0, Math.PI, 0]} material={keywordDecalMat}>
              <planeGeometry args={[2.38, 0.62]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 3 Floating Search Result / Webpage Cards */}
      <group
        ref={(el) => {
          cardsRef.current[0] = el;
        }}
        position={[-0.1, 2.45, -2.15]}
      >
        <FloatingCard
          zone={zone}
          accentHex="#7E74D8"
          rotation={[0, 0.35, 0]}
          size={[1.22, 1.52, 0.07]}
        />
      </group>
      <group
        ref={(el) => {
          cardsRef.current[1] = el;
        }}
        position={[2.75, 1.95, -0.65]}
      >
        <FloatingCard
          zone={zone}
          accentHex="#8E84E4"
          rotation={[0, -0.55, 0]}
          size={[1.1, 1.38, 0.07]}
        />
      </group>
      <group
        ref={(el) => {
          cardsRef.current[2] = el;
        }}
        position={[0.75, 1.5, 1.55]}
      >
        <FloatingCard
          zone={zone}
          accentHex="#6B60C8"
          rotation={[0, 0.25, 0]}
          size={[0.95, 1.15, 0.06]}
        />
      </group>

      {/* Glowing Bollards & Cyclist */}
      {[1.1, 2.5].map((bx, i) => (
        <group key={i} position={[bx, 0.22, 2.55]}>
          <InkCylinder zone={zone} args={[0.11, 0.12, 0.55, 14]} position={[0, 0.275, 0]} color="#9E94DF" />
          <InkSphere
            zone={zone}
            args={[0.1, 12, 10]}
            position={[0, 0.6, 0]}
            color="#FFFFFF"
            emissiveColor="#CFC8FF"
            baseEmissive={0.4}
            glowBoost={0.5}
            keepGlowInDim={0.18}
            outlineThickness={0.015}
          />
        </group>
      ))}

      <group ref={cyclistRef} position={[1.95, 0.22, 2.95]}>
        <InkTorus zone={zone} args={[0.14, 0.03, 8, 18]} position={[-0.18, 0.16, 0]} color="#1B1A26" outlineThickness={0.01} />
        <InkTorus zone={zone} args={[0.14, 0.03, 8, 18]} position={[0.18, 0.16, 0]} color="#1B1A26" outlineThickness={0.01} />
        <TinyPerson zone={zone} position={[0, 0.12, 0]} rotation={[0, Math.PI / 2, 0]} shirtHex="#584FB5" />
      </group>
    </group>
  );
}
