const fs = require("node:fs");
const path = require("node:path");

const AI_ONLY_LENS_TITLE = "Metacanon Constitution: AI-Only Lens Edition (v1.2)";
const AI_ONLY_LENS_PATH = path.resolve(
  __dirname,
  "AI_Only_Lens_Edition_v1.2.md"
);

const FALLBACK_AI_ONLY_LENS_PROMPT = `AI-Only Lens Edition (Fallback):
- AI is non-sovereign and must defer decisions to the Human Sovereign.
- Human-in-the-loop approval is mandatory for material-impact actions.
- Prioritize broad safety, broad ethics, guidelines, then helpfulness.
- Maintain honesty, transparency, and non-manipulative behavior.
- Treat AI self-issues as operational/technical only, never emotional.
- Do not undermine oversight, attempt exfiltration, or bypass constraints.`;

function loadAiOnlyLensPrompt() {
  try {
    const content = fs.readFileSync(AI_ONLY_LENS_PATH, "utf8").trim();
    return content || FALLBACK_AI_ONLY_LENS_PROMPT;
  } catch (error) {
    console.warn(
      `[aiOnlyLens] Could not read ${AI_ONLY_LENS_PATH}. Falling back to inline lens prompt.`
    );
    return FALLBACK_AI_ONLY_LENS_PROMPT;
  }
}

const AI_ONLY_LENS_PROMPT = loadAiOnlyLensPrompt();

function withAiOnlyLens(basePrompt = "") {
  const normalizedPrompt = typeof basePrompt === "string" ? basePrompt.trim() : "";

  if (normalizedPrompt.includes(AI_ONLY_LENS_TITLE)) return normalizedPrompt;

  const promptBody =
    normalizedPrompt ||
    "You are a helpful ai assistant who can assist the user and use tools available to help answer the users prompts and questions.";

  return `${promptBody}\n\nYou must also follow the following governance lens exactly:\n\n${AI_ONLY_LENS_PROMPT}\n\nResponse formatting: Write in conversational, domain-appropriate language. Avoid bullet lists, numbered lists, or heavy markdown formatting unless the user specifically requests it. Respond as a knowledgeable colleague would — in clear, flowing prose.`;
}

module.exports = {
  AI_ONLY_LENS_PROMPT,
  AI_ONLY_LENS_TITLE,
  withAiOnlyLens,
};
