"use client";

import {useState, type ReactNode} from "react";
import {motion, type MotionValue} from "framer-motion";

/** Screen content stays separate from the hardware. Replace either image or video per project. */
export type CaseMedia = {
  type: "image" | "video";
  src: string;
  alt: string;
  poster?: string;
};

export function DeviceScreen({media, priority = false}: {media: CaseMedia; priority?: boolean}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="device-media-fallback" role="img" aria-label={media.alt}>Preview unavailable</div>;
  return media.type === "video"
    ? <video key={media.src} src={media.src} poster={media.poster} controls muted loop playsInline preload="metadata" aria-label={media.alt} onError={() => setFailed(true)}/>
    : <img key={media.src} src={media.src} alt={media.alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} draggable={false} onError={() => setFailed(true)}/>;
}

export function DeviceMockup({kind = "laptop", media, children, priority = false, className = "", lidRotation = 0}: {
  kind?: "laptop" | "tablet" | "phone";
  media?: CaseMedia;
  children?: ReactNode;
  priority?: boolean;
  className?: string;
  lidRotation?: number | MotionValue<number>;
}) {
  return <div className={`case-device case-device-${kind} ${className}`}>
    <motion.div className="device-lid" style={{rotateX: lidRotation, transformOrigin: "50% 100%"}}>
      <div className="device-camera" aria-hidden="true"/>
      <div className="device-display">{children ?? (media && <DeviceScreen media={media} priority={priority}/>)}</div>
      <span className="device-chin" aria-hidden="true"/>
    </motion.div>
    {kind === "laptop" && <><div className="device-hinge" aria-hidden="true"/><div className="device-base" aria-hidden="true"><span/></div></>}
    {kind === "phone" && <span className="device-home" aria-hidden="true"/>}
  </div>;
}
