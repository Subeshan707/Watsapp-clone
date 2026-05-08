// Test the add contact API against the deployed Render backend
const BACKEND_URL = 'https://watsapp-clone-v7li.onrender.com';
const USER_ID = '69f4e02b35ea080be1605116'; // Subeshan's ID

async function testAddContact() {
  console.log('Testing add contact API...');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log('---');

  try {
    const res = await fetch(`${BACKEND_URL}/api/contacts/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_ID,
      },
      body: JSON.stringify({
        phoneNumber: '6379568221',
        countryCode: '+91',
        name: 'Test Priyan',
      }),
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testAddContact();
