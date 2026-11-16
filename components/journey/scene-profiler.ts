import type { WebGLRenderer } from "three";

/** Opt-in diagnostics only; never collect or send visitor telemetry. */
export function createSceneProfiler(canvas: HTMLCanvasElement, renderer: WebGLRenderer, name: string) {
  const enabled = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("scenePerf");
  const cpu: number[] = [], calls: number[] = [], triangles: number[] = [], intervals: number[] = [];
  let started = 0, last = 0, published = 0, frames = 0,firstFrameCpu:number|undefined;
  if (enabled) renderer.info.autoReset = false;
  return {
    begin(now: number) {
      if (!enabled) return;
      renderer.info.reset(); started = performance.now();
      if (last && now - last < 250) intervals.push(now - last);
      last = now;
    },
    end(now: number, details: Record<string, unknown> = {}) {
      if (!enabled) return;
      frames++;
      const work=performance.now()-started;firstFrameCpu??=work;
      cpu.push(work); calls.push(renderer.info.render.calls); triangles.push(renderer.info.render.triangles);
      [cpu, calls, triangles, intervals].forEach(a => { if (a.length > 120) a.shift(); });
      if (now - published < 1000 && frames > 1 && !details.settled) return;
      const sorted = cpu.slice().sort((a,b)=>a-b), cadence = intervals.slice().sort((a,b)=>a-b);
      canvas.dataset.scenePerf = JSON.stringify({name, frames, samples:cpu.length,
        firstFrameCpu,lastFrameCpu:work,lastCalls:renderer.info.render.calls,lastTriangles:renderer.info.render.triangles,
        cpuP50:sorted[Math.floor(sorted.length*.5)], cpuP95:sorted[Math.floor(sorted.length*.95)],
        frameP50:cadence[Math.floor(cadence.length*.5)],
        calls:Math.round(calls.reduce((a,b)=>a+b,0)/calls.length),
        triangles:Math.round(triangles.reduce((a,b)=>a+b,0)/triangles.length),
        geometries:renderer.info.memory.geometries, textures:renderer.info.memory.textures,
        pixelRatio:renderer.getPixelRatio(), ...details});
      published=now;
    },
  };
}
