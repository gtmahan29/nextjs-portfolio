export type ShowroomStops = { start: number; end: number; step: number };

/** The input gesture owns a single destination, including both boundaries. */
export class ShowroomScrollGate {
  consumed = false;
  private busyUntil = 0;
  constructor(private reducedMotion = false) {}

  begin(now: number) { this.consumed = now < this.busyUntil; }

  decide(bounds: ShowroomStops | null, current: number, delta: number, now: number, fresh: boolean): number | "hold" | null {
    if (!bounds || !delta) return null;
    if (fresh) this.begin(now);
    if (this.consumed) return "hold";
    const direction = Math.sign(delta);
    let destination: number | null = null;
    if (current < bounds.start - 2) {
      if (direction > 0 && current + delta >= bounds.start) destination = bounds.start;
    } else if (current > bounds.end + 2) {
      if (direction < 0 && current + delta <= bounds.end) destination = bounds.end;
    } else {
      const index = Math.max(0, Math.min(2, Math.round((current - bounds.start) / bounds.step)));
      const next = index + direction;
      destination = next < 0 ? bounds.start - window.innerHeight : next > 2 ? bounds.end + window.innerHeight : bounds.start + next * bounds.step;
    }
    if (destination !== null) {
      this.consumed = true;
      this.busyUntil = now + (this.reducedMotion ? 120 : 900);
    }
    return destination === null ? null : Math.max(0, destination);
  }
}
