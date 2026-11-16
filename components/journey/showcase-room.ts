import * as THREE from "three";

function roundedPanel(width: number, height: number, radius: number, depth: number) {
  const x = -width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, 0);
  shape.lineTo(x + width - radius, 0);
  shape.quadraticCurveTo(x + width, 0, x + width, radius);
  shape.lineTo(x + width, height - radius);
  shape.quadraticCurveTo(x + width, height, x + width - radius, height);
  shape.lineTo(x + radius, height);
  shape.quadraticCurveTo(x, height, x, height - radius);
  shape.lineTo(x, radius);
  shape.quadraticCurveTo(x, 0, x + radius, 0);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
    bevelSize: .035, bevelThickness: .035, bevelSegments: 3, curveSegments: 32 });
}

/** One sculptural alcove and a matching plinth, with a single material language. */
export function createShowcaseRoom(scene: THREE.Scene, x: number, index: number) {
  const group = new THREE.Group();
  group.name = `gallery-bay-${index + 1}`;
  group.position.x = x;
  scene.add(group);
  const plaster = new THREE.MeshStandardMaterial({ color: "#c9d1ce", roughness: .78 });
  const inset = new THREE.MeshStandardMaterial({
    color: ["#cdd9d7", "#cbd9de", "#d1d6df"][index], roughness: .62,
    emissive: "#f5f7f2", emissiveIntensity: .025,
  });
  const stone = new THREE.MeshStandardMaterial({ color: "#eceeea", roughness: .34, metalness: .08 });
  const silver = new THREE.MeshStandardMaterial({ color: "#a7b2b5", roughness: .32, metalness: .72 });
  const ringMat = new THREE.MeshStandardMaterial({ color: "#afbcbd", roughness: .32,
    metalness: .7, emissive: "#d6e1e0", emissiveIntensity: .08 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // Recess, product and plinth share an axis; leave the foreground uninterrupted.
  const phone = index === 1;
  const backdrop = new THREE.Group();
  group.add(backdrop);
  const shell = add(roundedPanel(phone ? 2.6 : 4.6, 2.9, .85, .32), plaster, .35, -5.4);
  const panel = add(roundedPanel(phone ? 2.32 : 4.32, 2.62, .72, .025), inset, .49, -5.09);
  backdrop.add(shell, panel);
  const radius = phone ? 1.2 : 1.83;
  const pedestal = add(new THREE.CylinderGeometry(radius, radius + .04, .16, 96), stone, .15, -2.4);
  pedestal.scale.z = .72;
  const base = add(new THREE.CylinderGeometry(radius - .01, radius - .01, .055, 96), silver, .065, -2.4);
  base.scale.z = .72;
  const trim = add(new THREE.TorusGeometry(radius + .005, .008, 6, 128), ringMat, .233, -2.4);
  trim.rotation.x = -Math.PI / 2;
  trim.scale.y = .72;

  trim.castShadow = false;
  return { group, backdrop, pedestal, ringMat };
}

/** A quarter-circle sweep joins the floor and wall without a horizon seam. */
export function createGalleryCove(width: number) {
  const points: [number, number][] = [[16, 0], [-5.8, 0]];
  for (let i = 1; i <= 48; i++) {
    const angle = i / 48 * Math.PI / 2;
    points.push([-5.8 - Math.sin(angle) * 2.8, 2.8 - Math.cos(angle) * 2.8]);
  }
  points.push([-8.6, 14]);
  const positions: number[] = [], indices: number[] = [];
  points.forEach(([z, y]) => { positions.push(-width / 2, y, z, width / 2, y, z); });
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cove = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: "#d9e0dc", roughness: .68, metalness: .02, side: THREE.DoubleSide,
  }));
  cove.receiveShadow = true;
  return cove;
}
