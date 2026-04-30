const { getOrCreateAiBotUser } = require('../utils/aiBot');

const getAiBot = async (req, res) => {
  try {
    const bot = await getOrCreateAiBotUser();
    res.json({ _id: String(bot._id), username: bot.username });
  } catch {
    res.status(500).json({ error: 'Failed to get AI bot' });
  }
};

module.exports = { getAiBot };
