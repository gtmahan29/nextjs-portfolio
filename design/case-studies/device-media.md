# Case-study media and motion

The active case studies use reusable DOM device mockups, not the previously generated device photographs. The hardware and screen content are separate. `case-device.tsx` provides laptop, tablet and phone variants. The laptop lid is independently articulated; its base remains a separate element.

## Replace screens

Add `media` to the relevant entry in `components/journey/project-case-data.ts`:

```tsx
media: {
  desktop: {
    type: "video",
    src: "/work/my-project/desktop.mp4",
    poster: "/work/my-project/desktop-poster.webp",
    alt: "A walkthrough of the desktop interface",
  },
  tablet: {
    type: "image",
    src: "/work/my-project/tablet.webp",
    alt: "The tablet interface",
  },
  phone: {
    type: "video",
    src: "/work/my-project/mobile.mp4",
    poster: "/work/my-project/mobile-poster.webp",
    alt: "A walkthrough of the mobile interface",
  },
},
```

Files go in `public/work/my-project/`. No remote service is required. Videos use native playback controls, are muted and loop, and support inline playback. They do not autoplay with sound. Desktop screens default to the existing project screenshot. Tablet screens default to the desktop media. Until a phone asset is supplied, the phone contains a responsive, project-themed layout exploration rather than pretending that a desktop crop is a mobile website.

## Choreography

- Opening stage: the full-width screen retreats into the laptop; the lid pivots and the whole device settles into view.
- Device spread: tablet translation, rotation and scale are independent of the phone's movement. The large background word moves on another plane.
- Detail spread: the interface moves vertically through its crop as the section crosses the viewport.

Motion reads the native dialog's scroll container via Framer Motion `useScroll`. Continuous values use motion values and a damped spring, without React state updates on every scroll. The background page remains mounted and locked. Reduced-motion preferences remove the pinned travel distances and render stable device poses.

The scope is a short visual project presentation: brief, visual language, device choreography, detail view and complete interface. Content is limited to available project information; no research, client outcomes or performance numbers are invented.
