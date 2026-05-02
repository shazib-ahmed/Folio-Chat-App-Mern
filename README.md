# Folio-Messenger 🚀

Folio-Messenger is a high-performance, premium real-time chat application built with the MERN stack (MySQL, Express, React, Node.js). It features **End-to-End Encryption (E2EE)**, real-time Audio/Video calls, and a sleek, modern UI designed for the best user experience.

## ✨ Features

- **🛡️ End-to-End Encryption (E2EE)**: All messages and files are encrypted on the sender's device and decrypted only on the receiver's device using industry-standard RSA and AES algorithms.
- **📞 Audio & Video Calls**: High-quality P2P communication using WebRTC and Socket.io signaling.
- **⚡ Real-time Messaging**: Instant message delivery with Socket.io.
- **📁 Media Sharing**: Send images, videos, audio, and documents securely.
- **🎙️ Voice Messages**: Record and send voice notes with an interactive waveform.
- **🔒 User Privacy**: Block/unblock users and manage message requests.
- **🌗 Dark Mode**: Premium dark-themed UI with smooth animations and glassmorphism effects.
- **🔍 Global Search**: Search for users and messages across the entire application.
- **✅ Message Status**: Real-time 'Seen/Unseen' status and 'Typing' indicators.
- **✏️ Message Management**: Edit or delete messages within a 15-second grace period.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18
- **State Management**: Redux Toolkit (RTK)
- **Styling**: Tailwind CSS & Vanilla CSS
- **Icons**: FontAwesome & Lucide React
- **Real-time**: Socket.io-client
- **Security**: Web Crypto API (SubtleCrypto)
- **Communication**: WebRTC

### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: MySQL (TiDB)
- **ORM**: Prisma
- **Authentication**: JWT with Refresh Token rotation
- **File Storage**: Cloudinary
- **Documentation**: JSDoc professional comments

## 📂 Project Structure

```text
Folio-Chat-App-Mern/
├── frontend/                # React Application
│   ├── src/
│   │   ├── app/             # Global Store & Main App component
│   │   ├── features/        # Modular feature-based structure (Chat, Auth, Settings)
│   │   ├── shared/          # Reusable components, hooks, and utilities
│   │   └── routes/          # Protected and Public route management
│   └── public/              # Static assets
├── backend/                 # NestJS Application
│   ├── src/
│   │   ├── modules/         # Modular services (Chat, Auth, Cloudinary)
│   │   ├── database/        # Prisma service and Database module
│   │   └── common/          # Global middlewares and guards
│   ├── prisma/              # Database schema and migrations
│   └── test/                # Unit and E2E tests
└── screenshots/             # UI Previews
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL or TiDB
- Cloudinary Account

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shazib-ahmed/Folio-Chat-App-Mern.git
   cd Folio-Chat-App-Mern
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   # Create .env file with DATABASE_URL, JWT_SECRET, CLOUDINARY_URL
   npx prisma generate
   npm run start:dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   # Create .env file with REACT_APP_API_URL and REACT_APP_SOCKET_URL
   npm start
   ```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ by [Shazib Ahmed](https://github.com/shazib-ahmed)
