import type {CaseMedia} from "../case-device";

export type RasaCaptureId = "entrance" | "reel" | "programs" | "workshops" | "tunnel" | "consultation" | "roadmap" | "mobile";
export type RasaCapture = {title: string; route: string; brief: string; short: string; format: string; filename: string; media?: CaseMedia};
export const RASA_CAPTURES: Record<RasaCaptureId, RasaCapture> = {
  entrance: {title: "The architectural entrance", route: "/", short: "Record the opening doors and the move into the classroom.", brief: "Start at the top of the home page. Scroll slowly through the architectural doors into the classroom. Pause at each room and keep the cursor away from the content. Capture the interface only.", format: "1440 × 900 · 12–18 sec · MP4", filename: "rasa-entrance.mp4"},
  reel: {title: "The learning-skills reel", route: "/", short: "Record the listening, speaking, reading and writing sequence.", brief: "Continue below the opening scene. Record the complete learning-skills reel: listening and phonics, speaking, reading and writing. Include the rotating dial, character changes and the handoff into the programmes.", format: "1440 × 900 · 12–18 sec · MP4", filename: "rasa-skills.mp4"},
  programs: {title: "Five pathways, one academy", route: "/#programs", short: "Record the five age-based programme cards moving across the screen.", brief: "Record the programme section from Starter Immersion through Everyday & Professional English. Show how scrolling carries the five age-based cards across the viewport and pause briefly at the adult pathway.", format: "1440 × 900 · 10–15 sec · MP4", filename: "rasa-programs.mp4"},
  workshops: {title: "Learning beyond the lesson", route: "/#gallery", short: "Record the workshop notes stacking and releasing with scroll.", brief: "Record the paper-note workshop deck: stories, conversation, reading and writing, projects, and placement. Show the cards stacking and the release into the next section. Do not crop the note titles.", format: "1440 × 900 · 10–15 sec · MP4", filename: "rasa-workshops.mp4"},
  tunnel: {title: "Inside the alphabet tunnel", route: "/#alphabet-tunnel", short: "Record the complete passage through the 3D alphabet tunnel.", brief: "Scroll through the alphabet tunnel at a steady pace, including the opening, passing letters and the exit into the consultation section. Keep the viewport size fixed during the recording.", format: "1440 × 900 · 12–18 sec · MP4", filename: "rasa-alphabet.mp4"},
  consultation: {title: "A guided first conversation", route: "/#journey", short: "Record audience selection, a learning goal, then the contact step.", brief: "Show the child/teen and adult audience choices, select a learning goal, then reach the name and phone step. Use blank or clearly fictional fields. Stop before submission: the present implementation shows a local confirmation, with no network request.", format: "1440 × 900 · 12–18 sec · MP4", filename: "rasa-consultation.mp4"},
  roadmap: {title: "A learning journey made spatial", route: "/roadmap", short: "Record the learner following all five stations in the 3D world.", brief: "Open the standalone roadmap. Follow the learner from orientation to guided class, home practice, conversation and real-world use. Keep the stage headings visible and pause at each station.", format: "1440 × 900 · 15–25 sec · MP4", filename: "rasa-roadmap.mp4"},
  mobile: {title: "The story at phone width", route: "/", short: "Record the entrance, programme cards and consultation at phone width.", brief: "At 390 × 844, capture the home entrance, a programme-card transition and the consultation audience choices. Record the interface without browser chrome. Keep this as a short edited sequence if the full page takes too long.", format: "390 × 844 · 15–20 sec · MP4", filename: "rasa-mobile.mp4"},
};

export const RASA_CHAPTERS = [
  {id: "invitation", name: "Invitation"}, {id: "pathways", name: "Pathways"},
  {id: "learning", name: "Learning in motion"}, {id: "conversation", name: "First conversation"},
  {id: "world", name: "The learning world"}, {id: "craft", name: "The craft"},
];

export const PROGRAMMES = [
  {name: "Starter Immersion", age: "3–5", focus: "Sounds, rhythm and picture-led stories introduce the youngest learners to English.", color: "#f3ca89"},
  {name: "Phonics & Literacy", age: "6–8", focus: "Sound and letter patterns connect listening to early reading and writing.", color: "#e8b8bf"},
  {name: "Junior Fluency", age: "9–11", focus: "Role play, storytelling and everyday situations give speaking a practical context.", color: "#bcc6e6"},
  {name: "Teens Mastery", age: "12–15", focus: "Presentations, discussion and short analytical writing build on the earlier foundations.", color: "#b9d5c4"},
  {name: "Everyday & Professional English", age: "16+", focus: "The adult pathway centres on real goals: everyday communication, work and travel.", color: "#b7d7e6"},
];
export const ROADMAP = [
  {title: "Find a starting point", label: "Orientation", detail: "Placement and a conversation about the learner's situation and goals."},
  {title: "Practise with guidance", label: "Guided class", detail: "Listening, speaking and feedback within a classroom setting."},
  {title: "Continue between classes", label: "Home practice", detail: "Books, listening and independent practice keep the learning connected."},
  {title: "Use it with other people", label: "Conversation", detail: "Discussion, projects and real situations put the language to work."},
  {title: "Take it into daily life", label: "Real-world use", detail: "The roadmap closes on independent communication, rather than simply finishing a book."},
];
