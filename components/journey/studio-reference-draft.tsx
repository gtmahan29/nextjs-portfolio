"use client";
import {smoothScrollTo} from "@/components/smooth-scroll";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { createShowroomArchitecture } from "./showroom-architecture";
import { STATIONS } from "./data";
import { createShowcaseDevice, type DeviceKind } from "./showcase-devices";
import { createProductPreview } from "./showcase-content";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
const DEVICE_KINDS: DeviceKind[] = ["macbook", "iphone", "macbook", "iphone", "macbook", "macbook"];
const PREVIEWS = [0, 1, 2, 1, 2, 0];

const pad = (n: number) => String(n).padStart(2, "0");

const LEADS = [
  "The concept altar — where raw thoughts are distilled into an unambiguous brief before any code is written.",
  "The design atelier — where the idea unfolds into living interfaces, design tokens, and clickable prototypes.",
  "The fullstack core — typed API contracts, normalized schemas, and rock-solid architecture built to last.",
  "The production engine — 60fps micro-interactions, sub-second latency, and rigorous automated tests.",
  "The scalable campus — elastic cloud infrastructure, Dockerized micro-services, and automated CI/CD pipelines.",
  "Global launch & telemetry — full intellectual property handover, live monitoring, and post-release growth.",
];

export default function StudioReferenceDraft() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hall = sectionRef.current;
    if (!canvas || !hall) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const scene = new THREE.Scene();
    // Metal mockup chassis need the studio environment for reflections.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    const environmentTarget = pmrem.fromScene(environment, .04);
    environment.dispose(); pmrem.dispose();
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = .65;
    const review = new URLSearchParams(window.location.search).get('showroomReview');
    const showDevices = !review || review === 'devices';
    if (review) hall.classList.add('st-review');
    const BG = new THREE.Color(0xe9e0d4);
    scene.background = BG;
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 80);
    const N = STATIONS.length;
    const S = 1;
    scene.add(new THREE.HemisphereLight(0xfffaf2, 0xc5b5a0, 1.3));
    const key = new THREE.DirectionalLight(0xfff6e7, 3);
    key.position.set(-5, 7, 5); key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-8,near:.1,far:30});
    key.shadow.bias=-.0002; key.shadow.normalBias=.015; key.shadow.radius=4;
    scene.add(key,key.target);
    const architecture=createShowroomArchitecture(); scene.add(architecture.root);
    const rooms=STATIONS.map((_,i)=>{
      const device=createShowcaseDevice(DEVICE_KINDS[i]);
      const material=device.screen.material as THREE.MeshBasicMaterial;
      material.map?.dispose(); material.map=createProductPreview(PREVIEWS[i]);
      const emblem=device.group; emblem.scale.setScalar(device.kind==='macbook'?.85:.75);
      emblem.rotation.y=-.16;
      const holder=new THREE.Group(); holder.add(emblem);
      const bounds=new THREE.Box3().setFromObject(emblem);
      holder.position.set(.45,architecture.podiumTop-bounds.min.y,0);
      scene.add(holder); holder.visible=showDevices && i===0;
      return {X:i,emblem,holder};
    });
    const lens={dist:11.5,height:1.8,lookY:1.15};
    const resize=()=>{
      const w=canvas.clientWidth||window.innerWidth,h=canvas.clientHeight||window.innerHeight;
      renderer.setSize(w,h,false); camera.aspect=w/h;
      lens.dist=w/h<1?16:11.5; camera.clearViewOffset(); camera.updateProjectionMatrix();
    };
    window.addEventListener('resize',resize); resize();

    const scrollProgress = () => {
      if (review) return 0;
      const r = hall.getBoundingClientRect();
      const total = hall.offsetHeight - window.innerHeight;
      return Math.min(1, Math.max(0, -r.top / total));
    };
    const dwell = (s: number) => {
      const i = Math.min(N - 2, Math.floor(s));
      const f = s - i;
      const t = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
      return i + t * t * (3 - 2 * t);
    };

    let camX = 0;
    let camV = 0;
    const K = 14;
    const C = 2 * Math.sqrt(K);
    const MAX_V = 9;


    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(hall);

    const clock = new THREE.Clock();
    let raf = 0;
    const header = document.querySelector(".jny-header");
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!visible || document.hidden) return;
      if (window.scrollY >= hall.offsetTop - 60) header?.classList.remove("jny-header-dark");
      const sv = scrollProgress();
      const target = dwell(sv * (N - 1)) * S;
      if (reduce) {
        camX = target;
      } else {
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / steps;
        for (let s = 0; s < steps; s++) {
          const acc = K * (target - camX) - C * camV;
          camV = Math.max(-MAX_V, Math.min(MAX_V, camV + acc * h));
          camX += camV * h;
        }
      }
      const angle=review==='right'?.25:review==='left'?-.25:0;
      camera.position.set(Math.sin(angle)*lens.dist,lens.height,Math.cos(angle)*lens.dist);
      camera.lookAt(0,lens.lookY,-2);
      const idx=Math.max(0,Math.min(N-1,Math.round(camX)));
      if(idx!==activeRef.current){activeRef.current=idx;setActive(idx);}
      rooms.forEach((r,i)=>{r.holder.visible=showDevices&&i===idx;});
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      hall.classList.remove("st-review");
      environmentTarget.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(mm => {
          Object.values(mm).forEach(v => { if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
          materials.add(mm);
        });
      });
      textures.forEach(texture => texture.dispose());
      materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      renderer.dispose();
    };
  }, []);

  const st = STATIONS[active];

  const jump = (i: number) => {
    const hall = sectionRef.current;
    if (!hall) return;
    const total = hall.offsetHeight - window.innerHeight;
    const p = i === 0 ? 0 : i === STATIONS.length - 1 ? 1 : i / (STATIONS.length - 1);
    smoothScrollTo(hall.offsetTop + p * total);
  };

  return (
    <section className="st-hall" id="studio" ref={sectionRef} aria-label="The studio, station by station">
      <div className="st-stage">
        <canvas className="st-canvas" ref={canvasRef} aria-hidden="true" />
        <div className="st-tag">
          Instrument
          <b>{`${pad(active + 1)} / 06`}</b>
        </div>
        <div className="st-panel">
          <div className="inner" key={active} style={{ "--st-accent": st.color } as CSSProperties}>
            <div className="num">
              {pad(active + 1)} / {pad(STATIONS.length)} — STATION
            </div>
            <h3>
              {st.name}
              <i>.</i>
            </h3>
            <div className="role">{st.role}</div>
            <p className="lead">{LEADS[active]}</p>
            <ul>
              {st.tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="out">
              Deliverable → <b>{st.deliverable}</b>
            </div>
          </div>
        </div>
        <div className="st-rail">
          {STATIONS.map((s, i) => (
            <div
              key={s.id}
              className={`n ${i === active ? "on" : ""}`}
              style={{ "--c": s.color } as CSSProperties}
              onClick={() => jump(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") jump(i);
              }}
            >
              <b>{s.name[0]}</b>
              {s.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

