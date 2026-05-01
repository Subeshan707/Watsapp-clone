const Contact = require('../models/Contact');
const User = require('../models/User');

// Sync contacts from phone (bulk import)
const syncContacts = async (req, res) => {
  const userId = req.userId;
  const { contacts } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array is required' });
  }

  try {
    let added = 0;
    let updated = 0;

    for (const c of contacts) {
      if (!c.phoneNumber || !c.name) continue;

      const cleanPhone = c.phoneNumber.trim().replace(/\s+/g, '').replace(/^0+/, '');
      const code = (c.countryCode || '+91').trim();
      const name = c.name.trim();

      if (!cleanPhone || !name) continue;

      // Find if this contact is a registered user
      const registeredUser = await User.findOne({
        phoneNumber: cleanPhone,
        countryCode: code
      });

      const updateData = {
        name,
        isRegistered: !!registeredUser,
        registeredUserId: registeredUser ? registeredUser._id : null
      };

      const result = await Contact.findOneAndUpdate(
        { userId, phoneNumber: cleanPhone, countryCode: code },
        { $set: updateData, $setOnInsert: { userId, phoneNumber: cleanPhone, countryCode: code } },
        { upsert: true, new: true, rawResult: true }
      );

      if (result.lastErrorObject?.updatedExisting) {
        updated++;
      } else {
        added++;
      }
    }

    res.status(200).json({
      success: true,
      added,
      updated,
      total: added + updated
    });
  } catch (err) {
    console.error('Sync contacts error:', err);
    res.status(500).json({ error: 'Failed to sync contacts' });
  }
};

// Add a single contact manually
const addContact = async (req, res) => {
  const userId = req.userId;
  const { phoneNumber, countryCode, name } = req.body;

  if (!phoneNumber || !name || name.trim() === '') {
    return res.status(400).json({ error: 'Phone number and name are required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '').replace(/^0+/, '');
  const code = (countryCode || '+91').trim();
  const trimmedName = name.trim();

  try {
    // Check if contact is a registered user
    const registeredUser = await User.findOne({
      phoneNumber: cleanPhone,
      countryCode: code
    });

    const contact = await Contact.findOneAndUpdate(
      { userId, phoneNumber: cleanPhone, countryCode: code },
      {
        $set: {
          name: trimmedName,
          isRegistered: !!registeredUser,
          registeredUserId: registeredUser ? registeredUser._id : null
        },
        $setOnInsert: { userId, phoneNumber: cleanPhone, countryCode: code }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      contact: {
        _id: contact._id,
        phoneNumber: contact.phoneNumber,
        countryCode: contact.countryCode,
        name: contact.name,
        isRegistered: contact.isRegistered,
        registeredUserId: contact.registeredUserId
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Contact already exists' });
    }
    console.error('Add contact error:', err);
    res.status(500).json({ error: 'Failed to add contact' });
  }
};

// Get user's contacts that are registered on the app
const getContacts = async (req, res) => {
  const userId = req.userId;
  const { all } = req.query; // ?all=true to include non-registered contacts

  try {
    // Re-match contacts with registered users (in case new users signed up)
    const contacts = await Contact.find({ userId });

    const results = [];

    for (const contact of contacts) {
      // Re-check registration status
      if (!contact.isRegistered || !contact.registeredUserId) {
        const registeredUser = await User.findOne({
          phoneNumber: contact.phoneNumber,
          countryCode: contact.countryCode
        });

        if (registeredUser) {
          contact.isRegistered = true;
          contact.registeredUserId = registeredUser._id;
          await contact.save();
        }
      }

      if (all === 'true' || contact.isRegistered) {
        // Don't include self
        if (contact.registeredUserId && contact.registeredUserId.toString() === userId) {
          continue;
        }

        results.push({
          _id: contact._id,
          phoneNumber: contact.phoneNumber,
          countryCode: contact.countryCode,
          name: contact.name,
          isRegistered: contact.isRegistered,
          registeredUserId: contact.registeredUserId
        });
      }
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

// Delete a contact
const deleteContact = async (req, res) => {
  const userId = req.userId;
  const { contactId } = req.params;

  try {
    await Contact.deleteOne({ _id: contactId, userId });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
};

// Invite contact (placeholder — returns a share link)
const inviteContact = async (req, res) => {
  const { phoneNumber } = req.body;
  res.status(200).json({
    success: true,
    message: `Invitation sent to ${phoneNumber}`,
    shareLink: `${req.protocol}://${req.get('host')}`
  });
};

module.exports = { syncContacts, addContact, getContacts, deleteContact, inviteContact };
