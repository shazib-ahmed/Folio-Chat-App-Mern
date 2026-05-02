# Folio-Messenger Frontend 🎨

The frontend of Folio-Messenger is a modern, responsive React application designed for high-performance real-time communication. It leverages advanced browser APIs for encryption and P2P communication.

## 🚀 Key Features

- **🔒 End-to-End Encryption**: Implemented using the Web Crypto API (SubtleCrypto). Keys are generated locally and never leave the device in unencrypted form.
- **📞 WebRTC Integration**: Seamless audio and video calling directly in the browser.
- **📱 Responsive Design**: Fully responsive UI built with Tailwind CSS, supporting mobile and desktop views.
- **🌓 Dark Mode**: Sophisticated dark theme with premium aesthetics and glassmorphism components.
- **⚡ Redux State Management**: Centralized state for chats, messages, and authentication using Redux Toolkit.
- **🔔 Real-time Notifications**: Custom audio alerts and UI indicators for incoming messages.

## 🛠️ Technical Stack

- **React 18**: Core UI library.
- **Redux Toolkit**: Global state management and async thunks.
- **Tailwind CSS**: Utility-first styling with custom animation extensions.
- **Socket.io-client**: Real-time websocket communication.
- **React Router 6**: Client-side routing with protected route guards.
- **FontAwesome**: High-quality vector icons.

## 📁 Architecture

The project follows a modular, feature-based architecture:
- `src/features/`: Contains domain-specific logic, components, and slices (Chat, Auth, Settings).
- `src/shared/`: Reusable UI components (`src/shared/ui`), hooks (`src/shared/hooks`), and global utilities (`src/shared/lib`).
- `src/app/`: Core application setup including the Redux store.

## ⚙️ Setup & Development

### Environment Variables
Create a `.env` file in the root of the `frontend` directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
APP_ENCRYPTION_KEY=your_secret_encryption_key
```

### Commands
- `npm start`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm test`: Launches the test runner.

## 🤝 Contributing
Please ensure all components follow the shared UI patterns and use the established Tailwind design tokens.
## 📄 License
Distributed under the MIT License.
