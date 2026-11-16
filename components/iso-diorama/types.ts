export type ZoneId = "webdev" | "seo" | "social" | "hosting";

export interface ZoneConfig {
  id: ZoneId;
  number: string;
  title: string;
  pillSlug: string;
  tagline: string;
  accentHex: string;
  secondaryHex: string;
  center: [number, number, number];
  pillAnchor: [number, number, number];
  focusCameraPos: [number, number, number];
  focusTarget: [number, number, number];
  interactions: string[];
}

export interface ZoneUniformState {
  uActive: { value: number };
  uGlow: { value: number };
  uTime: { value: number };
}

export type ZoneUniformMap = Record<ZoneId, ZoneUniformState>;

export const OVERVIEW_CAMERA_POS: [number, number, number] = [25.0, 20.0, 25.0];
export const OVERVIEW_TARGET: [number, number, number] = [0, 1.35, 0];

export const ZONES: Record<ZoneId, ZoneConfig> = {
  webdev: {
    id: "webdev",
    number: "01",
    title: "Web Development",
    pillSlug: "web-development",
    tagline: "HTML capsule, PHP pipeline, code editor & CSS trick-shot hoop.",
    accentHex: "#F5B335",
    secondaryHex: "#FCE7B2",
    center: [-4.22, 0, -4.22],
    pillAnchor: [-6.4, 0.65, -0.4],
    focusCameraPos: [5.5, 10.2, 8.8],
    focusTarget: [-4.2, 1.5, -4.1],
    interactions: [
      "Click HTML glass dome to launch a letter surge",
      "Click CSS hoop or slab to shoot a trick-shot cube",
      "Click </> window to cycle code syntax",
      "Click PHP plinth to wave-bounce the blocks",
    ],
  },
  seo: {
    id: "seo",
    number: "02",
    title: "SEO & Search",
    pillSlug: "seo-strategy",
    tagline: "Traffic bar charts, metro tunnel, WiFi beacon & KEYWORD_ lens.",
    accentHex: "#7E74D8",
    secondaryHex: "#D4CEF5",
    center: [-4.22, 0, 4.22],
    pillAnchor: [-4.2, 0.65, 7.8],
    focusCameraPos: [6.8, 9.8, 15.2],
    focusTarget: [-4.1, 1.5, 4.2],
    interactions: [
      "Click KEYWORD_ search bar to cycle search rankings",
      "Click SEO tunnel or train to dispatch an express run",
      "Click bar chart columns to surge organic growth",
    ],
  },
  social: {
    id: "social",
    number: "03",
    title: "Social Media",
    pillSlug: "social-media",
    tagline: "Hovering heart drone, live typing speech bubble & satellite link.",
    accentHex: "#2EAD67",
    secondaryHex: "#78D69B",
    center: [4.22, 0, -4.22],
    pillAnchor: [4.2, 0.65, -7.8],
    focusCameraPos: [14.8, 10.2, 6.4],
    focusTarget: [4.1, 1.8, -4.1],
    interactions: [
      "Click the drone or heart bubble to emit floating hearts",
      "Click the ••• speech bubble for a typing burst",
      "Click the satellite dish to ping a social broadcast",
    ],
  },
  hosting: {
    id: "hosting",
    number: "04",
    title: "Web Hosting",
    pillSlug: "web-hosting",
    tagline: "Wireframe globe, data-center racks, tower crane & drive gear.",
    accentHex: "#F35B25",
    secondaryHex: "#FF8759",
    center: [4.22, 0, 4.22],
    pillAnchor: [4.2, 0.65, 7.8],
    focusCameraPos: [15.4, 10.2, 15.4],
    focusTarget: [4.2, 1.6, 4.2],
    interactions: [
      "Click the tower crane to cycle a payload lift",
      "Click the wireframe globe for a high-speed spin",
      "Click the white cogwheel or servers to boost throughput",
    ],
  },
};

export const ZONE_LIST: ZoneConfig[] = [
  ZONES.webdev,
  ZONES.seo,
  ZONES.social,
  ZONES.hosting,
];
