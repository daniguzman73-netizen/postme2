// api/generate.js
// When content is a URL, Claude fetches it directly using Anthropic's
// web fetch tool — no separate scraping infrastructure needed.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const ipHits = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    ipHits.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  ipHits.set(ip, entry);
  return false;
}

const SOCIAL_DOMAINS = ["linkedin.com", "x.com", "twitter.com", "facebook.com"];

function isSocialUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return SOCIAL_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch { return false; }
}

function isUrl(str) {
  try { new URL(str); return str.startsWith("http"); }
  catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { prompt, url } = req.body;

  // Handle URL mode
  if (url) {
    if (isSocialUrl(url)) {
      const messages = {
        "linkedin.com": "LinkedIn posts require you to be logged in, so we can't fetch them automatically. Copy the post text and use Paste Text instead.",
        "x.com": "X (Twitter) posts can't be fetched automatically. Copy the post text and use Paste Text instead.",
        "twitter.com": "X (Twitter) posts can't be fetched automatically. Copy the post text and use Paste Text instead.",
        "facebook.com": "Facebook posts require you to be logged in, so we can't fetch them automatically. Copy the post text and use Paste Text instead.",
      };
      const hostname = new URL(url).hostname.replace("www.", "");
      const msg = Object.entries(messages).find(([k]) => hostname === k || hostname.endsWith("." + k));
      return res.status(422).json({ error: msg?.[1] || "This social platform requires login." });
    }

    // Use Anthropic's web fetch tool to read the URL
    try {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-fetch-2025-09-10",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{
            type: "web_fetch_20250910",
            name: "web_fetch",
            max_uses: 1,
          }],
          messages: [{
            role: "user",
            content: prompt, // prompt already contains the URL and instructions
          }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Anthropic error:", data);
        return res.status(502).json({ error: "Could not read the URL. Try copying the text and using Paste Text instead." });
      }

      const text = data.content
        ?.filter(b => b.type === "text")
        .map(b => b.text)
        .join("")
        .trim();

      if (!text) return res.status(502).json({ error: "Could not extract content from the URL. Try Paste Text instead." });

      return res.status(200).json({ text });

    } catch (err) {
      console.error("Web fetch error:", err);
      return res.status(500).json({ error: "Could not read this page. Try copying the text and using Paste Text instead." });
    }
  }

  // Handle text mode
  if (!prompt || typeof prompt !== "string" || prompt.length > 8000) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", data);
      return res.status(502).json({ error: "Generation failed. Please try again." });
    }

    const text = data.content
      ?.filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    if (!text) throw new Error("No response");
    return res.status(200).json({ text });

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Generation failed. Please try again." });
  }
}
