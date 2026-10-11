const express = require("express");
const path = require("path");
const BANK = require("./questions");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const TOPICS = ["rivers and lakes", "mountains and volcanoes", "capital cities", "islands and archipelagos", "deserts and climate", "borders and landlocked nations", "oceans, seas and straits", "famous landmarks", "world cities", "flags and national symbols", "historical geography and medieval kingdoms", "population and area records", "national parks and natural wonders", "general knowledge: science, history and culture"];

const build = (q, a, w, src) => {
  const options = shuffle([a, ...w]);
  return { question: q, options, answerIndex: options.indexOf(a), source: src };
};

async function aiQuestion(recent) {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400,
      system: "You write trivia questions. Reply with ONLY a JSON object: {\"question\":string,\"correct\":string,\"wrong\":[string,string,string]}. Exactly one answer must be unambiguously correct and factually verified. Be varied; avoid the most obvious questions.",
      messages: [{ role: "user", content: `Topic: ${topic}. Mostly geography. Do NOT repeat or paraphrase any of these:\n${recent.slice(-40).join("\n")}` }]
    })
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  const txt = data.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
  const j = JSON.parse(txt);
  if (!j.question || !j.correct || j.wrong?.length !== 3) throw new Error("bad shape");
  return build(j.question, j.correct, j.wrong, "ai");
}

app.post("/api/question", async (req, res) => {
  const seenIds = new Set(req.body.seenIds || []);
  const recent = req.body.recent || [];
  if (KEY && Math.random() < 0.6) {
    try { return res.json(await aiQuestion(recent)); } catch (e) { console.warn("AI fallback:", e.message); }
  }
  let pool = BANK.filter(b => !seenIds.has(b.id));
  let reset = false;
  if (!pool.length) { pool = BANK; reset = true; }
  const b = pool[Math.floor(Math.random() * pool.length)];
  res.json({ ...build(b.q, b.a, b.w, "bank"), id: b.id, reset });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hear ye! The tavern is open at http://localhost:${PORT} (${KEY ? "AI scribe enabled" : "built-in scrolls only"}, ${BANK.length} questions)`));