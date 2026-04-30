const User = require('../models/User');

// Authenticate or create user (simple login/register)
const authenticateUser = async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    let user = await User.findOne({ username: username.trim() });
    if (!user) {
      user = await User.create({ username: username.trim() });
    }
    res.status(200).json({ _id: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all users except the current user
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select('_id username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

module.exports = { authenticateUser, getAllUsers };
