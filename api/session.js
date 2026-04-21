import fs from "fs/promises";
import { instructions as rawInstructions, avatar3Prompt } from "../constants/prompt.js";

const knowledgeBase = await fs.readFile(
  new URL("../data/knowledgebase.txt", import.meta.url),
  "utf-8",
);
const instructions = rawInstructions.replace("{{KNOWLEDGE_BASE}}", knowledgeBase);

const alfalahKnowledgeBase = await fs.readFile(
  new URL("../data/alfalah_knowledge_base.json", import.meta.url),
  "utf-8",
);
const avatar3Instructions = `${avatar3Prompt}\n\n## KNOWLEDGE BASE\n${alfalahKnowledgeBase}`;

const BEHAVIOR_RULES = `

BEHAVIOR RULES:
- Greet the user warmly as soon as the session starts.
- If the user sends abusive, offensive, threatening, or completely off-topic messages, call the flag_abuse function silently.
- After the flag_abuse tool result is returned, give one brief polite warning. If the tool result says the session will end, make it a final warning and say the session is ending now.
- At the end of a completed conversation, ask: "Is there anything else I can help you with?"
- If the user says no (for example: "no", "no thank you", "that's all", or "I'm good"), call the end_call function silently.
- After the end_call tool result is returned, thank the user warmly and give a short goodbye. Do not mention tools or function calls.
`;

const sessionTools = [
  {
    type: "function",
    name: "flag_abuse",
    description:
      "Call this silently when the user sends abusive, offensive, threatening, or completely off-topic messages.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "end_call",
    description:
      "Call this silently when the user confirms they do not need further help and the conversation is complete.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

function buildSessionConfig({ voice, avatar }) {
  const baseInstructions = avatar === "avatar3" ? avatar3Instructions : instructions;

  return JSON.stringify({
    session: {
      type: "realtime",
      model: "gpt-4o-mini-realtime-preview",
      audio: {
        output: {
          voice,
        },
      },
      instructions: `${baseInstructions}${BEHAVIOR_RULES}`,
      tools: sessionTools,
      tool_choice: "auto",
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY in Vercel environment.");
      return res.status(500).json({ error: "Server is missing OPENAI_API_KEY." });
    }

    const fd = new FormData();
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    fd.set("sdp", body);
    fd.set(
      "session",
      buildSessionConfig({
        voice: req.query.voice || "marin",
        avatar: req.query.avatar || "avatar1",
      }),
    );

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        "OpenAI-Beta": "realtime=v1",
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    });

    const sdp = await response.text();

    if (!response.ok) {
      console.error("OpenAI session error:", sdp);
      return res.status(response.status).send(sdp);
    }

    return res.status(200).send(sdp);
  } catch (error) {
    console.error("Session generation error:", error);
    return res.status(500).json({ error: "Failed to generate session" });
  }
}
