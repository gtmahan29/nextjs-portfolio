import { Quaternion, Vector3 } from 'three';

export const PANEL_NAMES = Object.freeze(['front', 'right', 'back', 'left', 'top', 'bottom']);

/** Six independent hinges. Call update(deltaSeconds) once per render frame. */
export class GoldenCubeController {
  constructor(root, { speed = 2.4 } = {}) {
    this.speed = speed;
    this.panels = new Map(PANEL_NAMES.map(name => {
      const hinge = root.getObjectByName(`Hinge_${name}`);
      if (!hinge) throw new Error(`Golden cube is missing Hinge_${name}`);
      const axis = new Vector3(...hinge.userData.open_axis_gltf).normalize();
      return [name, { hinge, axis, angle: hinge.userData.open_angle_rad,
        closed: hinge.quaternion.clone(), value: 0, target: 0 }];
    }));
    this.rotation = new Quaternion();
  }
  setPanel(name, amount, { immediate = false } = {}) {
    const panel = this.panels.get(name);
    if (!panel) throw new RangeError(`Unknown panel: ${name}`);
    if (!Number.isFinite(amount)) throw new TypeError('Panel amount must be finite');
    panel.target = Math.max(0, Math.min(1, amount));
    if (immediate) { panel.value = panel.target; this.apply(panel); }
  }
  open(name) { this.setPanel(name, 1); }
  close(name) { this.setPanel(name, 0); }
  toggle(name) { this.setPanel(name, this.panels.get(name)?.target > 0.5 ? 0 : 1); }
  openAll() { PANEL_NAMES.forEach(name => this.open(name)); }
  closeAll() { PANEL_NAMES.forEach(name => this.close(name)); }
  apply(panel) {
    const t = panel.value * panel.value * (3 - 2 * panel.value);
    this.rotation.setFromAxisAngle(panel.axis, panel.angle * t);
    panel.hinge.quaternion.copy(panel.closed).multiply(this.rotation);
  }
  update(deltaSeconds) {
    const step = Math.max(0, Math.min(deltaSeconds, 0.1)) * this.speed;
    for (const panel of this.panels.values()) {
      const difference = panel.target - panel.value;
      panel.value += Math.sign(difference) * Math.min(Math.abs(difference), step);
      this.apply(panel);
    }
  }
}
