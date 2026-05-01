# WhatsApp Web Clone

A full-stack real-time chat application inspired by WhatsApp Web, built with React, Node.js, Socket.IO, and MongoDB.

![WhatsApp Clone](https://img.shields.io/badge/Status-Complete-00a884?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

---

## Features

- **User Authentication** — Simple username-based login with auto-registration
- **Real-Time Messaging** — Instant message delivery via Socket.IO WebSockets
- **Two-Panel Layout** — WhatsApp Web-inspired UI with sidebar chat list and chat window
- **Message Persistence** — All messages stored in MongoDB and persist after page refresh
- **Search** — Filter users in the sidebar
- **Responsive Design** — Works on desktop screens
- **Visual Message Distinction** — Sent (green) vs received (dark) message bubbles
- **Read Receipts UI** — Blue double-check marks on sent messages
- **Auto-scroll** — Chat automatically scrolls to the latest message
- **Date Separators** — Messages grouped by date with labels (Today, Yesterday, etc.)
- **User Avatars** — Colorful auto-generated avatar initials

---

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend  | Node.js, Express.js                 |
| Database | MongoDB (Atlas)                     |
| Realtime | Socket.IO                           |

---

## Project Structure

```
watsapp/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── controllers/
│   │   ├── messageController.js   # Message CRUD + emit logic
│   │   └── userController.js      # User auth/fetch logic
│   ├── middleware/
│   │   └── auth.js            # Simple x-user-id auth middleware
│   ├── models/
│   │   ├── Message.js         # Mongoose Message schema
│   │   └── User.js            # Mongoose User schema
│   ├── routes/
│   │   ├── messageRoutes.js   # POST/GET message endpoints
│   │   └── userRoutes.js      # POST authenticate, GET users
│   ├── socket/
│   │   └── socketHandler.js   # Socket.IO event handlers
│   ├── utils/
│   │   └── helpers.js         # Utility functions
│   ├── .env                   # Environment variables
│   ├── package.json
│   └── server.js              # Express + Socket.IO entry point
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx     # Chat area with messages
│   │   │   ├── LoginScreen.tsx    # Login/register screen
│   │   │   └── Sidebar.tsx        # User list sidebar
│   │   ├── lib/
│   │   │   ├── api.ts         # REST API functions
│   │   │   └── socket.ts      # Socket.IO client setup
│   │   ├── App.tsx            # Main application component
│   │   ├── config.ts          # Environment config
│   │   ├── index.css          # Global styles
│   │   ├── main.tsx           # React entry point
│   │   └── types.ts           # TypeScript types
│   ├── .env                   # Frontend environment variables
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── README.md
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **MongoDB** — A MongoDB Atlas cluster (or local MongoDB instance)

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Production Deployment

When you deploy the frontend to Vercel, set these environment variables in the Vercel project settings to the URL of your deployed backend:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_SOCKET_URL=https://your-backend-domain.com
```

If these are missing in production, the app will now fail fast with a configuration error instead of sending API requests to the Vercel site itself.

---

## Setup & Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/watsapp.git
cd watsapp
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file (or edit the existing one) with your MongoDB URI:

```env
PORT=5000
MONGO_URI=mongodb+srv://your_user:your_password@cluster0.xxxxx.mongodb.net/whatsapp_clone
```

Start the backend:

```bash
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

1. Open `http://localhost:5173` in **Browser 1** → Sign in as `alice`
2. Open `http://localhost:5173` in **Browser 2** (or incognito) → Sign in as `bob`
3. Click on the other user in the sidebar to start chatting
4. Messages appear in real-time on both browsers!

---

## API Endpoints

| Method | Endpoint                      | Description               | Auth Header    |
| ------ | ----------------------------- | ------------------------- | -------------- |
| POST   | `/api/users/authenticate`     | Login or register a user  | None           |
| GET    | `/api/users`                  | Get all users (except self) | `x-user-id`  |
| POST   | `/api/messages`               | Send a message            | `x-user-id`   |
| GET    | `/api/messages/:otherUserId`  | Get message history       | `x-user-id`   |

### Authentication

This app uses a simple header-based auth system. After login, the user's `_id` is sent as the `x-user-id` header on every API request.

---

## Socket.IO Events

| Event            | Direction       | Description                    |
| ---------------- | --------------- | ------------------------------ |
| `connection`     | Client → Server | Joins user to their room       |
| `sendMessage`    | Client → Server | Send a new message             |
| `receiveMessage` | Server → Client | Receive a new message in real-time |
| `disconnect`     | Client → Server | User disconnects               |

---

## Database Schema

### User

```json
{
  "_id": "ObjectId",
  "username": "string (unique, required)",
  "createdAt": "Date"
}
```

### Message

```json
{
  "_id": "ObjectId",
  "sender": "ObjectId (ref: User)",
  "receiver": "ObjectId (ref: User)",
  "content": "string (required)",
  "timestamp": "Date"
}
```

---

## License

This project is for educational purposes.
