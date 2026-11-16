import * as THREE from "three";
import { createLayeredGoldenCubeModel } from "./layered-golden-cube";
import { STATIONS } from "./data";

/** The golden finale retains its original assembly, float and orbit choreography. */
export function createFinalCube(lowPower: boolean) {
  const root = new THREE.Group();
  root.name = "The idea, realised";
  const artifact = new THREE.Group();
  artifact.position.y = 10;
  artifact.scale.setScalar(3.5);
  root.add(artifact);
  const glass = createLayeredGoldenCubeModel();
  artifact.add(glass.root);
  const coreMaterial = glass.core.material;
  coreMaterial.emissiveIntensity = .08;
  coreMaterial.metalness = .35;
  coreMaterial.roughness = .16;

  const luminous = new THREE.MeshBasicMaterial({ color: "#e1f6ff", toneMapped: false });
  const orbits = new THREE.Group();
  orbits.position.y = 10;
  root.add(orbits);
  const segments = lowPower ? 100 : 180;
  const tubeSegments = 8;
  const orbitMaterials = ["#84dfff", "#9beced", "#dfc9ff"].map(color => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .8, depthWrite: false, toneMapped: false, fog: false }));
  const rings = [0, 1, 2].map(i => {
    const radius = 7.6 + i * .8;
    const geometry = new THREE.TorusGeometry(radius, i === 1 ? .032 : .045, tubeSegments, segments);
    // Order complete tube sections around the circumference, so drawRange writes
    // a continuous orbit instead of uncovering longitudinal strips of the torus.
    const original = geometry.index!;
    const indices: number[] = [];
    for (let arc = 0; arc < segments; arc++) for (let tube = 0; tube < tubeSegments; tube++) {
      const offset = (tube * segments + arc) * 6;
      for (let k = 0; k < 6; k++) indices.push(original.getX(offset + k));
    }
    geometry.setIndex(indices);
    const rig = new THREE.Group();
    rig.rotation.set(.55 + i * .65, .35 + i * .65, i * 1.8);
    const ring = new THREE.Mesh(geometry, orbitMaterials[i]);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 8), luminous);
    const satellite = new THREE.Mesh(new THREE.OctahedronGeometry(.13), luminous);
    satellite.rotation.set(.4, .5, .2);
    rig.add(ring, beacon, satellite);
    orbits.add(rig);
    return { rig, geometry, beacon, satellite, radius };
  });
  const constellation = new THREE.Group();
  constellation.position.y = 10;
  root.add(constellation);
  const satelliteGeometry = new THREE.OctahedronGeometry(.16);
  const satellites = STATIONS.map((station, i) => {
    const node = new THREE.Mesh(satelliteGeometry, new THREE.MeshBasicMaterial({
      color: station.colorInt, toneMapped: false, transparent: true, depthWrite: false, fog: false }));
    const angle = i * Math.PI / 3;
    node.position.set(Math.cos(angle) * 11, Math.sin(angle * 2) * 3, Math.sin(angle) * 8);
    constellation.add(node);
    return node;
  });
  const latticePoints: number[] = [];
  satellites.forEach((node, i) => {
    const next = satellites[(i + 1) % satellites.length];
    latticePoints.push(...node.position.toArray(), ...next.position.toArray());
  });
  const latticeGeometry = new THREE.BufferGeometry();
  latticeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(latticePoints, 3));
  const latticeMaterial = new THREE.LineBasicMaterial({ color: "#c7e9fa", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  constellation.add(new THREE.LineSegments(latticeGeometry, latticeMaterial));
  const particleCount = lowPower ? 48 : 100;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial = new THREE.PointsMaterial({ color: "#d4bcff", size: .12,
    transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  root.add(particles);
  // The same artifact remains above the screen-space field during the handoff.
  root.traverse(node => {
    if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Points) node.renderOrder = Math.max(100, node.renderOrder);
    // Screen-space paper is transparent; keep the entire artifact in its later
    // render queue, including the solid PBR rings, during the crossfade.
    if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => { material.transparent = true; });
    }
  });
  root.visible = false;

  return {
    root,
    artifact,
    ready: Promise.resolve(),
    dispose: glass.dispose,
    updateUnlock(progress: number, reduced: boolean) {
      const clear = 1 - THREE.MathUtils.smoothstep(progress, 0, .15);
      orbitMaterials.forEach(material => { material.opacity *= clear; });
      satellites.forEach(node => { (node.material as THREE.Material).opacity = clear; });
      latticeMaterial.opacity *= clear;
      particleMaterial.opacity *= clear;
      orbits.visible = clear > .001; constellation.visible = clear > .001; particles.visible = clear > .001;
      artifact.visible = progress < .38;
      const opening = THREE.MathUtils.smoothstep(progress, .22, .35);
      glass.reveal(opening,1-THREE.MathUtils.smoothstep(progress,.35,.38));
      artifact.scale.setScalar(3.5);
      artifact.position.y = 10;
      artifact.rotation.set(.12 * (1 - opening), .22*(1-opening)+(reduced?0:Math.PI*2*THREE.MathUtils.smoothstep(progress,.05,.20)), -.08 * (1 - opening));
    },
    update(progress: number, time: number, reduced: boolean) {
      artifact.visible = true; orbits.visible = true; constellation.visible = true; particles.visible = true;
      orbitMaterials.forEach(material => { material.opacity = .8; });
      const arrival = THREE.MathUtils.smoothstep(progress, .89, .995);
      root.visible = arrival > .001;
      if (!root.visible) return;
      const assembly = reduced ? 1 : arrival;
      const detail = THREE.MathUtils.smoothstep(arrival, .4, .95);
      glass.update((1 - assembly) * .65);
      artifact.scale.setScalar(3.5 * (.45 + .55 * assembly));
      artifact.position.y = 10 + (reduced ? 0 : Math.sin(time * .65) * .22);
      artifact.rotation.set(.12, .22 + (reduced ? 0 : Math.sin(time * .22) * .13), -.08);
      coreMaterial.emissiveIntensity = .08 + detail * .06;
      orbits.scale.setScalar(.9 + assembly * .1);
      rings.forEach(({ rig, geometry, beacon, satellite, radius }, i) => {
        const written = reduced ? 1 : THREE.MathUtils.smoothstep(arrival, .12 + i * .16, .64 + i * .17);
        rig.visible = written > .001;
        geometry.setDrawRange(0, Math.floor(written * segments) * tubeSegments * 6);
        rig.rotation.z = i * 1.8 + (reduced ? 0 : time * .045 * (i % 2 ? -1 : 1));
        const angle = written * Math.PI * 2;
        beacon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        beacon.scale.setScalar(written < .999 ? 1.5 : .8);
        const satelliteAngle = angle + i * 1.8 + (reduced ? 0 : time * .12);
        satellite.position.set(Math.cos(satelliteAngle) * radius, Math.sin(satelliteAngle) * radius, 0);
        satellite.scale.setScalar(detail);
      });
      constellation.rotation.y = reduced ? 0 : Math.sin(time * .1) * .14;
      constellation.scale.setScalar(.5 + detail * .5);
      satellites.forEach((node, i) => {
        node.scale.setScalar(THREE.MathUtils.smoothstep(arrival, .4 + i * .045, .7 + i * .04));
        node.rotation.set(time * (reduced ? 0 : .12), i + time * (reduced ? 0 : .16), .3);
      });
      latticeMaterial.opacity = detail * .065;
      particleMaterial.opacity = arrival * .8;
      for (let i = 0; i < particleCount; i++) {
        const angle = i * 2.399963 + (reduced ? 0 : time * .045);
        const radius = (1 - assembly) * 17 + 6 + (i % 7) * .7;
        particlePositions[i * 3] = Math.cos(angle) * radius;
        particlePositions[i * 3 + 1] = 10 + Math.sin(i * 1.73) * (2 + 5 * assembly);
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      particleGeometry.attributes.position.needsUpdate = true;
    },
  };
}

