"use client";

import {useState} from "react";
import {Check, Copy, Video} from "lucide-react";
import {RASA_CAPTURES, type RasaCaptureId} from "./data";
import {DeviceScreen} from "../case-device";

export function RasaCapture({id, phone = false}: {id: RasaCaptureId; phone?: boolean}) {
  const capture = RASA_CAPTURES[id];
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <figure className={`rasa-capture ${phone ? "is-phone" : ""} ${capture.media ? "has-media" : ""}`}>
    <div className="rasa-capture-device">
      <div className="rasa-device-camera" aria-hidden="true"/>
      <div className="rasa-capture-screen">{capture.media ? <DeviceScreen media={capture.media}/> : <div className="rasa-capture-placeholder"><div className="rasa-placeholder-meta"><span>Recording to be added</span><code>{capture.route}</code></div><div className="rasa-placeholder-copy"><Video size={28} strokeWidth={1}/><h3>{capture.title}</h3><p>{capture.short}</p><span>{capture.format}</span></div><code className="rasa-placeholder-file">{capture.filename}</code></div>}</div>
      {phone && <span className="rasa-phone-home" aria-hidden="true"/>}
    </div>
    <figcaption><div><span>{capture.route}</span><strong>{capture.title}</strong></div><button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Close capture brief" : "Capture instructions"}<span aria-hidden="true">{expanded ? "−" : "+"}</span></button></figcaption>
    {expanded && <div className="rasa-capture-brief"><p>{capture.brief}</p><span>{capture.format}</span><button onClick={async () => {try {await navigator.clipboard.writeText(`${capture.title}\n${capture.route}\n${capture.brief}\n${capture.format}\n${capture.filename}`);setCopied(true);} catch {setFailed(true);}}}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? "Copied" : failed ? "Select the brief above" : "Copy brief"}</button></div>}
  </figure>;
}
