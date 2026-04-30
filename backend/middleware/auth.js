const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User ID header (x-user-id) is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    req.userId = userId;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = authenticate;
