import fs from "fs/promises";
import { instructions as rawInstructions, avatar3Prompt } from "../constants/prompt.js";

// Load knowledge bases once per function instance
const knowledgeBase = await fs.readFile(
  new URL("../data/knowledgebase.txt", import.meta.url),
  "utf-8",
);
const baseInstructions = rawInstructions.replace("{{KNOWLEDGE_BASE}}", knowledgeBase);

const alfalahKnowledgeBase = await fs.readFile(
  new URL("../data/alfalah_knowledge_base.json", import.meta.url),
  "utf-8",
);
const avatar3Instructions = `${avatar3Prompt}\n\n## KNOWLEDGE BASE\n${alfalahKnowledgeBase}`;

export default async function handler(req, res) {
  try {
    const voice = req.query.voice || "marin";
    const avatar = req.query.avatar || "avatar1";

    const sessionConfig = {
      session: {
        type: "realtime",
        model: "gpt-4o-mini-realtime-preview",
        audio: {
          output: {
            voice,
          },
        },
        instructions: avatar === "avatar3" ? avatar3Instructions : baseInstructions,
      },
    };

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionConfig),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI client_secrets error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Failed to generate token",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}
