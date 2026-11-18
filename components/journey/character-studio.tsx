"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createConversationCharacter, CharacterMotion } from "./conversation-character";
import { HAIR_STYLES, HairStyle } from "./character-hair";

export default function CharacterStudio() {
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<ReturnType<typeof createConversationCharacter> | null>(null);
  const view = useRef<(angle: string) => void>(() => {});
  const paused = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const [motion, setMotion] = useState<CharacterMotion>("talk");
  const [hair, setHair] = useState<HairStyle>("Side-swept");
  const selection = useRef({ motion, hair });
  selection.current = { motion, hair };

  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#dce4e7");
    scene.fog = new THREE.Fog("#dce4e7", 15, 45);
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    camera.position.set(4, 3.0, 7);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0); controls.enableDamping = true;
    controls.enablePan = false; controls.minDistance = 3.5; controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * .49; controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x879daa, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, far: 25 });
    sun.shadow.normalBias = .012; scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: "#dce4e7", roughness: .91 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.006; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(200, 400, "#bdcbcf", "#bdcbcf");
    const gridMat = grid.material as THREE.Material; gridMat.transparent = true; gridMat.opacity = .20;
    scene.add(grid);
    const character = createConversationCharacter(); model.current = character; scene.add(character.root);
    character.setMotion(selection.current.motion);
    character.setHairStyle(selection.current.hair);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let elapsed = 0, last = performance.now(), lastDistance = 0, raf = 0;
    view.current = angle => {
      const z = character.locomotion.distance;
      const p = angle === "Front" ? [0, 2.5, 8] : angle === "Side" ? [8, 2.5, 0] : [4, 3, 7];
      camera.position.set(p[0], p[1], p[2] + z); controls.target.set(0, 1.5, z); controls.update();
    };
    const resize = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }); resize.observe(el);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused.current && !document.hidden) elapsed += dt;
      character.update(elapsed, reduce.matches);
      const distance = character.locomotion.distance;
      character.root.position.z = distance;
      camera.position.z += distance - lastDistance; controls.target.z += distance - lastDistance;
      lastDistance = distance;
      sun.position.set(3, 7, distance + 5); sun.target.position.set(0, 1, distance);
      controls.update(); renderer.render(scene, camera);
    }; raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); resize.disconnect(); controls.dispose(); character.dispose();
      scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m.dispose());
      });
      renderer.dispose(); renderer.domElement.remove(); model.current = null;
    };
  }, []);

  return <main className="character-studio">
    <div className="character-stage" ref={host} aria-label="Interactive 3D character preview">
      <a className="back-link" href="/">← Back to the journey</a>
      <p className="orbit-hint">Drag to rotate · Scroll to zoom</p>
    </div>
    <aside className="character-controls">
      <span className="eyebrow">CHARACTER STUDY / 01</span>
      <h1>A little more human.</h1>
      <p className="intro">One character. Five hairstyles. Watch a full conversation or follow a walk from any angle.</p>
      <fieldset><legend>Movement</legend><div className="button-row">
        {(["talk", "walk", "idle", "work", "bend"] as CharacterMotion[]).map(m => <button key={m} aria-pressed={motion === m} onClick={() => { setMotion(m); model.current?.setMotion(m); }}>{m === "talk" ? "Talking" : m === "walk" ? "Walking" : m === "work" ? "Working" : m === "bend" ? "Low repair" : "Resting"}</button>)}
      </div></fieldset>
      <fieldset><legend>Hair</legend><div className="hair-options">
        {HAIR_STYLES.map((style, i) => <button key={style} aria-pressed={hair === style} onClick={() => { setHair(style); model.current?.setHairStyle(style); }}><span>0{i + 1}</span>{style}</button>)}
      </div></fieldset>
      <fieldset><legend>View</legend><div className="button-row">
        {["Front", "Side", "Three-quarter"].map(angle => <button key={angle} onClick={() => view.current(angle)}>{angle}</button>)}
      </div></fieldset>
      <button className="pause-button" onClick={() => { paused.current = !paused.current; setPaused(paused.current); }}>{isPaused ? "Resume movement" : "Pause movement"}</button>
      <p className="footnote">This rig now powers the residents throughout the journey. Your reduced-motion preference is respected.</p>
    </aside>
    <style jsx>{`
      .character-studio{height:100dvh;min-height:620px;display:grid;grid-template-columns:minmax(0,1fr) 330px;background:#f7f8f7;color:#263b46;font-family:Arial,sans-serif}
      .character-stage{position:relative;min-height:0;overflow:hidden;touch-action:none}
      .character-stage :global(canvas){display:block;width:100%;height:100%}
      .back-link{position:absolute;top:28px;left:28px;z-index:2;color:#40545d;font-size:13px;text-decoration:none}
      .orbit-hint{position:absolute;bottom:24px;left:28px;font-size:12px;color:#62757d;pointer-events:none}
      .character-controls{padding:38px 26px;overflow:auto;border-left:1px solid #d7dfe1}
      .eyebrow{font-size:10px;letter-spacing:2px;color:#74868c}h1{font-size:30px;line-height:1.12;margin:17px 0;font-weight:500;letter-spacing:-1px}
      .intro{font-size:13px;line-height:1.7;color:#718089;margin-bottom:28px}
      fieldset{border:0;padding:0;margin:0 0 24px}legend{font-size:12px;font-weight:600;margin-bottom:10px}
      .button-row{display:flex;gap:6px;flex-wrap:wrap}button{font-family:inherit;cursor:pointer;border:1px solid #d7e0e2;background:transparent;color:#435963;border-radius:7px;padding:10px 12px;font-size:12px;min-height:40px}
      button[aria-pressed=true]{background:#304b59;color:white;border-color:#304b59}button:hover{border-color:#8299a4}button:focus-visible{outline:2px solid #4a869d;outline-offset:3px}
      .hair-options{display:grid;gap:6px}.hair-options button{text-align:left;display:flex;gap:16px}.hair-options span{opacity:.55;font-size:10px;line-height:16px}
      .pause-button{width:100%;background:white}.footnote{font-size:11px;line-height:1.6;color:#859298;margin-top:20px}
      @media(max-width:720px){.character-studio{height:auto;min-height:100dvh;display:flex;flex-direction:column}.character-stage{height:62dvh;min-height:380px}.character-controls{padding:24px;border-left:0;border-top:1px solid #d7dfe1}h1{font-size:26px}.hair-options{grid-template-columns:1fr 1fr}.intro{margin-bottom:20px}.back-link{top:20px;left:20px}.orbit-hint{left:20px;bottom:14px}}
    `}</style>
  </main>;
}
