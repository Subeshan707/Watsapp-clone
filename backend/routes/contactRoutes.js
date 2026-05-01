const express = require('express');
const { syncContacts, addContact, getContacts, deleteContact, inviteContact } = require('../controllers/contactController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post('/sync', syncContacts);       // Bulk sync from phone
router.post('/add', addContact);          // Add single contact
router.get('/', getContacts);             // Get contacts (registered on app)
router.delete('/:contactId', deleteContact);
router.post('/invite', inviteContact);    // Invite non-registered contact

module.exports = router;
