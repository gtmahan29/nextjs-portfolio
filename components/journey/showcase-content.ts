import * as THREE from "three";
import type { DeviceScreenContent } from "./showcase-devices";

export const SHOWCASE_PRODUCTS = [
  { name: "Websites & commerce", short: "Websites", detail: "Help people understand your business, find what they need, and take the next step — enquire, book, or buy.", examples: ["Brand websites", "Online stores", "Booking experiences"], color: "#b97750", colorInt: 0xb97750 },
  { name: "Apps for your customers", short: "Apps", detail: "Put your service in their hands. Make everyday tasks easier, from placing an order to managing a membership.", examples: ["Customer apps", "Subscriptions", "On-demand services"], color: "#688774", colorInt: 0x688774 },
  { name: "Platforms for your team", short: "Platforms", detail: "Bring scattered work into one place. Give your team the tools to manage customers, orders, and operations.", examples: ["SaaS products", "Client portals", "Internal tools"], color: "#6488a8", colorInt: 0x6488a8 },
] as const;

const lamp = `<svg viewBox="0 0 300 300" aria-label="Arc table lamp" role="img"><ellipse cx="150" cy="260" rx="74" ry="10" fill="#302b2412"/><path d="M143 145h14v102h-14z" fill="#93684e"/><ellipse cx="150" cy="246" rx="51" ry="9" fill="#a67d60"/><path d="M61 151 Q65 54 150 54 Q235 54 239 151Z" fill="#c18d68"/><ellipse cx="150" cy="151" rx="89" ry="11" fill="#e6c6a7"/><path d="M83 128 Q96 70 145 66" fill="none" stroke="#dbac87" stroke-width="5" stroke-linecap="round"/></svg>`;
const brand = `<strong class="demo-brand">FORM<span>®</span></strong>`;
const badge = `<span class="demo-concept">CONCEPT STORE</span>`;

function markup(index: number) {
  if (index === 0) return `<div class="demo demo-store"><header>${brand}<nav>Collection &nbsp;&nbsp; Our story &nbsp;&nbsp; Journal</nav><span>Bag (0)</span></header><div class="demo-hero"><div><p class="demo-kicker">OBJECTS FOR EVERYDAY LIVING</p><h1>Less, but<br>more considered.</h1><p>Quiet forms. Honest materials.<br>Made to feel at home.</p><button data-demo-action>Explore the collection <span>↗</span></button></div><div class="demo-object">${lamp}<span>ARC / TABLE LIGHT</span></div></div><footer>${badge}<span>Thoughtful objects. A seamless checkout.</span><span>01 / 03</span></footer><div class="demo-reveal" hidden><b>Meet Arc.</b><span>Warm light, wherever you need it.</span><strong>$180</strong><button data-demo-close>Back to collection ←</button></div></div>`;
  if (index === 1) return `<div class="demo demo-mobile"><header>${brand}<span>Bag (0)</span></header><p class="demo-kicker">YOUR SPACE, CONSIDERED.</p><h1>A little<br>light goes far.</h1><div class="demo-object">${lamp}</div><div class="demo-product"><div><h2>Arc table lamp</h2><p>Oak · warm white</p></div><strong>$180</strong></div><p class="demo-description">A softer way to end the day. Sculpted oak, with a warm glow.</p><button data-demo-action>Add to bag <span>+</span></button><footer>${badge}<span>Collection &nbsp; / &nbsp; Saved &nbsp; / &nbsp; Profile</span></footer><div class="demo-toast" role="status" hidden>Arc added to your bag ✓</div></div>`;
  return `<div class="demo demo-admin"><aside>${brand}<span class="demo-kicker">WORKSPACE</span><b>Overview</b><span>Orders</span><span>Collection</span><span>Customers</span><small>FORM / CONCEPT</small></aside><main><header><div><p class="demo-kicker">MONDAY, OCTOBER 12</p><h1>A good day to grow.</h1></div><span class="demo-avatar">F</span></header><div class="demo-metrics"><div><span>Sales this month</span><strong>$24,680</strong><small>↑ 12.8% vs. last month</small></div><div><span>Orders</span><strong>148</strong><small>24 ready to ship</small></div><div><span>Returning customers</span><strong>32%</strong><small>↑ 4.2% vs. last month</small></div></div><div class="demo-chart"><div><b>Sales overview</b><span>Last 7 days</span></div><svg viewBox="0 0 700 170"><path d="M0 144H700M0 95H700M0 46H700" stroke="#e7e9e4" fill="none"/><path d="M0 137 Q45 150 90 109 T190 112 T300 70 T415 83 T525 36 T700 17 L700 170H0Z" fill="#e4eee6"/><path d="M0 137 Q45 150 90 109 T190 112 T300 70 T415 83 T525 36 T700 17" stroke="#6f9279" stroke-width="3" fill="none"/></svg><span class="demo-days">MON &nbsp;&nbsp;&nbsp; TUE &nbsp;&nbsp;&nbsp; WED &nbsp;&nbsp;&nbsp; THU &nbsp;&nbsp;&nbsp; FRI &nbsp;&nbsp;&nbsp; SAT &nbsp;&nbsp;&nbsp; SUN</span></div><div class="demo-orders"><b>Latest orders</b><span>Order &nbsp;&nbsp;&nbsp; Customer &nbsp;&nbsp;&nbsp; Status &nbsp;&nbsp;&nbsp; Total</span><p>#1048 <span>Alex Morgan</span><em>Ready to ship</em><strong>$180</strong></p><p>#1047 <span>Sam Lee</span><em>Delivered</em><strong>$320</strong></p></div><footer><span class="demo-concept">CONCEPT · SAMPLE DATA</span><span>Storefront → orders → fulfilment</span></footer></main></div>`;
}

export function createProductContent(index: number): DeviceScreenContent {
  return { type: "html", mount(element) {
    element.innerHTML = markup(index);
    const action = element.querySelector<HTMLButtonElement>("[data-demo-action]");
    const close = element.querySelector<HTMLButtonElement>("[data-demo-close]");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interact = () => {
      if (index === 0) element.querySelector<HTMLElement>(".demo-reveal")!.hidden = false;
      if (index === 1 && action) {
        action.innerHTML = "Added to bag <span>✓</span>";
        const toast = element.querySelector<HTMLElement>(".demo-toast")!;
        toast.hidden = false;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { toast.hidden = true; }, 2500);
      }
    };
    const dismiss = () => { element.querySelector<HTMLElement>(".demo-reveal")!.hidden = true; };
    action?.addEventListener("click", interact); close?.addEventListener("click", dismiss);
    return () => { if (timer) clearTimeout(timer); action?.removeEventListener("click", interact); close?.removeEventListener("click", dismiss); element.replaceChildren(); };
  } };
}

/** An inexpensive preview stays inside the original screen geometry until focus. */
export function createProductPreview(index: number, maxSize=1200) {
  const canvas = document.createElement("canvas");
  canvas.width = index === 1 ? 390 : 1200;
  canvas.height = index === 1 ? 828 : 716;
  const x = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  x.fillStyle = index === 2 ? "#f5f6f2" : "#f7f4ec"; x.fillRect(0,0,w,h);
  const text = (label: string, px: number, py: number, size = 20, color = "#292d27", weight = 400) => { x.fillStyle=color; x.font=`${weight} ${size}px Arial`; x.fillText(label,px,py); };
  text("FORM®",index===2?28:36, index===1?68:52,28,"#292d27",700);
  if (index === 2) {
    x.fillStyle="#eaece5";x.fillRect(0,80,180,h-80);
    ["Overview","Orders","Collection","Customers"].forEach((s,i)=>text(s,28,150+i*50,18));
    text("A good day to grow.",225,115,40,"#292d27",600);
    ["$24,680","148","32%"].forEach((s,i)=>{x.fillStyle="#fff";x.fillRect(225+i*300,160,275,110);text(["Sales this month","Orders","Returning customers"][i],245+i*300,190,16);text(s,245+i*300,237,34,"#292d27",600);});
    x.fillStyle="#fff";x.fillRect(225,295,875,220);text("Sales overview",245,331,20,"#292d27",600);
    x.beginPath();x.moveTo(245,480);[440,454,405,421,379,395,350,355].forEach((v,i)=>x.lineTo(245+i*115,v));x.strokeStyle="#6f9279";x.lineWidth=4;x.stroke();
    text("Latest orders",245,560,20,"#292d27",600);text("#1048     Alex Morgan                 Ready to ship              $180",245,605,18);text("#1047     Sam Lee                       Delivered                    $320",245,650,18);
  } else {
    const mobile=index===1;
    text(mobile?"YOUR SPACE, CONSIDERED.":"OBJECTS FOR EVERYDAY LIVING",mobile?28:64,mobile?130:210, mobile?11:13,"#797d72",600);
    text(mobile?"A little":"Less, but",mobile?28:64,mobile?188:300,mobile?49:72,"#292d27",600);
    text(mobile?"light goes far.":"more considered.",mobile?28:64,mobile?245:382,mobile?49:72,"#292d27",600);
    if(!mobile) {text("Quiet forms. Honest materials.",66,448,20,"#73776d");text("Made to feel at home.",66,480,20,"#73776d");}
    const cx=mobile?195:880, cy=mobile?457:400, scale=mobile?1:1.55;
    x.save();x.translate(cx,cy);x.scale(scale,scale);
    x.fillStyle="#ede4d6";x.beginPath();x.ellipse(0,94,102,14,0,0,Math.PI*2);x.fill();
    x.fillStyle="#a47b5e";x.fillRect(-7,-12,14,100);x.beginPath();x.ellipse(0,84,53,10,0,0,Math.PI*2);x.fill();
    const g=x.createLinearGradient(-90,0,90,0);g.addColorStop(0,"#d8ac87");g.addColorStop(1,"#b67e58");x.fillStyle=g;x.beginPath();x.moveTo(-95,-8);x.bezierCurveTo(-88,-128,88,-128,95,-8);x.closePath();x.fill();x.fillStyle="#e7c9a9";x.beginPath();x.ellipse(0,-8,95,10,0,0,Math.PI*2);x.fill();x.restore();
    if(mobile){text("Arc table lamp",28,607,26,"#292d27",600);text("$180",298,607,23);text("Oak · warm white",28,639,15,"#73776d");}
    x.fillStyle="#30392d";x.fillRect(mobile?28:64,mobile?716:531,mobile?334:265,52);text(mobile?"Add to bag  +":"Explore the collection  ↗",mobile?52:86,mobile?748:563,18,"#fff",500);
  }
  text(index===2?"CONCEPT · SAMPLE DATA":"CONCEPT STORE",index===2?28:28,h-22,index===1?10:12,"#85887f",500);
  let source=canvas;
  if(Math.max(w,h)>maxSize){source=document.createElement("canvas");const ratio=maxSize/Math.max(w,h);source.width=Math.round(w*ratio);source.height=Math.round(h*ratio);source.getContext("2d")!.drawImage(canvas,0,0,source.width,source.height);}
  const texture=new THREE.CanvasTexture(source);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
