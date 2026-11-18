import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { disposeSceneResources } from "./scene-resources";

const HEIGHT = 1.92;
const FACE = .022;
const EDGE = .00055;
const RADIUS = .344;

/** Keep the horizontal and vertical faces flat and cut the four corners. */
function facetedRadius(x: number, y: number) {
  const horizontal = Math.abs(x), vertical = Math.abs(y);
  return 1 / Math.max(horizontal, vertical, (horizontal + vertical) / 1.62);
}

function metal(color: string, metalness: number, roughness: number) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: true, fog: false });
}

/** A faceted glass inlay split between two porcelain leaves. */
export function createJourneyDoor() {
  const root = new THREE.Group();
  root.name = "Sliding doorway";

  const porcelain = new THREE.MeshPhysicalMaterial({
    color: "#dfdedb", roughness: .53, clearcoat: .28, clearcoatRoughness: .34,
    emissive: "#bebfd0", emissiveIntensity: .14, transparent: true, fog: false,
  });
  const shadow = metal("#2c3145", .48, .38);
  const ceramicEdge = metal("#99979b", .25, .42);
  const bronze = metal("#7d664f", .78, .33);
  const gold = metal("#d4b98a", .78, .31);
  const engraving = metal("#a99476", .65, .4);
  const glassLight = { value: 0 };
  const midnight = new THREE.MeshPhysicalMaterial({
    color: "#091127", metalness: .57, roughness: .27, clearcoat: .79, clearcoatRoughness: .31,
    emissive: "#111b35", emissiveIntensity: .30, transparent: true, fog: false,
  });

  porcelain.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vPorcelainPoint;
      ${shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPorcelainPoint = position.xy;")}`;
    shader.fragmentShader = `varying vec2 vPorcelainPoint;
      ${shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float offset = vPorcelainPoint.y - .38 + vPorcelainPoint.x * .4;
        float wash = exp(-2.1 * offset * offset);
        diffuseColor.rgb *= mix(vec3(.80,.83,.89), vec3(1.03,1.02,1.0), wash);
      `)}`;
  };

  midnight.onBeforeCompile = shader => {
    shader.uniforms.uLockTurn = glassLight;
    shader.vertexShader = `varying vec2 vGlassPoint;
      ${shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlassPoint = position.xy;")}`;
    shader.fragmentShader = `varying vec2 vGlassPoint;
      uniform float uLockTurn;
      ${shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float axis = vGlassPoint.y - .85 * vGlassPoint.x;
        float wash = exp(-11. * abs(axis - .08));
        float glint = exp(-36. * abs(axis - .18));
        float vignette = 1. - smoothstep(.16,.47,length(vGlassPoint));
        diffuseColor.rgb *= .59 + wash * 1.35 + vignette * .35;
        totalEmissiveRadiance += (wash * .33 + glint * .15) * vec3(.020,.035,.068);
        totalEmissiveRadiance += uLockTurn * vignette * vec3(.008,.009,.019);
      `)}`;
  };

  function part(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    // Draw after the camera-space iris in the chapter behind the doors.
    mesh.renderOrder = 103;
    parent.add(mesh);
    return mesh;
  }

  const leaves = ([-1, 1] as const).map(side => {
    const group = new THREE.Group();
    group.name = side < 0 ? "Left door leaf" : "Right door leaf";
    root.add(group);
    const body = part(group, new THREE.BufferGeometry(), porcelain);
    part(group, new RoundedBoxGeometry(.003, HEIGHT, .008, 2, .001), ceramicEdge, side * (EDGE + .003), 0, FACE);
    const bezel = new THREE.Group();
    bezel.position.set(side * EDGE, 0, FACE);
    group.add(bezel);

    const start = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    function halfDisc(radius: number, depth: number) {
      const shape = new THREE.Shape();
      for (let i = 0; i <= 96; i++) {
        const angle = start + i / 96 * Math.PI;
        const x = Math.cos(angle), y = Math.sin(angle);
        const r = radius * facetedRadius(x, y);
        if (i === 0) shape.moveTo(x * r, y * r);
        else shape.lineTo(x * r, y * r);
      }
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    }

    function halfRing(profile: [number, number][], material: THREE.Material) {
      const points = profile.map(([radius, depth]) => new THREE.Vector2(radius, depth)).reverse();
      const ring = new THREE.LatheGeometry(points, 96, side > 0 ? 0 : Math.PI, Math.PI).rotateX(Math.PI / 2);
      const positions = ring.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        const length = Math.hypot(x, y);
        const scale = facetedRadius(x / length, y / length);
        positions.setXY(i, x * scale, y * scale);
      }
      ring.computeVertexNormals();
      part(bezel, ring, material);
    }

    // Ceramic shoulder, shadow gap and a thin anodized edge surround the recessed glass.
    part(bezel, halfDisc(RADIUS, .007), shadow);
    part(bezel, halfDisc(.317, .019), midnight);
    halfRing([[.334,.006],[.342,.013],[.353,.015],[.366,.0003]], porcelain);
    halfRing([[.330,.006],[.333,.009],[.336,.010],[.340,.008]], shadow);
    halfRing([[.318,.019],[.321,.024],[.326,.024],[.331,.008]], gold);
    halfRing([[.288,.0192],[.289,.0197],[.290,.0192]], engraving);

    const traces = [
      [[0,.253],[.150,.253],[.253,.150],[.253,.041]],
      [[0,-.253],[.150,-.253],[.253,-.150],[.253,-.041]],
      [[.036,.211],[.125,.211],[.212,.124]],
      [[.036,-.211],[.125,-.211],[.212,-.124]],
    ];
    const traceMaterial = new THREE.LineBasicMaterial({ color: "#9eaccc", transparent: true, opacity: .33 });
    for (const trace of traces) {
      const path = new THREE.BufferGeometry().setFromPoints(trace.map(([x, y]) => new THREE.Vector3(side * x, y, .0196)));
      const line = new THREE.Line(path, traceMaterial);
      line.renderOrder = 103;
      bezel.add(line);
    }
    return { group, body, bezel, side };
  });

  const hardware = new THREE.Group();
  hardware.position.set(-.080, 0, .019);
  leaves[0].bezel.add(hardware);
  const disk = (radius: number, depth: number) =>
    new THREE.CylinderGeometry(radius, radius, depth, 64).rotateX(Math.PI / 2);
  part(hardware, disk(.049, .010), shadow, 0, 0, .005);
  part(hardware, disk(.046, .013), gold, 0, 0, .011);
  const rotor = new THREE.Group();
  rotor.position.z = .019;
  hardware.add(rotor);
  part(rotor, disk(.039, .007), bronze);
  part(rotor, new THREE.TorusGeometry(.034, .00065, 8, 64), gold, 0, 0, .0038);
  const bore = new THREE.Shape();
  bore.absarc(0, .007, .008, -.28 * Math.PI, 1.28 * Math.PI);
  bore.lineTo(-.004, -.013);
  bore.lineTo(.004, -.013);
  bore.closePath();
  part(rotor, new THREE.ShapeGeometry(bore), shadow, 0, 0, .004);
  const socket = new THREE.Object3D();
  socket.position.z = .005;
  rotor.add(socket);

  let aspect = 0;
  return {
    root, socket,
    fit(ratio: number) {
      if (ratio === aspect) return;
      aspect = ratio;
      const width = aspect / 2 + .042;
      const scale = Math.min(1, aspect * .45 / RADIUS);
      for (const { body, side, bezel } of leaves) {
        body.geometry.dispose();
        body.geometry = new RoundedBoxGeometry(width, HEIGHT, FACE * 2, 4, .003);
        body.position.x = side * (width / 2 + EDGE);
        bezel.scale.setScalar(scale);
      }
    },
    pose(open: number, turn: number) {
      const travel = (aspect / 2 + .035) * open;
      leaves.forEach(({ group, side }) => { group.position.x = side * travel; });
      rotor.rotation.z = -turn * Math.PI / 2;
      glassLight.value = turn;
      return travel;
    },
    edge: new THREE.Vector3(EDGE, 0, FACE),
    dispose() { disposeSceneResources(root); },
  };
}
