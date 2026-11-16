"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  ArrowUpRight,
  Eye,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Orbit,
} from "lucide-react";
import {
  OVERVIEW_CAMERA_POS,
  OVERVIEW_TARGET,
  ZONE_LIST,
  ZONES,
  ZoneId,
  ZoneUniformMap,
} from "./types";
import { playClickPop, playHoverSound, playScoreDing } from "./sound";
import { WebDevQuadrant } from "./quadrants/WebDevQuadrant";
import { SeoQuadrant } from "./quadrants/SeoQuadrant";
import { SocialQuadrant } from "./quadrants/SocialQuadrant";
import { HostingQuadrant } from "./quadrants/HostingQuadrant";

function createZoneUniforms(): ZoneUniformMap {
  return {
    webdev: { uActive: { value: 1 }, uGlow: { value: 0.15 }, uTime: { value: 0 } },
    seo: { uActive: { value: 1 }, uGlow: { value: 0.15 }, uTime: { value: 0 } },
    social: { uActive: { value: 1 }, uGlow: { value: 0.15 }, uTime: { value: 0 } },
    hosting: { uActive: { value: 1 }, uGlow: { value: 0.15 }, uTime: { value: 0 } },
  };
}

interface DioramaWorldProps {
  zoneUniforms: ZoneUniformMap;
  activeHighlight: ZoneId | null;
  lockedZone: ZoneId | null;
  spotlightEnabled: boolean;
  autoOrbit: boolean;
  resetNonce: number;
  onHoverZone: (zone: ZoneId | null) => void;
  onSelectZone: (zone: ZoneId) => void;
  onPropAction: (label: string, scoreDelta?: number) => void;
  onPropHover: (hint: string | null) => void;
}

function DioramaWorld({
  zoneUniforms,
  activeHighlight,
  lockedZone,
  spotlightEnabled,
  autoOrbit,
  resetNonce,
  onHoverZone,
  onSelectZone,
  onPropAction,
  onPropHover,
}: DioramaWorldProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const isTransitioningRef = useRef(false);
  const desiredCamPos = useRef(new THREE.Vector3(...OVERVIEW_CAMERA_POS));
  const desiredTarget = useRef(new THREE.Vector3(...OVERVIEW_TARGET));

  // Trigger smooth camera glide when lockedZone or resetNonce changes
  useEffect(() => {
    if (lockedZone) {
      const cfg = ZONES[lockedZone];
      desiredCamPos.current.set(...cfg.focusCameraPos);
      desiredTarget.current.set(...cfg.focusTarget);
    } else {
      desiredCamPos.current.set(...OVERVIEW_CAMERA_POS);
      desiredTarget.current.set(...OVERVIEW_TARGET);
    }
    isTransitioningRef.current = true;
  }, [lockedZone, resetNonce]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();

    // Update GPU uniforms for smooth 60fps spotlight dimming/glow
    (Object.keys(zoneUniforms) as ZoneId[]).forEach((id) => {
      const u = zoneUniforms[id];
      const isFocused = activeHighlight === id;
      const targetActive =
        !spotlightEnabled || activeHighlight === null || isFocused ? 1.0 : 0.0;
      const targetGlow =
        activeHighlight === null ? 0.14 : isFocused ? 1.0 : 0.0;

      const rate = 1 - Math.exp(-dt * 9.5);
      u.uActive.value = THREE.MathUtils.lerp(u.uActive.value, targetActive, rate);
      u.uGlow.value = THREE.MathUtils.lerp(u.uGlow.value, targetGlow, rate);
      u.uTime.value = t;
    });

    // Smooth camera focus transition (yields immediately if user drags)
    if (isTransitioningRef.current && controlsRef.current) {
      const camRate = 1 - Math.exp(-dt * 5.2);
      camera.position.lerp(desiredCamPos.current, camRate);
      controlsRef.current.target.lerp(desiredTarget.current, camRate);
      controlsRef.current.update();

      if (
        camera.position.distanceTo(desiredCamPos.current) < 0.05 &&
        controlsRef.current.target.distanceTo(desiredTarget.current) < 0.05
      ) {
        isTransitioningRef.current = false;
      }
    }
  });

  const activePillZone = activeHighlight ? ZONES[activeHighlight] : null;

  return (
    <>
      <color attach="background" args={["#F8F4EA"]} />

      <ambientLight intensity={0.75} />
      <directionalLight
        position={[14, 22, 12]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoOrbit && !lockedZone}
        autoRotateSpeed={0.55}
        minDistance={8}
        maxDistance={42}
        minPolarAngle={0.28}
        maxPolarAngle={Math.PI / 2.18}
        target={OVERVIEW_TARGET}
        onStart={() => {
          isTransitioningRef.current = false;
        }}
      />

      {/* Click empty floor to clear lock */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, 0]}
        onClick={() => onHoverZone(null)}
        visible={false}
      >
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial />
      </mesh>

      <group position={[0, 0, 0]}>
        <WebDevQuadrant
          zone={zoneUniforms.webdev}
          position={ZONES.webdev.center}
          onHoverZone={(h) => onHoverZone(h ? "webdev" : null)}
          onSelectZone={() => onSelectZone("webdev")}
          onPropAction={onPropAction}
          onPropHover={onPropHover}
        />
        <SeoQuadrant
          zone={zoneUniforms.seo}
          position={ZONES.seo.center}
          onHoverZone={(h) => onHoverZone(h ? "seo" : null)}
          onSelectZone={() => onSelectZone("seo")}
          onPropAction={onPropAction}
          onPropHover={onPropHover}
        />
        <SocialQuadrant
          zone={zoneUniforms.social}
          position={ZONES.social.center}
          onHoverZone={(h) => onHoverZone(h ? "social" : null)}
          onSelectZone={() => onSelectZone("social")}
          onPropAction={onPropAction}
          onPropHover={onPropHover}
        />
        <HostingQuadrant
          zone={zoneUniforms.hosting}
          position={ZONES.hosting.center}
          onHoverZone={(h) => onHoverZone(h ? "hosting" : null)}
          onSelectZone={() => onSelectZone("hosting")}
          onPropAction={onPropAction}
          onPropHover={onPropHover}
        />

        {/* Subtle angled dark service pill matching the video */}
        {activePillZone && !lockedZone && (
          <Html
            position={activePillZone.pillAnchor}
            center
            style={{ pointerEvents: "none" }}
          >
            <div
              className="flex items-center gap-2 rounded-full bg-[#151519] px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#FAF7EE] shadow-xl border border-white/10 whitespace-nowrap"
              style={{
                transform: "rotate(-6deg)",
                boxShadow: `0 10px 26px rgba(15,15,20,0.28), 0 0 0 1.5px ${activePillZone.accentHex}`,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: activePillZone.accentHex }}
              />
              <span>{activePillZone.pillSlug}</span>
              <ArrowUpRight className="h-3 w-3 opacity-75" />
            </div>
          </Html>
        )}
      </group>

      <ContactShadows
        position={[0, -0.24, 0]}
        opacity={0.22}
        scale={28}
        blur={2.1}
        far={8}
        color="#2A241A"
      />
    </>
  );
}

export default function IsoDioramaScene() {
  const zoneUniforms = useMemo(() => createZoneUniforms(), []);
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);
  const [lockedZone, setLockedZone] = useState<ZoneId | null>(null);
  const [spotlightEnabled, setSpotlightEnabled] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [resetNonce, setResetNonce] = useState(0);
  const [propHint, setPropHint] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const toastTimerRef = useRef<number | null>(null);

  const activeHighlight = hoveredZone ?? lockedZone;

  const handleHoverZone = useCallback(
    (zone: ZoneId | null) => {
      setHoveredZone((prev) => {
        if (prev !== zone && zone !== null) {
          playHoverSound(soundEnabled);
        }
        return zone;
      });
    },
    [soundEnabled]
  );

  const handleSelectZone = useCallback(
    (zone: ZoneId) => {
      playClickPop(soundEnabled);
      setLockedZone((prev) => (prev === zone ? null : zone));
    },
    [soundEnabled]
  );

  const handlePropAction = useCallback(
    (label: string, scoreDelta = 0) => {
      if (scoreDelta > 0) {
        playScoreDing(soundEnabled);
        setScore((s) => s + scoreDelta);
      } else {
        playClickPop(soundEnabled);
      }
      setActionToast(label);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setActionToast(null);
      }, 2200);
    },
    [soundEnabled]
  );

  const handleResetView = useCallback(() => {
    playClickPop(soundEnabled);
    setLockedZone(null);
    setHoveredZone(null);
    setResetNonce((n) => n + 1);
  }, [soundEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lockedZone) {
        handleResetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [lockedZone, handleResetView]);

  const lockedConfig = lockedZone ? ZONES[lockedZone] : null;

  return (
    <div
      className="relative w-full h-[680px] md:h-[760px] select-none overflow-hidden rounded-2xl bg-[#F8F4EA]"
      style={{ cursor: propHint ? "pointer" : hoveredZone ? "pointer" : "grab" }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: OVERVIEW_CAMERA_POS,
          fov: 27,
          near: 0.5,
          far: 120,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <DioramaWorld
          zoneUniforms={zoneUniforms}
          activeHighlight={activeHighlight}
          lockedZone={lockedZone}
          spotlightEnabled={spotlightEnabled}
          autoOrbit={autoOrbit}
          resetNonce={resetNonce}
          onHoverZone={handleHoverZone}
          onSelectZone={handleSelectZone}
          onPropAction={handlePropAction}
          onPropHover={setPropHint}
        />
      </Canvas>

      {/* Top Interactive Bar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
        {/* Quadrant Switcher Pills */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border border-[#18181D]/15 bg-[#151519]/95 p-1 text-xs text-[#FAF7EE] shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={handleResetView}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              lockedZone === null
                ? "bg-[#FAF7EE] text-[#151519]"
                : "text-[#FAF7EE]/80 hover:text-white"
            }`}
          >
            All Zones
          </button>
          {ZONE_LIST.map((z) => {
            const isSelected = lockedZone === z.id;
            const isHot = activeHighlight === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onMouseEnter={() => handleHoverZone(z.id)}
                onMouseLeave={() => handleHoverZone(null)}
                onClick={() => handleSelectZone(z.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${
                  isSelected
                    ? "text-[#151519] font-semibold"
                    : isHot
                    ? "bg-white/15 text-white"
                    : "text-[#FAF7EE]/80 hover:bg-white/10 hover:text-white"
                }`}
                style={isSelected ? { backgroundColor: z.accentHex } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isSelected ? "#151519" : z.accentHex }}
                />
                <span className="hidden sm:inline">{z.title}</span>
                <span className="sm:hidden">{z.number}</span>
              </button>
            );
          })}
        </div>

        {/* Utility Toggles */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#18181D]/15 bg-white/95 p-1 text-xs text-[#18181D] shadow-md backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              playClickPop(soundEnabled);
              setSpotlightEnabled((v) => !v);
            }}
            title="Dim inactive quadrants on hover"
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-medium transition ${
              spotlightEnabled
                ? "bg-[#151519] text-[#FAF7EE]"
                : "text-[#18181D]/70 hover:bg-black/5"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Spotlight</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickPop(soundEnabled);
              setAutoOrbit((v) => !v);
            }}
            title="Toggle slow turntable orbit"
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-medium transition ${
              autoOrbit
                ? "bg-[#151519] text-[#FAF7EE]"
                : "text-[#18181D]/70 hover:bg-black/5"
            }`}
          >
            <Orbit className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Orbit</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            title="Toggle synthesized SFX"
            className="flex items-center justify-center rounded-full p-1.5 text-[#18181D]/75 transition hover:bg-black/5"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 opacity-60" />
            )}
          </button>

          <button
            type="button"
            onClick={handleResetView}
            title="Reset isometric camera"
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 font-medium text-[#18181D]/80 transition hover:bg-black/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Bottom-Left Prop Hint, Action Toast & Score */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-2">
        {actionToast && (
          <div className="flex items-center gap-2 rounded-full border border-[#18181D]/20 bg-[#151519] px-3.5 py-1.5 text-xs font-semibold text-[#FAF7EE] shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-[#F5B335]" />
            <span>{actionToast}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#18181D]/15 bg-white/95 px-3 py-2 text-xs text-[#232329] shadow-sm backdrop-blur-md">
          <span className="font-semibold">
            {propHint ??
              (hoveredZone
                ? `${ZONES[hoveredZone].title} — click quadrant to focus, or click props`
                : "Drag to orbit · Scroll to zoom · Hover a quadrant · Click any prop")}
          </span>
          {score > 0 && (
            <span className="rounded-full bg-[#151519] px-2 py-0.5 text-[11px] font-bold text-[#F5B335]">
              Score: {score}
            </span>
          )}
        </div>
      </div>

      {/* Bottom-Right Focused Quadrant Card */}
      {lockedConfig && (
        <div className="pointer-events-auto absolute bottom-3 right-3 w-[280px] max-w-[calc(100%-24px)] rounded-2xl border border-[#18181D]/15 bg-white/95 p-3.5 text-[#18181D] shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: lockedConfig.accentHex }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#666872]">
                {lockedConfig.number} · Focused
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetView}
              className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-[#18181D] hover:bg-black/10"
            >
              Overview (Esc)
            </button>
          </div>
          <h3 className="mt-1.5 text-sm font-bold tracking-tight">
            {lockedConfig.title}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[#5C5F69]">
            {lockedConfig.tagline}
          </p>
          <ul className="mt-2.5 space-y-1 border-t border-black/10 pt-2 text-[11px] text-[#353740]">
            {lockedConfig.interactions.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: lockedConfig.accentHex }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
