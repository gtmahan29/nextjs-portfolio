import * as THREE from "three";

function screen(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a release screen");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function productPhone(image?: HTMLImageElement) {
  return screen(360, 654, ctx => {
    ctx.fillStyle = "#221810";
    ctx.fillRect(0, 0, 360, 654);
    if (image) ctx.drawImage(image, image.width * .40, image.height * .10,
      image.width * .37, image.height * .73, 76, 61, 284, 484);
    const scrim = ctx.createLinearGradient(0, 0, 360, 0);
    scrim.addColorStop(0, "#221810");
    scrim.addColorStop(.56, "#221810dc");
    scrim.addColorStop(1, "#22181000");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 54, 360, 516);
    ctx.fillStyle = "#17120e";
    ctx.fillRect(0, 0, 360, 67);
    ctx.fillStyle = "#ead8a5";
    ctx.font = "700 22px Arial";
    ctx.fillText("AAQ Gold", 25, 43);
    ctx.fillStyle = "#faf1e0";
    ctx.font = "700 49px Arial";
    ctx.fillText("The New", 24, 182);
    ctx.fillText("Gold", 24, 236);
    ctx.fillStyle = "#dfb550";
    ctx.fillText("Standard.", 24, 290);
    ctx.fillStyle = "#f4e9d0";
    ctx.font = "20px Arial";
    ctx.fillText("AAQ Gold Reserve", 26, 344);
    ctx.fillStyle = "#e5ba57";
    ctx.beginPath();
    ctx.roundRect(25, 397, 135, 42, 21);
    ctx.fill();
    ctx.fillStyle = "#1c180f";
    ctx.font = "700 16px Arial";
    ctx.fillText("Get started", 48, 424);
    ctx.fillStyle = "#30261c";
    ctx.fillRect(0, 547, 360, 107);
    ctx.fillStyle = "#e6d6b3";
    ctx.font = "19px Arial";
    ctx.fillText("Gold Reserve", 25, 608);
  });
}

export function releaseMonitor() {
  return screen(840, 512, ctx => {
    ctx.fillStyle = "#101d1a";
    ctx.fillRect(0, 0, 840, 512);
    ctx.fillStyle = "#223c32";
    ctx.fillRect(0, 0, 840, 78);
    ctx.fillStyle = "#dce9df";
    ctx.font = "700 30px Arial";
    ctx.fillText("Production", 38, 50);
    ctx.fillStyle = "#abdeaf";
    ctx.beginPath();
    ctx.arc(705, 39, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "700 22px Arial";
    ctx.fillText("Live", 729, 47);
    ctx.fillStyle = "#cfdfd3";
    ctx.font = "700 23px Arial";
    ctx.fillText("Release checks", 38, 130);
    ctx.fillText("Request activity", 417, 130);
    const checks = ["Site reachable", "HTTPS active", "Alerts connected"];
    checks.forEach((label, i) => {
      const y = 154 + i * 92;
      ctx.fillStyle = "#1b2d26";
      ctx.fillRect(37, y, 349, 72);
      ctx.fillStyle = "#9cdfac";
      ctx.beginPath();
      ctx.arc(72, y + 35, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#244932";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(66, y + 35);
      ctx.lineTo(70, y + 39);
      ctx.lineTo(78, y + 31);
      ctx.stroke();
      ctx.font = "600 24px Arial";
      ctx.fillStyle = "#dce9df";
      ctx.fillText(label, 101, y + 43);
    });
    ctx.fillStyle = "#182924";
    ctx.fillRect(418, 153, 385, 256);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#375044";
    for (let i = 0; i < 4; i++) {
      const y = 193 + i * 58;
      ctx.beginPath();
      ctx.moveTo(445, y);
      ctx.lineTo(777, y);
      ctx.stroke();
    }
    const points = [[448, 347], [478, 329], [511, 333], [540, 287], [574, 307],
      [616, 260], [642, 284], [680, 229], [716, 246], [749, 208], [777, 217]];
    const area = ctx.createLinearGradient(0, 190, 0, 372);
    area.addColorStop(0, "#82d4a273");
    area.addColorStop(1, "#82d4a208");
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(...points[0] as [number, number]);
      points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    };
    trace();
    ctx.lineTo(777, 375);
    ctx.lineTo(448, 375);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();
    trace();
    ctx.lineWidth = 4.5;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = "#9fe1ad";
    ctx.stroke();
    ctx.fillStyle = "#a9bdb0";
    ctx.font = "21px Arial";
    ctx.fillText("Launch overview", 38, 466);
  });
}

export function productFallback() {
  return screen(780, 438, ctx => {
    ctx.fillStyle = "#282017";
    ctx.fillRect(0, 0, 780, 438);
    ctx.fillStyle = "#e4bf62";
    ctx.font = "700 24px Arial";
    ctx.fillText("AAQ Gold", 46, 69);
    ctx.font = "700 62px Arial";
    ctx.fillStyle = "#f7edda";
    ctx.fillText("The New Gold", 46, 204);
    ctx.fillStyle = "#e4bf62";
    ctx.fillText("Standard.", 46, 273);
  });
}
