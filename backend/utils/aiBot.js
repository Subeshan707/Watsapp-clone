const User = require('../models/User');

const DEFAULT_AI_BOT_USERNAME = 'AI ChatBot';

let cachedBot = null; // { _id, username }

function getAiBotUsername() {
  return (process.env.AI_BOT_USERNAME || DEFAULT_AI_BOT_USERNAME).trim();
}

async function getOrCreateAiBotUser() {
  if (cachedBot) return cachedBot;

  const username = getAiBotUsername();
  let bot = await User.findOne({ username }).select('_id username phoneNumber countryCode about');
  if (bot) {
    cachedBot = bot;
    return bot;
  }

  try {
    bot = await User.create({ username, phoneNumber: 'ai_bot', countryCode: '+00', about: 'AI-powered assistant' });
  } catch (err) {
    // If two requests race, the unique index may throw; refetch.
    bot = await User.findOne({ username }).select('_id username phoneNumber countryCode about');
    if (!bot) throw err;
  }

  cachedBot = bot;
  return bot;
}

module.exports = { getAiBotUsername, getOrCreateAiBotUser };
