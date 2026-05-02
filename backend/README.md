# Folio-Messenger Backend ⚙️

The backend of Folio-Messenger is a robust, scalable API built with NestJS. It handles real-time signaling, secure authentication, and complex chat orchestrations with a focus on performance and clean architecture.

## 🚀 Key Features

- **🧱 Modular Architecture**: Cleanly separated modules for Auth, Chat, Database, and Cloudinary.
- **🔐 Secure Authentication**: JWT-based auth with refresh token rotation and secure bcrypt password hashing.
- **📡 Real-time Gateways**: Socket.io integration for instant messaging, typing indicators, and presence tracking.
- **📂 Media Management**: Automated file and image uploads to Cloudinary with metadata persistence.
- **🧪 Comprehensive Testing**: Robust unit testing suite for all core service layers (`Messaging`, `Auth`, `Block`, `Room`).
- **🗃️ Optimized Queries**: High-performance database operations using Prisma with optimized relation fetching.

## 🛠️ Technical Stack

- **NestJS**: Enterprise-grade Node.js framework (TypeScript).
- **Prisma**: Type-safe ORM for database operations.
- **MySQL (TiDB)**: Scalable relational database.
- **Socket.io**: Real-time bidirectional communication.
- **Cloudinary**: Cloud-based media management.
- **Jest**: Unit and integration testing.

## 📁 Modular Structure

The backend is organized into specialized services for maximum maintainability:
- **Chat Module**:
  - `MessagingService`: Core message operations and socket signaling.
  - `BlockService`: User blocking and permission logic.
  - `RoomService`: Chat room lifecycle and participant management.
- **Auth Module**:
  - `AuthTokenService`: JWT and refresh token lifecycle.
  - `AuthProfileService`: User profiles, credentials, and E2EE key synchronization.

## ⚙️ Setup & Development

### Environment Variables
Create a `.env` file in the root of the `backend` directory:
```env
DATABASE_URL="mysql://user:pass@host:port/db"
JWT_SECRET="your_jwt_secret"
REFRESH_TOKEN_SECRET="your_refresh_token_secret"
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"
```

### Commands
- `npm run start:dev`: Starts the development server with hot-reload.
- `npm run test`: Runs the full unit testing suite.
- `npx prisma generate`: Generates the Prisma client based on the schema.
- `npx prisma studio`: Visual interface to manage your database data.

## 📄 Documentation
All services are documented using professional JSDoc comments. Refer to the source code for detailed API and method descriptions.
## 📄 License
Distributed under the MIT License.
