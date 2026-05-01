const User = require('../models/User');

/**
 * Migrate existing users that don't have phoneNumber field.
 * Assigns a unique demo phone number so the new schema constraint is satisfied.
 */
async function migrateUsers() {
  try {
    // Drop the old unique index on 'username' if it exists
    const collection = User.collection;
    const indexes = await collection.indexes();
    const usernameIndex = indexes.find(
      (idx) => idx.key && idx.key.username && idx.unique
    );
    if (usernameIndex) {
      await collection.dropIndex(usernameIndex.name);
      console.log('[Migration] Dropped old unique index on username');
    }

    // Find users without phoneNumber
    const usersWithoutPhone = await User.find({
      $or: [
        { phoneNumber: { $exists: false } },
        { phoneNumber: null },
        { phoneNumber: '' }
      ]
    });

    if (usersWithoutPhone.length === 0) {
      console.log('[Migration] No users need migration');
      return;
    }

    console.log(`[Migration] Migrating ${usersWithoutPhone.length} users...`);

    for (let i = 0; i < usersWithoutPhone.length; i++) {
      const user = usersWithoutPhone[i];
      user.phoneNumber = `legacy_${user._id}`;
      user.countryCode = '+00';
      user.about = user.about || 'Hey there! I am using Orbit.';
      user.isVerified = true;
      await user.save();
    }

    console.log(`[Migration] Successfully migrated ${usersWithoutPhone.length} users`);
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    // Non-fatal — continue server startup
  }
}

module.exports = { migrateUsers };
