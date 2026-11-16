import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Run with node scripts/check-character.mjs. No browser or renderer is required.
const modules = new Map();
function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, name) => {
    const url = name.startsWith(".") ? moduleUrl(path.resolve(path.dirname(file), `${name}.ts`))
      : pathToFileURL(path.resolve(name === "three" ? "node_modules/three/build/three.module.js" : `node_modules/${name}`)).href;
    return `from "${url}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(file, url);
  return url;
}

const { createConversationCharacter } = await import(moduleUrl(path.resolve("components/journey/conversation-character.ts")));
const { sampleFoot, WALK_SPEED, WALK_PERIOD } = await import(moduleUrl(path.resolve("components/journey/character-gait.ts")));
const { HAIR_STYLES } = await import(moduleUrl(path.resolve("components/journey/character-hair.ts")));
const THREE = await import(pathToFileURL(path.resolve("node_modules/three/build/three.module.js")));
const character = createConversationCharacter();
const knees = [-1, 1].map(side => character.bones.find(b => b.name === `${side}-knee`));
character.setMotion("idle"); character.update(1);
assert(knees.every(knee => Math.abs(knee.rotation.x) < 1e-10), "Resting knees must be straight");
character.setMotion("walk");
const straightFrames = [0, 0];
let ankleError = 0, lowestVertex = Infinity;
const position = character.mesh.geometry.getAttribute("position");
for (let frame = 90; frame <= 390; frame++) {
  const time = frame / 60;
  character.update(time); character.root.updateMatrixWorld(true); character.mesh.skeleton.update();
  for (const [i, side] of [-1, 1].entries()) {
    const foot = sampleFoot(time - 1, side);
    const ankle = character.bones.find(b => b.name === `${side}-ankle`).getWorldPosition(new THREE.Vector3());
    ankleError = Math.max(ankleError, Math.hypot(ankle.x - side * .175, ankle.y - foot.y, ankle.z - foot.z));
    // Within five degrees of full extension, without locking the joint at heel impact.
    if (Math.abs(knees[i].rotation.x) < Math.PI / 36 && foot.planted) straightFrames[i]++;
    if (foot.planted && foot.phase > .11 && foot.phase < .49) {
      const next = sampleFoot(time - 1 + .001, side);
      assert(Math.abs(next.contactZ + .001 * WALK_SPEED - foot.contactZ) < 1e-8, "Planted foot slides");
    }
  }
  for (let i = 0; i < position.count; i += 31) {
    const v = character.mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(position, i));
    assert(Number.isFinite(v.length()), "Invalid skinned vertex");
    lowestVertex = Math.min(lowestVertex, v.y);
  }
}
assert(ankleError < 1e-5, "Leg IK misses its foot target");
assert(straightFrames.every(n => n > 20), "Support knees never extend during walking");
assert(lowestVertex > -.012, "Geometry passes below the floor");
// Contact, toe-off and cycle wrap must not introduce a velocity jump.
for (const phase of [0, .10, .42, .62, 1]) {
  const time = phase * WALK_PERIOD, dt = .00001;
  const before = sampleFoot(time - dt, -1), at = sampleFoot(time, -1), after = sampleFoot(time + dt, -1);
  for (const axis of ["y", "z", "pitch"]) {
    const incoming = (at[axis] - before[axis]) / dt;
    const outgoing = (after[axis] - at[axis]) / dt;
    assert(Math.abs(incoming - outgoing) < .01, `Foot ${axis} velocity jumps at phase ${phase}`);
  }
}
for (const style of HAIR_STYLES) {
  character.setHairStyle(style); character.update(8);
  const hair = character.root.getObjectByName(`hair-${style}`);
  assert(hair, `Missing hairstyle ${style}`);
  const p = hair.geometry.getAttribute("position"), flex = hair.geometry.getAttribute("flex");
  const before = Float32Array.from(p.array);
  character.update(8.25);
  let movingTips = 0;
  for (let i = 0; i < p.count; i += 17) {
    assert(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), "Invalid hair vertex");
    const delta = Math.abs(p.getX(i) - before[i * 3]);
    if (flex.getX(i) === 0) assert(delta === 0, "Hair roots must stay anchored");
    else if (delta > 1e-7) movingTips++;
  }
  assert(movingTips > 5, `Hair tips do not move: ${style}`);
}
character.update(10, true);
assert(knees.every(knee => Math.abs(knee.rotation.x) < 1e-10), "Reduced-motion pose must be grounded and still");
character.dispose();
console.log("PASS", { restingKnees: "straight", straightStanceFrames: straightFrames, ankleError, lowestVertex, hairstyles: HAIR_STYLES.length });
