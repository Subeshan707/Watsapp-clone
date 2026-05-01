const Message = require('../models/Message');
const path = require('path');
const dotenv = require('dotenv');

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

function getModel() {
  return (process.env.GROQ_MODEL || DEFAULT_MODEL).trim();
}

function getSystemPrompt() {
  return (
    process.env.AI_SYSTEM_PROMPT ||
    'You are a helpful AI chat bot inside a Orbit-style chat app. Keep replies concise and friendly. Use plain text. For highlighting/emphasis, use Markdown bold with double asterisks like **this** (never triple asterisks like ***this***).'
  );
}

function sanitizeAssistantText(text) {
  // The UI renders plain text; ensure the bot uses **...** instead of ***...*** for emphasis.
  return String(text).replace(/\*{3,}/g, '**');
}

function normalizeGroqMessages(history, userId, botId) {
  return history
    .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m) => {
      const senderId = String(m.sender);
      const role = senderId === String(botId) ? 'assistant' : 'user';
      return { role, content: m.content };
    });
}

async function fetchConversationHistory(userId, botId, limit = 20) {
  const docs = await Message.find({
    $or: [
      { sender: userId, receiver: botId },
      { sender: botId, receiver: userId },
    ],
    deletedFor: { $nin: [userId] },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('sender content timestamp');

  return docs.reverse();
}

async function generateAiReplyForConversation(userId, botId) {
  let apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Best-effort: load env if server didn't pick it up (or .env changed while running).
    try {
      dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
      apiKey = process.env.GROQ_API_KEY;
    } catch {
      // ignore
    }
  }

  if (!apiKey) {
    return 'AI is not configured on the server. Set GROQ_API_KEY in backend/.env and restart the backend.';
  }

  const history = await fetchConversationHistory(userId, botId, 24);
  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...normalizeGroqMessages(history, userId, botId),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        temperature: 0.6,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const apiMessage = data && typeof data === 'object' && data.error && data.error.message
        ? String(data.error.message)
        : `Groq request failed (${res.status})`;
      return `AI error: ${apiMessage}`;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      return "AI didn't return a response.";
    }

    return sanitizeAssistantText(content.trim());
  } catch (err) {
    const msg = err && typeof err === 'object' && 'name' in err && err.name === 'AbortError'
      ? 'AI request timed out.'
      : 'AI request failed.';
    return `AI error: ${msg}`;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { generateAiReplyForConversation };
