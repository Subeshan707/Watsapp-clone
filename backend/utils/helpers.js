// Generate a consistent conversation ID (not essential for this design)
const getConversationId = (user1Id, user2Id) => {
  return [user1Id, user2Id].sort().join('_');
};

module.exports = { getConversationId };
