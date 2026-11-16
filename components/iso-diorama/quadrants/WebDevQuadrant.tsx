"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { ZoneUniformState } from "../types";
import {
  InkBox,
  InkCylinder,
  InkSphere,
  InkTorus,
  PlatformTile,
  TinyPerson,
  useCelMaterial,
} from "../InkParts";
import { createTextLabelTexture } from "../toonShader";

interface WebDevQuadrantProps {
  zone: ZoneUniformState;
  position: [number, number, number];
  onHoverZone: (hovering: boolean) => void;
  onSelectZone: () => void;
  onPropAction: (label: string, scoreDelta?: number) => void;
  onPropHover: (hint: string | null) => void;
}

const CODE_MODES = ["</>", "{ }", "TSX"];

export function WebDevQuadrant({
  zone,
  position,
  onHoverZone,
  onSelectZone,
  onPropAction,
  onPropHover,
}: WebDevQuadrantProps) {
  const [codeIdx, setCodeIdx] = useState(0);
  const htmlBurstRef = useRef(0);
  const phpWaveRef = useRef(0);
  const hoopShotRef = useRef(0);

  const htmlLettersRef = useRef<Array<THREE.Group | null>>([null, null, null, null]);
  const phpBlocksRef = useRef<Array<THREE.Group | null>>([null, null, null]);
  const ballRef = useRef<THREE.Group>(null);
  const hoopRingRef = useRef<THREE.Group>(null);
  const domeGlowRef = useRef<THREE.Mesh>(null);

  // Sharp canvas textures for CSS plaque, code window, PHP letters, HTML letters
  const textures = useMemo(() => {
    const css = createTextLabelTexture("CSS", {
      bg: "#FFF9EB",
      fg: "#17171B",
      width: 512,
      height: 300,
      fontSize: 156,
      radius: 36,
    });
    const codeBadge = createTextLabelTexture(CODE_MODES[codeIdx], {
      bg: "#F0A829",
      fg: "#17171B",
      width: 320,
      height: 220,
      fontSize: 112,
      radius: 26,
    });
    const browserCard = createTextLabelTexture(" ", {
      bg: "#FFF9EA",
      fg: "#D99426",
      width: 360,
      height: 440,
      fontSize: 40,
      radius: 26,
      subBadge: "dots",
    });
    const htmlGlyphs = ["H", "T", "M", "L"].map((ch) =>
      createTextLabelTexture(ch, {
        bg: "#FFF8DC",
        fg: "#231B0A",
        border: "#B77A14",
        width: 192,
        height: 192,
        fontSize: 120,
        radius: 30,
      })
    );
    const phpGlyphs = ["P", "H", "P"].map((ch) =>
      createTextLabelTexture(ch, {
        bg: "#F8BD48",
        fg: "#181510",
        border: "#181510",
        width: 192,
        height: 192,
        fontSize: 120,
        radius: 22,
      })
    );
    return { css, codeBadge, browserCard, htmlGlyphs, phpGlyphs };
  }, [codeIdx]);

  useEffect(() => {
    return () => {
      textures.css.dispose();
      textures.codeBadge.dispose();
      textures.browserCard.dispose();
      textures.htmlGlyphs.forEach((t) => t.dispose());
      textures.phpGlyphs.forEach((t) => t.dispose());
    };
  }, [textures]);

  // Translucent capsule dome material
  const glassDomeMat = useCelMaterial({
    color: "#FFFDF6",
    emissiveColor: "#FFE896",
    baseEmissive: 0.24,
    glowBoost: 0.36,
    keepGlowInDim: 0.14,
    opacity: 0.22,
    transparent: true,
    zone,
  });
  const glassRimMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#1B1812",
        transparent: true,
        opacity: 0.45,
      }),
    []
  );
  useEffect(() => () => glassRimMat.dispose(), [glassRimMat]);
  const netMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#221E18",
        wireframe: true,
        transparent: true,
        opacity: 0.58,
      }),
    []
  );
  useEffect(() => () => netMat.dispose(), [netMat]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Decay trigger impulses
    htmlBurstRef.current = Math.max(0, htmlBurstRef.current - delta * 1.4);
    phpWaveRef.current = Math.max(0, phpWaveRef.current - delta * 1.3);
    hoopShotRef.current = Math.max(0, hoopShotRef.current - delta * 0.9);

    // Floating H T M L letters inside the dome
    const heights = [1.05, 1.68, 2.28, 2.88];
    htmlLettersRef.current.forEach((grp, idx) => {
      if (!grp) return;
      const burst = htmlBurstRef.current;
      const bob = Math.sin(t * 2.1 + idx * 1.1) * 0.08 + burst * (0.35 + idx * 0.12);
      grp.position.y = heights[idx] + bob;
      grp.rotation.y = Math.sin(t * 0.9 + idx * 0.8) * 0.45 + burst * Math.PI * 2;
      grp.rotation.z = Math.cos(t * 1.2 + idx) * 0.12;
    });

    if (domeGlowRef.current) {
      const pulse = 1 + Math.sin(t * 3.0) * 0.05 + htmlBurstRef.current * 0.25;
      domeGlowRef.current.scale.set(pulse, 1, pulse);
    }

    // PHP blocks wave bounce
    phpBlocksRef.current.forEach((grp, idx) => {
      if (!grp) return;
      const wave =
        phpWaveRef.current > 0
          ? Math.max(0, Math.sin(phpWaveRef.current * Math.PI * 2 - idx * 0.7)) * 0.26
          : 0;
      grp.position.y = 0.72 + Math.sin(t * 1.8 + idx * 0.8) * 0.02 + wave;
    });

    // Basketball cube parabolic shot into the CSS hoop
    if (ballRef.current) {
      const cycle = hoopShotRef.current > 0 ? 1 - hoopShotRef.current : (t * 0.42) % 1;
      // Arc from front-right [3.05, 1.3, 1.4] -> hoop [2.7, 2.55, -0.35] -> drop through net to floor [2.7, 0.75, -0.35]
      if (cycle < 0.58) {
        const u = cycle / 0.58;
        const bx = THREE.MathUtils.lerp(2.95, 2.68, u);
        const bz = THREE.MathUtils.lerp(1.55, -0.25, u);
        const by = THREE.MathUtils.lerp(0.95, 2.52, u) + Math.sin(u * Math.PI) * 1.45;
        ballRef.current.position.set(bx, by, bz);
        ballRef.current.rotation.set(u * 4.2, u * 3.1, u * 2.0);
      } else if (cycle < 0.85) {
        const u = (cycle - 0.58) / 0.27;
        ballRef.current.position.set(2.68, THREE.MathUtils.lerp(2.52, 0.68, u * u), -0.25);
        ballRef.current.rotation.set(u * 2, 0, u * 2);
      } else {
        const u = (cycle - 0.85) / 0.15;
        const bounce = Math.sin(u * Math.PI) * 0.24;
        ballRef.current.position.set(
          THREE.MathUtils.lerp(2.68, 2.95, u),
          0.68 + bounce,
          THREE.MathUtils.lerp(-0.25, 1.55, u)
        );
      }
    }

    if (hoopRingRef.current) {
      const wiggle = hoopShotRef.current > 0 ? Math.sin(hoopShotRef.current * 18) * 0.08 : 0;
      hoopRingRef.current.rotation.z = wiggle;
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
      <PlatformTile
        zone={zone}
        topHex="#FCECB8"
        sideHex="#E6AA39"
        gridHex="#E5C880"
      />

      {/* Floor Data Pipes connecting HTML dome -> PHP plinth -> Stairs */}
      <InkBox zone={zone} args={[2.1, 0.14, 0.28]} position={[-1.0, 0.29, 0.8]} color="#F5B841" />
      <InkBox zone={zone} args={[0.28, 0.14, 1.55]} position={[0.0, 0.29, 1.45]} color="#F5B841" />
      <InkBox zone={zone} args={[1.35, 0.12, 0.24]} position={[-0.75, 0.28, -0.35]} color="#F2AE30" />

      {/* HTML Glowing Glass Dome (Left Corner) */}
      <group
        position={[-2.15, 0.22, 0.75]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("HTML Capsule — click to surge letters");
        }}
        onClick={stopAnd(() => {
          htmlBurstRef.current = 1;
          onPropAction("HTML Capsule Surge!");
        })}
      >
        {/* Stepped golden base */}
        <InkCylinder zone={zone} args={[1.05, 1.15, 0.36, 28]} position={[0, 0.18, 0]} color="#ECA62D" />
        <InkCylinder zone={zone} args={[0.85, 0.96, 0.24, 28]} position={[0, 0.46, 0]} color="#F7C24E" />
        {/* Glowing inner energy disc */}
        <mesh ref={domeGlowRef} position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.72, 24]} />
          <meshBasicMaterial color="#FFF6C4" />
        </mesh>

        {/* Side pipes emerging from pedestal */}
        <InkCylinder
          zone={zone}
          args={[0.11, 0.11, 0.9, 14]}
          position={[-1.1, 0.22, 0.3]}
          rotation={[0, 0, Math.PI / 2]}
          color="#EDA832"
        />
        <InkCylinder
          zone={zone}
          args={[0.11, 0.11, 0.9, 14]}
          position={[0.25, 0.22, 1.15]}
          rotation={[Math.PI / 2, 0, 0]}
          color="#EDA832"
        />

        {/* Glass Capsule Cylinder + Hemisphere Cap */}
        <mesh position={[0, 1.65, 0]} material={glassDomeMat} renderOrder={4}>
          <cylinderGeometry args={[0.74, 0.74, 2.2, 24, 1, true]} />
        </mesh>
        <mesh position={[0, 2.75, 0]} material={glassDomeMat} renderOrder={4}>
          <sphereGeometry args={[0.74, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* Subtle ink contour rings on capsule */}
        <InkTorus
          zone={zone}
          args={[0.75, 0.018, 8, 32]}
          position={[0, 0.58, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          color="#1D1A14"
          outlineThickness={0.008}
        />
        <InkTorus
          zone={zone}
          args={[0.745, 0.014, 8, 32]}
          position={[0, 2.75, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          color="#1D1A14"
          outlineThickness={0.006}
        />

        {/* Floating glowing H T M L letters */}
        {textures.htmlGlyphs.map((tex, idx) => (
          <group
            key={idx}
            ref={(el) => {
              htmlLettersRef.current[idx] = el;
            }}
            position={[
              (idx % 2 === 0 ? -1 : 1) * 0.12,
              1.05 + idx * 0.6,
              (idx % 2 === 0 ? 1 : -1) * 0.08,
            ]}
          >
            <InkBox
              zone={zone}
              args={[0.42, 0.42, 0.12]}
              color="#FFFDF0"
              emissiveColor="#FFE484"
              baseEmissive={0.45}
              glowBoost={0.75}
              keepGlowInDim={0.2}
              map={tex}
            />
          </group>
        ))}
      </group>

      {/* PHP Conveyor Plinth (Front Center-Left) */}
      <group
        position={[-0.35, 0.22, 2.45]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("PHP Pipeline — click to bounce blocks");
        }}
        onClick={stopAnd(() => {
          phpWaveRef.current = 1;
          onPropAction("PHP Pipeline Pulsed!");
        })}
      >
        <InkBox zone={zone} args={[2.55, 0.44, 1.32]} position={[0, 0.22, 0]} color="#F1AD32" />
        <InkBox zone={zone} args={[2.3, 0.12, 1.08]} position={[0, 0.48, 0]} color="#FAD06C" />
        {/* Side exhaust pipe */}
        <InkCylinder
          zone={zone}
          args={[0.16, 0.16, 0.65, 16]}
          position={[1.38, 0.24, 0.15]}
          rotation={[0, 0, Math.PI / 2]}
          color="#E79E28"
        />
        {/* Raised PHP 3D cubes */}
        {textures.phpGlyphs.map((tex, idx) => (
          <group
            key={idx}
            ref={(el) => {
              phpBlocksRef.current[idx] = el;
            }}
            position={[-0.68 + idx * 0.68, 0.72, 0]}
          >
            <InkBox
              zone={zone}
              args={[0.52, 0.46, 0.46]}
              color="#FFFFFF"
              map={tex}
              glowBoost={0.22}
            />
          </group>
        ))}
      </group>

      {/* Yellow Stepped Stairs leading toward </> and CSS */}
      <group position={[0.45, 0.22, 0.55]}>
        {[0, 1, 2, 3, 4].map((step) => (
          <InkBox
            key={step}
            zone={zone}
            args={[0.92, 0.16 + step * 0.16, 0.24]}
            position={[0, (0.16 + step * 0.16) / 2, 0.48 - step * 0.24]}
            color={step % 2 === 0 ? "#F7C552" : "#EEAD32"}
          />
        ))}
      </group>

      {/* Code Browser Card & </> Floating Badge (Back-Left-Center) */}
      <group
        position={[-1.15, 0.22, -1.85]}
        rotation={[0, 0.16, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone(true);
          onPropHover("Markup Editor — click to cycle syntax");
        }}
        onClick={stopAnd(() => {
          setCodeIdx((c) => (c + 1) % CODE_MODES.length);
          onPropAction(`Syntax: ${CODE_MODES[(codeIdx + 1) % CODE_MODES.length]}`);
        })}
      >
        <InkBox
          zone={zone}
          args={[1.65, 2.05, 0.12]}
          position={[0.25, 1.35, -0.15]}
          color="#FFFFFF"
          map={textures.browserCard}
          glowBoost={0.14}
        />
        <InkBox
          zone={zone}
          args={[1.15, 0.85, 0.14]}
          position={[-0.25, 1.32, 0.18]}
          color="#FFFFFF"
          map={textures.codeBadge}
          emissiveColor="#FFD56B"
          glowBoost={0.28}
        />
      </group>

      {/* Giant CSS Monolith + Basketball Hoop */}
      <group position={[1.45, 0.22, -1.55]}>
        <InkBox
          zone={zone}
          args={[2.4, 3.65, 2.1]}
          position={[0, 1.825, 0]}
          color="#F9C13A"
          glowBoost={0.14}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverZone(true);
            onPropHover("CSS Monolith — click to launch trick shot");
          }}
          onClick={stopAnd(() => {
            hoopShotRef.current = 1;
            onPropAction("CSS Swish! +1", 1);
          })}
        />
        {/* CSS Plaque on Front (+Z) Face */}
        <InkBox
          zone={zone}
          args={[1.9, 1.15, 0.1]}
          position={[0, 2.15, 1.07]}
          color="#FFFFFF"
          map={textures.css}
          emissiveColor="#FFE082"
          glowBoost={0.22}
          onClick={stopAnd(() => {
            hoopShotRef.current = 1;
            onPropAction("CSS Swish! +1", 1);
          })}
        />

        {/* Basketball Backboard & Glowing Hoop on Right (+X) Side */}
        <group
          position={[1.38, 2.35, 0.35]}
          rotation={[0, Math.PI / 2, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverZone(true);
            onPropHover("CSS Hoop — click to shoot!");
          }}
          onClick={stopAnd(() => {
            hoopShotRef.current = 1;
            onPropAction("Nothing but net! +1", 1);
          })}
        >
          {/* Mounting arm */}
          <InkBox zone={zone} args={[0.14, 0.14, 0.36]} position={[0, 0.1, -0.18]} color="#D68E1E" />
          {/* Backboard */}
          <InkBox zone={zone} args={[0.96, 0.72, 0.06]} position={[0, 0.26, 0]} color="#FFF9E6" />
          <group ref={hoopRingRef} position={[0, -0.04, 0.34]}>
            <InkTorus
              zone={zone}
              args={[0.3, 0.045, 12, 28]}
              rotation={[Math.PI / 2, 0, 0]}
              color="#FF8C1A"
              emissiveColor="#FFC44D"
              baseEmissive={0.28}
              glowBoost={0.6}
              keepGlowInDim={0.25}
              outlineThickness={0.015}
            />
            {/* Net cone */}
            <mesh position={[0, -0.24, 0]} material={netMat}>
              <cylinderGeometry args={[0.27, 0.16, 0.45, 10, 2, true]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Animated Basketball Cube Shot */}
      <group ref={ballRef} position={[2.95, 1.2, 1.4]}>
        <InkBox
          zone={zone}
          args={[0.28, 0.28, 0.28]}
          color="#FFFBF0"
          emissiveColor="#FFE082"
          baseEmissive={0.25}
          glowBoost={0.45}
        />
      </group>

      {/* Tiny Developers / Workers */}
      <TinyPerson zone={zone} position={[-1.05, 0.22, 1.35]} rotation={[0, 0.8, 0]} shirtHex="#D98A1A" />
      <TinyPerson zone={zone} position={[-1.4, 0.22, -0.95]} rotation={[0, 0.2, 0]} shirtHex="#3B3A42" />
      <TinyPerson zone={zone} position={[2.25, 0.22, 1.9]} rotation={[0, -0.5, 0]} shirtHex="#F09A24" />
    </group>
  );
}
