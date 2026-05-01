const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  // The user who owns this contact entry
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Phone number of the contact (stored without spaces)
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  // Country code
  countryCode: {
    type: String,
    default: '+91',
    trim: true
  },
  // Name as saved by the user (like phone contact name)
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Whether this contact is registered on the app
  isRegistered: {
    type: Boolean,
    default: false
  },
  // Reference to the matched registered user (if any)
  registeredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Each user can only save a phone number once
ContactSchema.index({ userId: 1, phoneNumber: 1, countryCode: 1 }, { unique: true });

module.exports = mongoose.model('Contact', ContactSchema);
