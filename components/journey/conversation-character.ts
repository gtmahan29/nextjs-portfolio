import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneRig } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

import { createCharacterHair, HairStyle } from "./character-hair";
import { sampleFoot, sampleWalkBody, solveLeg, WALK_PERIOD, WALK_SPEED } from "./character-gait";

export type CharacterMotion = "talk" | "walk" | "idle" | "work" | "bend";
export type CharacterAppearance = {
  outfit?: "crew" | "tee" | "coat" | "workwear";
  shirt?: string; pants?: string; skin?: string; shoes?: string; hair?: string; hairStyle?: HairStyle;
  detailedHair?: boolean;
};
const templates = new Map<string, THREE.Group>();

type Weights = (y: number, x: number, z: number) => [number, number, number];
type Ring = [y: number, width: number, depth: number, z?: number, x?: number];

/** One review character: continuous skinned sleeves, independent elbows and wrists. */
export function createConversationCharacter(appearance: CharacterAppearance = {}) {
  const outfit = appearance.outfit ?? "crew";
  const template = templates.get(outfit);
  if (template) {
    const root = cloneRig(template) as THREE.Group;
    const mesh = root.getObjectByName("conversation-character-skin") as THREE.SkinnedMesh;
    mesh.material = (mesh.material as THREE.Material[]).map(m => m.clone());
    return animateCharacter(root, mesh, appearance);
  }
  const root = new THREE.Group();
  root.name = "conversation-character-prototype";
  const bones: THREE.Bone[] = [];
  const bone = (name: string, parent: THREE.Bone | null, x: number, y: number, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent?.add(b);
    bones.push(b);
    return b;
  };
  const pelvis = bone("pelvis", null, 0, 1.28);
  const chest = bone("chest", pelvis, 0, 0.47);
  const neck = bone("neck", chest, 0, 0.56);
  const head = bone("head", neck, 0, 0.17);
  const arms = [-1, 1].map(side => {
    const shoulder = bone(`${side}-shoulder`, chest, side * .36, .37);
    const elbow = bone(`${side}-elbow`, shoulder, side * .14, -.43);
    const wrist = bone(`${side}-wrist`, elbow, side * .02, -.40);
    return { side, shoulder, elbow, wrist };
  });
  const legs = [-1, 1].map(side => {
    const hip = bone(side + "-hip", pelvis, side * .205, -.04);
    const knee = bone(side + "-knee", hip, 0, -.52);
    const ankle = bone(side + "-ankle", knee, 0, -.51);
    return { side, hip, knee, ankle };
  });
  const fixed = (b: THREE.Bone): Weights => () => [bones.indexOf(b), bones.indexOf(b), 0];
  const blend = (a: THREE.Bone, b: THREE.Bone, low: number, high: number): Weights => y =>
    [bones.indexOf(a), bones.indexOf(b), THREE.MathUtils.smoothstep(y, low, high)];
  const geometries: THREE.BufferGeometry[][] = Array.from({ length: 8 }, () => []);
  const materials = ["#879caa", "#495d6b", "#d4af96", "#637078", "#e7e1d7", "#584840", "#30383e", "#9baeb9"].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 })
  );
  const skin = (g: THREE.BufferGeometry, mat: number, weights: Weights) => {
    const p = g.getAttribute("position");
    const indices: number[] = [], values: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const [a, b, w] = weights(p.getY(i), p.getX(i), p.getZ(i));
      indices.push(a, b, 0, 0);
      values.push(1 - w, w, 0, 0);
    }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(values, 4));
    g.deleteAttribute("uv");
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    geometries[mat].push(flat);
  };
  // Tailored elliptical sections, with enough loops at joints to bend without gaps.
  const loft = (rings: Ring[], x: number, mat: number, weights: Weights) => {
    const points: number[] = [], indices: number[] = [];
    const segments = 16;
    rings.forEach(([y, w, d, z = 0, dx = 0], row) => {
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2;
        points.push(x + dx + Math.cos(a) * w, y, z + Math.sin(a) * d);
        if (row === rings.length - 1) continue;
        const v = row * segments + j, n = row * segments + (j + 1) % segments;
        indices.push(v, v + segments, n, n, v + segments, n + segments);
      }
    });
    // Close both ends so extreme viewing angles cannot expose hollow limbs.
    [0, rings.length - 1].forEach((row, end) => {
      const [y, , , z = 0, dx = 0] = rings[row];
      const center = points.length / 3;
      points.push(x + dx, y, z);
      for (let j = 0; j < segments; j++) {
        const a = row * segments + j, b = row * segments + (j + 1) % segments;
        indices.push(center, end ? b : a, end ? a : b);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    skin(g, mat, weights);
  };
  const ellipsoid = (p: number[], s: number[], mat: number, weights: Weights) => {
    const g = new THREE.SphereGeometry(1, 16, 12);
    g.scale(s[0], s[1], s[2]).translate(p[0], p[1], p[2]);
    skin(g, mat, weights);
  };
  // Low-profile sneakers: a curved toe, raised heel, shaped vamp and a thin sole.
  // The upper narrows into the ankle instead of ending in a rectangular block.
  const shoe = (side: number) => {
    const yaw = side * .06, offsetZ = 0;
    const foot = legs[side === -1 ? 0 : 1].ankle;
    const transform = new THREE.Matrix4().makeRotationY(yaw);
    transform.setPosition(side * .205, 0, offsetZ);
    const outline = [[0, .30], [.075, .29], [.12, .24], [.13, .14], [.115, .02],
      [.105, -.115], [.075, -.17], [0, -.18], [-.075, -.17], [-.105, -.115],
      [-.108, .015], [-.12, .13], [-.115, .23], [-.07, .285]];
    const surface = (levels: [number, number, number, number][], mat: number) => {
      const positions: number[] = [], indices: number[] = [], n = outline.length;
      levels.forEach(([y, sx, sz, dz], row) => {
        outline.forEach(([x, z], j) => {
          positions.push(x * sx, y, z * sz + dz);
          if (row === levels.length - 1) return;
          const a = row * n + j, b = row * n + (j + 1) % n;
          // This outline runs clockwise when viewed from above.
          indices.push(a, b, a + n, b, b + n, a + n);
        });
      });
      [0, levels.length - 1].forEach((row, end) => {
        const c = positions.length / 3, [y, , , z] = levels[row];
        positions.push(0, y, z);
        for (let j = 0; j < n; j++) {
          const a = row * n + j, b = row * n + (j + 1) % n;
          indices.push(c, end ? a : b, end ? b : a);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices); g.computeVertexNormals(); g.applyMatrix4(transform);
      skin(g, mat, fixed(foot));
    };
    surface([[.008, .88, .94, 0], [.023, 1, 1, 0], [.055, 1, 1, 0], [.07, .94, .96, 0]], 4);
    surface([[.057, .94, .95, 0], [.10, .96, .94, -.005], [.145, .88, .78, -.025],
      [.205, .74, .45, -.05], [.245, .70, .36, -.06]], 3);
    // Small lace bars follow the instep; they do not float above the shoe.
    [.10, .145, .19].forEach((z, i) => {
      const g = new RoundedBoxGeometry(.112 - i * .012, .013, .018, 1, .004);
      g.rotateX(.36).translate(0, .192 - i * .017, z).applyMatrix4(transform);
      skin(g, 4, fixed(foot));
    });
  };
  // Shaped knees and slightly staggered ankles keep the stance relaxed and grounded.
  [-1, 1].forEach(side => {
    shoe(side);
    const ankleZ = 0;
    const { hip, knee, ankle } = legs[side === -1 ? 0 : 1];
    const legWeights: Weights = (y, x, z) => y > 1.10 ? blend(hip, pelvis, 1.10, 1.35)(y, x, z)
      : y > .46 ? blend(knee, hip, .63, .83)(y, x, z) : blend(ankle, knee, .22, .35)(y, x, z);
    loft([[.21, .10, .105, ankleZ], [.27, .112, .113, ankleZ], [.34, .108, .11, ankleZ],
      [.53, .12, .12, ankleZ * .5, side * .012], [.72, .128, .135, .025, side * .018],
      [.81, .123, .132, .037, side * .012], [.92, .135, .14, .02],
      [1.12, .158, .16, 0, -side * .015], [1.30, .15, .13, 0, -side * .028]], side * .205, 1, legWeights);
  });
  loft([[1.10, .06, .075], [1.19, .27, .13], [1.34, .345, .165]], 0, 1, fixed(pelvis));
  const torsoWeights = blend(pelvis, chest, 1.34, 1.86);
  const armWeights = (side: number): Weights => (y, x, z) => {
    const { shoulder, elbow, wrist } = arms[side === -1 ? 0 : 1];
    if (y > 1.84) {
      // The shared armhole follows the chest; influence transfers across the deltoid.
      const w = THREE.MathUtils.smoothstep(Math.abs(x), .29, .45);
      return [bones.indexOf(chest), bones.indexOf(shoulder), w];
    }
    return y > 1.42 ? blend(elbow, shoulder, 1.61, 1.78)(y, x, z)
      : blend(wrist, elbow, 1.27, 1.38)(y, x, z);
  };
  // Build the shirt and both sleeves as one continuous surface. Overlapping tube
  // caps produced the old blocky shoulders and visible armhole seams.
  const hemY = outfit === "coat" ? 1.12 : 1.25;
  const cuffY = outfit === "tee" ? 1.83 : 1.44;
  const profile = [[hemY, .345, .201], [hemY + .05, outfit === "coat" ? .36 : .348, .205], [1.48, .335, .205], [1.70, .325, .193],
    [1.94, .36, .20], [2.10, .354, .198], [2.19, .29, .175], [2.28, .17, .126], [2.32, .112, .108]];
  const smoothMin = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * .25;
  };
  const capsuleDistance = (x: number, y: number, z: number, ax: number, ay: number,
    bx: number, by: number, ra: number, rb: number) => {
    const dx = bx - ax, dy = by - ay;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t, z) - THREE.MathUtils.lerp(ra, rb, t);
  };
  const resolution = 48;
  const garment = new MarchingCubes(resolution, materials[0], false, false, 24000);
  garment.isolation = 0;
  for (let iy = 0; iy < resolution; iy++) {
    const y = 1.80 + (iy / resolution * 2 - 1) * .68;
    let row = 0;
    while (row < profile.length - 2 && y > profile[row + 1][0]) row++;
    const a = profile[row], b = profile[row + 1];
    const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    const width = THREE.MathUtils.lerp(a[1], b[1], t), depth = THREE.MathUtils.lerp(a[2], b[2], t);
    for (let iz = 0; iz < resolution; iz++) for (let ix = 0; ix < resolution; ix++) {
      const x = (ix / resolution * 2 - 1) * .72, z = (iz / resolution * 2 - 1) * .34;
      const body = Math.max((Math.hypot(x / width, z / depth) - 1) * depth, hemY - y, y - 2.32);
      const sx = Math.abs(x);
      const upper = capsuleDistance(sx, y, z, .335, 2.085, .50, 1.69, .108, .09);
      const lower = capsuleDistance(sx, y, z, .50, 1.69, .512, 1.44, .09, .073);
      const sleeve = Math.max(smoothMin(upper, lower, .025), cuffY - y);
      garment.field[iz * resolution * resolution + iy * resolution + ix] = -smoothMin(body, sleeve, .04);
    }
  }
  garment.update();
  const shirt = new THREE.BufferGeometry();
  ["position", "normal"].forEach(name => {
    const attribute = garment.geometry.getAttribute(name);
    shirt.setAttribute(name, new THREE.Float32BufferAttribute(attribute.array.slice(0, garment.count * 3), 3));
  });
  shirt.scale(.72, .68, .34).translate(0, 1.80, 0);
  const cloth = shirt.getAttribute("position");
  for (let i = 0; i < cloth.count; i++) {
    const y = cloth.getY(i), x = cloth.getX(i), z = cloth.getZ(i);
    const hem = 1 - THREE.MathUtils.smoothstep(y, 1.28, 1.55);
    const wrinkle = Math.sin(x * 31 + y * 18) * .004 * hem;
    cloth.setZ(i, z + Math.sign(z) * wrinkle);
  }
  shirt.deleteAttribute("normal");
  const smoothShirt = mergeVertices(shirt, .0001);
  // Relax the extraction grid before calculating normals; tiny sliver triangles
  // otherwise make the shoulder highlights look dented even on a welded mesh.
  const shirtPoints = smoothShirt.getAttribute("position");
  const neighbours = Array.from({ length: shirtPoints.count }, () => new Set<number>());
  const triangles = smoothShirt.index!;
  for (let i = 0; i < triangles.count; i += 3) {
    const a = triangles.getX(i), b = triangles.getX(i + 1), c = triangles.getX(i + 2);
    neighbours[a].add(b).add(c); neighbours[b].add(a).add(c); neighbours[c].add(a).add(b);
  }
  for (let pass = 0; pass < 4; pass++) {
    const relaxed = Float32Array.from(shirtPoints.array);
    neighbours.forEach((adjacent, i) => {
      if (!adjacent.size) return;
      let x = 0, y = 0, z = 0;
      adjacent.forEach(j => { x += shirtPoints.getX(j); y += shirtPoints.getY(j); z += shirtPoints.getZ(j); });
      relaxed[i * 3] = THREE.MathUtils.lerp(shirtPoints.getX(i), x / adjacent.size, .45);
      relaxed[i * 3 + 1] = THREE.MathUtils.lerp(shirtPoints.getY(i), y / adjacent.size, .45);
      relaxed[i * 3 + 2] = THREE.MathUtils.lerp(shirtPoints.getZ(i), z / adjacent.size, .45);
    });
    shirtPoints.array.set(relaxed);
  }
  smoothShirt.computeVertexNormals();
  skin(smoothShirt, 0, (y, x, z) => Math.abs(x) > (y > 1.84 ? .29 : .39) && y > 1.39
    ? armWeights(Math.sign(x))(y, x, z) : torsoWeights(y, x, z));
  shirt.dispose();
  garment.geometry.dispose();
  loft([[2.25, .105, .105], [2.30, .10, .10], [2.43, .11, .105], [2.52, .12, .11]],
    0, 2, blend(neck, head, 2.33, 2.50));
  // A fine ribbed crew neck follows the neckline without floating collar panels.
  const neckline = new THREE.TorusGeometry(.114, .009, 8, 40);
  neckline.rotateX(Math.PI / 2).scale(1.04, 1, .96).translate(0, 2.319, 0);
  skin(neckline, 7, fixed(chest));
  if (outfit === "workwear") {
    // A fitted fabric apron follows the torso curvature instead of a flat slab.
    const panel = new THREE.SphereGeometry(1, 24, 18, 0, Math.PI, .32, 2.5);
    panel.scale(.275, .43, .035).translate(0, 1.70, .206);
    skin(panel, 7, torsoWeights);
  }
  // Soft jaw and a continuous swept hairline, rather than a sphere sitting on a cylinder.
  loft([[2.41, .085, .095, .025], [2.44, .132, .135, .02], [2.52, .176, .16, .014],
    [2.63, .20, .175], [2.76, .203, .178, -.01], [2.87, .165, .15, -.014],
    [2.94, .035, .04, -.014]], 0, 2, fixed(head));
  ellipsoid([0, 2.638, .173], [.027, .039, .04], 2, fixed(head));
  [-1, 1].forEach(side => {
    ellipsoid([side * .199, 2.65, -.002], [.026, .047, .032], 2, fixed(head));
    ellipsoid([side * .077, 2.689, .164], [.010, .013, .006], 6, fixed(head));
    ellipsoid([side * .077, 2.724, .164], [.023, .005, .005], 5, fixed(head));
  });
  const fingers: { bone: THREE.Bone; side: number; thumb: boolean; distal: boolean }[] = [];
  arms.forEach(({ side, wrist }) => {
    const weights = armWeights(side);
    if (outfit === "tee") {
      loft([[1.44, .065, .068], [1.62, .074, .073], [1.69, .080, .077],
        [1.80, .089, .084], [1.87, .088, .083, 0, -side * .04]], side * .50, 2, weights);
    } else loft([[1.43, .078, .079], [1.455, .083, .084], [1.48, .079, .08]], side * .512, 0, weights);
    // One watertight skin from the forearm through the palm and finger webs.
    // Each digit retains its own knuckle and middle joint inside that surface.
    const digits = [-.048, -.016, .016, .046].map((z, i) => {
      const length = [.064, .089, .095, .077][i], upper = length * .56;
      const baseY = 1.157 + (i === 0 ? .009 : 0);
      const base = bone(side + "-finger-" + i, wrist, 0, baseY - 1.29, z);
      const tip = bone(side + "-finger-tip-" + i, base, 0, -upper);
      fingers.push({ bone: base, side, thumb: false, distal: false }, { bone: tip, side, thumb: false, distal: true });
      return { z, baseY, jointY: baseY - upper, endY: baseY - length, base, tip };
    });
    const thumb = bone(side + "-thumb", wrist, -side * .019, -.066, .049);
    const thumbTip = bone(side + "-thumb-tip", thumb, -side * .011, -.032, .021);
    fingers.push({ bone: thumb, side, thumb: true, distal: false }, { bone: thumbTip, side, thumb: true, distal: true });
    const capsule3 = (x: number, y: number, z: number, a: number[], b: number[], ra: number, rb: number) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy, z - a[2] - t * dz) - THREE.MathUtils.lerp(ra, rb, t);
    };
    const handResolution = 48;
    const hand = new MarchingCubes(handResolution, materials[2], false, false, 18000);
    hand.isolation = 0;
    for (let iy = 0; iy < handResolution; iy++) for (let iz = 0; iz < handResolution; iz++) for (let ix = 0; ix < handResolution; ix++) {
      const x = (ix / handResolution * 2 - 1) * .10;
      const y = 1.27 + (iy / handResolution * 2 - 1) * .25;
      const z = .025 + (iz / handResolution * 2 - 1) * .12;
      const palm = (Math.hypot(x / .029, (y - 1.211) / .070, z / .063) - 1) * .029;
      const forearm = capsule3(x, y, z, [0, 1.285, 0], [0, 1.455, 0], .039, .065);
      let distance = smoothMin(palm, forearm, .017);
      digits.forEach(digit => {
        const finger = capsule3(x, y, z, [0, digit.baseY + .014, digit.z], [0, digit.endY, digit.z], .015, .011);
        distance = smoothMin(distance, finger, .010);
      });
      const thumbUpper = capsule3(x, y, z, [-.014, 1.233, .042], [-.030, 1.192, .070], .024, .016);
      const thumbLower = capsule3(x, y, z, [-.030, 1.192, .070], [-.032, 1.157, .077], .016, .012);
      distance = smoothMin(distance, smoothMin(thumbUpper, thumbLower, .010), .012);
      hand.field[iz * handResolution * handResolution + iy * handResolution + ix] = -distance;
    }
    hand.update();
    const handSurface = new THREE.BufferGeometry();
    handSurface.setAttribute("position", new THREE.Float32BufferAttribute(hand.geometry.getAttribute("position").array.slice(0, hand.count * 3), 3));
    handSurface.scale(.10, .25, .12).translate(0, 1.27, .025);
    // Mirror before skinning, reversing winding as well as positions.
    if (side === -1) {
      handSurface.scale(-1, 1, 1);
      const p = handSurface.getAttribute("position");
      for (let i = 0; i < p.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(p, i);
        p.setXYZ(i, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
        p.setXYZ(i + 2, a.x, a.y, a.z);
      }
    }
    handSurface.translate(side * .52, 0, 0);
    const smoothHand = mergeVertices(handSurface, .00001);
    smoothHand.computeVertexNormals();
    skin(smoothHand, 2, (y, x, z) => {
      if (y > 1.26) return weights(y, x, z);
      const localX = side * x - .52;
      if (z > .050 && localX < -.009 && y > 1.14) {
        return y > 1.215 ? blend(thumb, wrist, 1.215, 1.253)(y, x, z)
          : blend(thumbTip, thumb, 1.177, 1.208)(y, x, z);
      }
      const digit = digits.reduce((nearest, d) => Math.abs(d.z - z) < Math.abs(nearest.z - z) ? d : nearest);
      return y > digit.baseY - .012 ? blend(digit.base, wrist, digit.baseY - .012, digit.baseY + .036)(y, x, z)
        : blend(digit.tip, digit.base, digit.jointY - .018, digit.jointY + .018)(y, x, z);
    });
    handSurface.dispose(); hand.geometry.dispose();
  });
  const mergedMaterials = geometries.map(gs => {
    const g = mergeGeometries(gs)!;
    gs.forEach(part => part.dispose());
    return g;
  });
  const geometry = mergeGeometries(mergedMaterials, true)!;
  mergedMaterials.forEach(g => g.dispose());
  const mesh = new THREE.SkinnedMesh(geometry, materials);
  mesh.name = "conversation-character-skin";
  mesh.add(pelvis);
  root.add(mesh);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  // Fine self-shadow stair steps overwhelm these miniature curved surfaces.
  // Shape is lit by its smooth normals; the character still casts a ground shadow.
  mesh.receiveShadow = false;
  // Conservative local bound includes every gesture, avoids per-frame CPU skinning.
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.55, .2), 2);

  templates.set(outfit, cloneRig(root) as THREE.Group);
  mesh.material = materials.map(material => material.clone());
  return animateCharacter(root, mesh, appearance);
}

function animateCharacter(root: THREE.Group, mesh: THREE.SkinnedMesh, appearance: CharacterAppearance) {
  const skeleton = mesh.skeleton, bones = skeleton.bones;
  const named = (name: string) => bones.find(b => b.name === name)!;
  const pelvis = named("pelvis"), chest = named("chest"), neck = named("neck"), head = named("head");
  const arms = [-1, 1].map(side => ({ side, shoulder: named(side + "-shoulder"), elbow: named(side + "-elbow"), wrist: named(side + "-wrist") }));
  const legs = [-1, 1].map(side => ({ side, hip: named(side + "-hip"), knee: named(side + "-knee"), ankle: named(side + "-ankle") }));
  const fingers = bones.filter(b => b.name.includes("finger") || b.name.includes("thumb")).map(b => ({
    bone: b, side: b.name.startsWith("-1") ? -1 : 1, thumb: b.name.includes("thumb"), distal: b.name.includes("tip"),
  }));
  const materials = mesh.material as THREE.MeshStandardMaterial[];
  const colors = [appearance.shirt, appearance.pants, appearance.skin, appearance.shoes, undefined, appearance.hair, undefined, appearance.shirt];
  colors.forEach((color, i) => { if (color) materials[i].color.set(color); });
  materials[7].color.lerp(new THREE.Color("#f0eee4"), .15);
  let hairstyle = createCharacterHair(appearance.hairStyle ?? "Side-swept", appearance.hair, appearance.detailedHair);
  head.add(hairstyle.mesh);
  let motion: CharacterMotion = "talk", motionStart = 0, lastTime = 0;
  let transition: { start: number; rotations: THREE.Quaternion[]; positions: THREE.Vector3[] } | null = null;
  const setMotion = (next: CharacterMotion) => {
    if (next === motion) return;
    transition = { start: lastTime, rotations: bones.map(b => b.quaternion.clone()), positions: bones.map(b => b.position.clone()) };
    motion = next; motionStart = lastTime;
  };
  const setHairStyle = (style: HairStyle) => {
    head.remove(hairstyle.mesh); hairstyle.dispose(); hairstyle = createCharacterHair(style, appearance.hair, appearance.detailedHair); head.add(hairstyle.mesh);
  };
  const locomotion = { distance: 0 };
  const ease = (t: number) => { const v = THREE.MathUtils.clamp(t, 0, 1); return v * v * (3 - 2 * v); };
  const beat = (t: number, start: number, peak: number, release: number, end: number) =>
    ease((t - start) / (peak - start)) * (1 - ease((t - release) / (end - release)));
  const hipOffsets = legs.map(({ hip }) => hip.position.clone());
  const legTarget = new THREE.Vector3(), direction = new THREE.Vector3();
  const bend = new THREE.Vector3(), hinge = new THREE.Vector3(), thigh = new THREE.Vector3();
  const basisY = new THREE.Vector3(), basisZ = new THREE.Vector3();
  const legBasis = new THREE.Matrix4(), pelvisInverse = new THREE.Quaternion();
  const ankleOrientation = new THREE.Quaternion(), legOrientation = new THREE.Quaternion();
  const forwardAxis = new THREE.Vector3(0, 0, 1), pitchAxis = new THREE.Vector3(1, 0, 0);
  const armTarget = new THREE.Vector3(), upperDirection = new THREE.Vector3(), lowerDirection = new THREE.Vector3();
  const elbowPoint = new THREE.Vector3(), armBend = new THREE.Vector3(), armAxis = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion(), handOrientation = new THREE.Quaternion();
  const restUpper = arms.map(({ elbow }) => elbow.position.clone().normalize());
  const restLower = arms.map(({ wrist }) => wrist.position.clone().normalize());
  const update = (time: number, reducedMotion = false) => {
    lastTime = time;
    const elapsed = Math.max(0, time - motionStart);
    const walking = motion === "walk" && !reducedMotion;
    const working = motion === "work" || motion === "bend";
    const bent = motion === "bend";
    const t = reducedMotion || motion !== "talk" ? 0 : ((elapsed % 12) + 12) % 12;
    const strideAngle = elapsed / WALK_PERIOD * Math.PI * 2;
    locomotion.distance = walking ? elapsed * WALK_SPEED : 0;
    // Solve feet in the ground frame while the pelvis shifts over the stance leg.
    // This allows hip rotation without dragging planted shoes across the floor.
    const footTargets = legs.map(({ side }) => walking ? sampleFoot(elapsed, side) : { y: .21, z: 0, pitch: 0 });
    const body = sampleWalkBody(elapsed);
    pelvis.position.x = walking ? body.x : 0;
    pelvis.position.z = 0;
    pelvis.rotation.set(bent ? .82 : 0, walking ? body.yaw : 0, walking ? body.roll : 0);
    hipOffsets.forEach((offset, i) => offset.copy(legs[i].hip.position).applyQuaternion(pelvis.quaternion));
    if (walking) {
      const limits = footTargets.map((f, i) => {
        const hip = hipOffsets[i];
        const dx = legs[i].side * .175 - body.x - hip.x, dz = f.z - hip.z;
        return f.y - hip.y + Math.sqrt(1.02985 ** 2 - dx * dx - dz * dz);
      });
      // A smooth minimum avoids a vertical velocity kink when support changes.
      const min = Math.min(1.28, ...limits), softness = .003;
      pelvis.position.y = min - softness * Math.log(Math.exp((min - 1.28) / softness)
        + limits.reduce((sum, h) => sum + Math.exp((min - h) / softness), 0)) - body.compression;
    } else pelvis.position.y = bent ? 1.24 : 1.28;
    pelvisInverse.copy(pelvis.quaternion).invert();
    legs.forEach(({ hip, knee, ankle }, i) => {
      const foot = footTargets[i];
      if (!walking && !bent) {
        hip.rotation.set(0, 0, 0); knee.rotation.set(0, 0, 0); ankle.rotation.set(0, 0, 0);
        return;
      }
      legTarget.set(legs[i].side * (walking ? .175 : .205), foot.y, foot.z).sub(pelvis.position)
        .applyQuaternion(pelvisInverse).sub(hip.position);
      const distance = legTarget.length();
      const pose = solveLeg(distance, 0);
      direction.copy(legTarget).normalize();
      bend.copy(forwardAxis).applyQuaternion(pelvisInverse);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      hinge.crossVectors(bend, direction).normalize();
      const along = (.52 ** 2 - .51 ** 2 + distance ** 2) / (2 * distance);
      const height = Math.sqrt(Math.max(0, .52 ** 2 - along ** 2));
      thigh.copy(direction).multiplyScalar(along).addScaledVector(bend, height).normalize();
      basisY.copy(thigh).negate(); basisZ.crossVectors(hinge, basisY).normalize();
      hip.quaternion.setFromRotationMatrix(legBasis.makeBasis(hinge, basisY, basisZ));
      knee.rotation.set(pose.knee, 0, 0);
      legOrientation.copy(pelvis.quaternion).multiply(hip.quaternion).multiply(knee.quaternion).invert();
      ankleOrientation.setFromAxisAngle(pitchAxis, foot.pitch);
      ankle.quaternion.copy(legOrientation).multiply(ankleOrientation);
    });
    // Anticipation → open-hand explanation → two accents → settle → listen/nod.
    const explain = beat(t, .6, 1.7, 4.4, 5.6);
    const accent = beat(t, 2.1, 2.45, 2.6, 3.15) + .7 * beat(t, 3.5, 3.85, 4.0, 4.5);
    const support = beat(t, 2.8, 3.6, 4.2, 5.25);
    const nod = beat(t, 7.1, 7.45, 7.55, 8) + .6 * beat(t, 8.3, 8.6, 8.7, 9.1);
    const breath = reducedMotion ? 0 : Math.sin(elapsed * .9);
    chest.rotation.set(.018 + explain * .035 + breath * .008, -.07 * explain, -.018 - explain * .018);
    neck.rotation.set(.025 + nod * .075, explain * .035, .018);
    head.rotation.set(-.025 + accent * .035 + nod * .045, .035 - explain * .055, -.018);
    if (motion === "idle" && !reducedMotion) {
      head.rotation.x += Math.sin(elapsed * .7) * .025;
      head.rotation.y += Math.sin(elapsed * .43) * .025;
    }
    arms.forEach(({ side, shoulder, elbow, wrist }) => {
      const lead = side === -1;
      const gesture = lead ? explain : support * .32;
      shoulder.rotation.set(-.035 - gesture * .16 - (lead ? accent * .035 : 0),
        -side * gesture * .10, side * (.025 + gesture * .055));
      elbow.rotation.set(-.14 - gesture * .94 - (lead ? accent * .12 : 0), 0, 0);
      wrist.rotation.set(.025 - gesture * .045, -side * gesture * .30, side * gesture * .045);
    });
    fingers.forEach(({ bone: joint, side, thumb, distal }) => {
      const open = side === -1 ? explain : support * .32;
      joint.rotation.set(thumb ? -.08 - open * .10 : 0, 0,
        thumb ? side * .12 : -side * (distal ? .40 - open * .24 : .19 - open * .13));
    });
    if (walking) {
      chest.rotation.set(.028, -body.yaw * 1.6, -body.roll * .65);
      neck.rotation.set(-.016, body.yaw * .3, -body.roll * .2);
      head.rotation.set(-.012, body.yaw * .3, -body.roll * .15);
      arms.forEach(({ side, shoulder, elbow, wrist }) => {
        const swing = side * Math.cos(strideAngle - .12);
        shoulder.rotation.set(-.055 - .27 * swing, side * .018, side * .012);
        elbow.rotation.set(-.19 - .10 * Math.max(0, swing), 0, 0);
        wrist.rotation.set(.02 + side * .025 * Math.sin(strideAngle - .25), 0, 0);
      });
    }
    if (working) {
      const rhythm = reducedMotion ? 0 : Math.sin(elapsed * 2.0);
      chest.rotation.set(bent ? .18 : .09, rhythm * .012, 0);
      neck.rotation.set(bent ? .10 : .14, 0, 0);
      head.rotation.set(.12, rhythm * .025, 0);
      root.updateMatrixWorld(true);
      arms.forEach(({ side, shoulder, elbow, wrist }, i) => {
        // Targets are in the character's frame: wrist just above the work surface.
        armTarget.set(side * .28 + (i === 0 ? rhythm * .025 : 0), bent ? 1.12 : 1.76,
          (bent ? 1.05 : .72) + (i === 0 ? rhythm * .035 : 0));
        mesh.localToWorld(armTarget); chest.worldToLocal(armTarget); armTarget.sub(shoulder.position);
        const upper = elbow.position.length(), lower = wrist.position.length();
        const distance = Math.min(upper + lower - .004, armTarget.length());
        armAxis.copy(armTarget).normalize();
        armBend.set(side, -.4, 0).addScaledVector(armAxis, -armBend.dot(armAxis)).normalize();
        const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
        elbowPoint.copy(armAxis).multiplyScalar(along)
          .addScaledVector(armBend, Math.sqrt(Math.max(0, upper * upper - along * along)));
        upperDirection.copy(elbowPoint).normalize();
        shoulder.quaternion.setFromUnitVectors(restUpper[i], upperDirection);
        lowerDirection.copy(armAxis).multiplyScalar(distance).sub(elbowPoint)
          .applyQuaternion(parentRotation.copy(shoulder.quaternion).invert()).normalize();
        elbow.quaternion.setFromUnitVectors(restLower[i], lowerDirection);
        parentRotation.copy(pelvis.quaternion).multiply(chest.quaternion).multiply(shoulder.quaternion).multiply(elbow.quaternion).invert();
        handOrientation.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, side * Math.PI / 2));
        wrist.quaternion.copy(parentRotation).multiply(handOrientation);
      });
    }
    if (transition && !reducedMotion) {
      const mix = ease((time - transition.start) / .45);
      bones.forEach((b, i) => {
        b.quaternion.slerpQuaternions(transition!.rotations[i], b.quaternion.clone(), mix);
        b.position.lerpVectors(transition!.positions[i], b.position.clone(), mix);
      });
      if (mix === 1) transition = null;
    }
    hairstyle.update(time, head.rotation.y + chest.rotation.y, walking, reducedMotion);
  };
  update(0);
  return { root, update, mesh, bones, setMotion, setHairStyle, locomotion, dispose: () => { skeleton.dispose(); hairstyle.dispose(); } };
}
