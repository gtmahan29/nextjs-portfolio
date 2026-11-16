import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let message: unknown;
  try { ({ message } = await request.json()); } catch {
    return NextResponse.json({ error: "Please send a question." }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 1500) {
    return NextResponse.json({ error: "Please keep your question under 1,500 characters." }, { status: 400 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Personal conversation available." }, { status: 503 });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ model: process.env.OPENAI_CONCIERGE_MODEL || "gpt-4.1-mini", max_output_tokens: 220,
        instructions: "You are the AI project concierge on Mahan Adeli’s portfolio. Mahan offers product discovery, UI/UX, full stack architecture, runtime engineering, scaling, and launch. Help a prospective customer work through what is holding their project back. Be warm, thoughtful, specific, and pressure-free. Reply in at most 90 words. Acknowledge their concern, offer one practical small next step, and ask one useful question. Never invent prices, availability, guarantees, past work, or promises from Mahan. For those details, invite a personal conversation with Mahan. Do not claim to send messages, book meetings, or place orders. Do not request sensitive personal data. Answer only questions about starting a product or hiring Mahan’s services.",
        input: message.trim(), store: false }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const data = await response.json();
    const reply = data.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
      .filter((item: { type: string }) => item.type === "output_text")
      .map((item: { text: string }) => item.text).join("\n");
    if (!reply) throw new Error("Empty response");
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Personal conversation available." }, { status: 503 });
  }
}
