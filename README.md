# Orbit

A full-stack, real-time chat application inspired by modern messaging platforms. Built with React, Node.js, Socket.IO, and MongoDB.

**[🌐 View Live Deployment (Orbit)](https://watsapp-clone-omega.vercel.app/)**

![Orbit](https://img.shields.io/badge/Status-Live-00a884?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)

---

## 🚀 Features

Orbit is a fully-featured communication platform supporting real-time chat, media sharing, and high-quality calls.

- **OTP Authentication**: Phone number verification using Twilio SMS.
- **Real-Time Messaging**: Instant text delivery powered by Socket.IO WebSockets.
- **Audio & Video Calling**: Peer-to-peer secure calling using WebRTC with native ringing tones.
- **Media Attachments**: Support for sending images, videos, audio, and documents (up to 25MB).
- **Voice Messaging**: Built-in audio recorder to record and send voice notes.
- **Emoji Picker**: Native dark-mode emoji picker integrated into the chat bar.
- **AI ChatBot Integration**: Integrated intelligent AI assistant powered by Groq (LLaMA 3).
- **Message Management**: Edit sent messages and delete messages ("Delete for me").
- **Contact Management**: Add contacts by phone number and sync with the database.
- **Read Receipts**: Real-time message status (Sent, Delivered, Read with blue ticks).
- **User Profiles**: Custom "About" status and auto-generated colorful avatars.
- **Context Menus**: Right-click context menus for quick actions on messages and contacts.
- **Responsive Layout**: Fluid UI optimized for desktop and mobile web experiences.

---

## 🛠 Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend  | Node.js, Express.js                 |
| Database | MongoDB (Atlas)                     |
| Realtime | Socket.IO, WebRTC                   |
| AI Auth  | Twilio API, Groq LLaMA 3            |

---

## 📂 Project Structure

```
orbit/
├── backend/
│   ├── config/              # MongoDB connection
│   ├── controllers/         # Messaging, Users, AI, Contacts
│   ├── models/              # Mongoose Schemas (User, Message, Contact)
│   ├── routes/              # Express API Routes
│   ├── socket/              # Socket.IO & WebRTC signaling events
│   ├── server.js            # Express + Socket.IO entry point
│   └── .env                 # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Components (ChatWindow, Sidebar, Login, etc.)
│   │   ├── lib/             # API helpers, Sounds, Socket, WebRTC
│   │   ├── App.tsx          # Main Application Core
│   │   └── index.css        # Tailwind Global Styles
│   ├── .env                 # Frontend environment variables
│   └── vite.config.ts
│
└── README.md
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
GROQ_API_KEY=your_groq_api_key
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

*For production deployment on Vercel, replace `localhost:5000` with your deployed backend URL.*

---

## 💻 Setup & Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/Subeshan707/Watsapp-clone.git
cd Watsapp-clone
```

### 2. Setup Backend

```bash
cd backend
npm install
npm run dev
```

The server will start on `http://localhost:5000`.

### 3. Setup Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`.

### 4. Test the App

1. Open `http://localhost:5173` and authenticate using a valid phone number.
2. Open an incognito window and authenticate with a second phone number.
3. Add the other user as a contact.
4. Experience real-time chat, WebRTC calling, AI chatbot features, and file sharing!

---

## 📡 Socket.IO & WebRTC Architecture

- **Messaging**: Users join a private Socket room (`user:{userId}`). Messages and read receipts are emitted directly to these rooms.
- **Calling**: WebRTC connection relies on Socket.IO for signaling. The app emits `webrtcOffer`, `webrtcAnswer`, and `webrtcIceCandidate` to establish the direct P2P media stream.
- **Attachments**: Processed as Base64 DataURLs. The backend `maxHttpBufferSize` is heavily expanded (25MB) to comfortably stream media.

---

## 📝 License

This project is for educational and portfolio purposes.
