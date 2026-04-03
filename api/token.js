const fs = require("fs/promises");
const path = require("path");
const { instructions: rawInstructions, avatar3Prompt } = require("../constants/prompt.js");

// Helper to read files relative to this file
const readFile = (relativePath) =>
  fs.readFile(path.join(__dirname, relativePath), "utf-8");

// Preload knowledge bases once per runtime
let baseInstructions;
let avatar3Instructions;

async function loadPrompts() {
  if (baseInstructions && avatar3Instructions) return;

  const knowledgeBase = await readFile("../data/knowledgebase.txt");
  baseInstructions = rawInstructions.replace("{{KNOWLEDGE_BASE}}", knowledgeBase);

  const alfalahKnowledgeBase = await readFile("../data/alfalah_knowledge_base.json");
  avatar3Instructions = `${avatar3Prompt}\n\n## KNOWLEDGE BASE\n${alfalahKnowledgeBase}`;
}

module.exports = async function handler(req, res) {
  try {
    await loadPrompts();

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

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

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
};
