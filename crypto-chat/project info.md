# Crypt Chat: Full Project Documentation

Crypt Chat is a high-security, real-time messaging platform designed with **End-to-End Encryption (E2EE)** and **Perfect Forward Secrecy (PFS)**. This document provides a step-by-step breakdown of the entire application architecture, security protocols, and operational workflows.

---

## 🏗️ 1. System Architecture

The application follows a modern MERN-like stack (MongoDB, Express, React, Node) with Socket.io for real-time capabilities.

### Backend Structure
- **`server.js`**: entry point, configures Express, connects to MongoDB, and initializes Socket.io.
- **`models/`**:
  - `User.js`: Stores profile data, hashed passwords (Bcrypt), and RSA Public Keys.
  - `Message.js`: Stores encrypted message payloads and metadata.
  - `ActivityLog.js`: Tracks system-wide events for admin auditing.
- **`routes/`**:
  - `auth.js`: Handles signup/login and session management.
  - `messages.js`: Processes sending/fetching messages and file metadata.
  - `users.js`: Public key retrieval and user search.
  - `admin.js`: Moderation tools (ban, delete, session revocation).
- **`middleware/`**:
  - `auth.js`: JWT verification.
  - `rateLimiter.js`: Protects against brute-force and spam.

### Frontend Structure
- **`App.js`**: Main router and global auth state management.
- **`Auth.js`**: Registration and Login flows, including local key generation.
- **`Chat.js`**: The core messaging interface with logic for encryption/decryption, Socket.io events, and file handling.
- **`utils/crypto.js`**: The cryptographic engine (WebCrypto API).
- **`AdminDashboard.js`**: Real-time traffic audit and moderation panel.

---

## 🔐 2. Security Protocol (Step-by-Step)

The cornerstone of Crypt Chat is its multi-layered encryption strategy.

### Layer 1: Identity (RSA-2048)
1. **Key Generation**: Upon signup, the client generates an **RSA-OAEP 2048-bit** key pair.
2. **Key Storage**: 
   - Public Key: Sent to the server and stored in the database.
   - Private Key: Stored locally in the user's browser (`localStorage`). **The server never sees the private key.**

### Layer 2: Message Exchange (Hybrid Encryption)
1. **Session Key**: When a user sends a message, the app generates a random **AES-256** key (Session Key).
2. **Encryption**:
   - The message text is encrypted with the **Session Key** using **AES-CBC**.
   - The **Session Key** itself is encrypted with the recipient's **RSA Public Key**.
3. **Payload**: The server receives a bundle containing:
   - `encryptedMessage` (AES-encrypted text)
   - `encryptedKey` (RSA-encrypted session key)

### Layer 3: File Sharing (AES-GCM)
Files are encrypted separately using **AES-GCM (Galois/Counter Mode)**, which provides authenticated encryption, ensuring the file hasn't been modified in transit.

### Layer 4: Forward Secrecy (ECDH)
For advanced security, the app implements **P-256 Elliptic Curve Diffie-Hellman (ECDH)** handshakes to derive temporary shared secrets that change per session.

---

## 🔄 3. Operational Workflows

### 📥 User Onboarding
1. User enters profile details.
2. **Client side**: Generates RSA keys. Saves private key locally.
3. **API call**: Sends public key + user data to `/api/auth/signup`.
4. **Server side**: Creates user, logs activity, and returns a JWT.

### 💬 Direct Messaging
1. **User A** selects **User B**.
2. **Client A** fetches **User B's** public key from `/api/users/username/key`.
3. **Client A** encrypts message and session key.
4. **Socket.io**: Server receives payload and pushes it to **User B's** active socket.
5. **Client B**: Receives payload, pulls private key from storage, decrypts session key, and then decrypts the message.

### 🏠 Room Chat
1. **Creation**: User creates a Room ID.
2. **Key Derivation**: All users in the room derive a symmetric key using `SHA-256(RoomID)`.
3. **Encrypted Sync**: Messages are broadcast to the room socket, and members decrypt them using the derived key.

### 🛡️ Admin Moderation
1. Admin logs in (protected by `isAdmin` flag in the DB).
2. **Live Audit**: The admin can see the "Network Interceptor," which shows live traffic (metadata only, no decrypted content).
3. **Moderation**: Admin can ban users, delete accounts, or revoke specific device sessions.

---

## 🛠️ 4. Technical Specs Recap
- **Real-time**: Socket.io (custom namespaces and rooms).
- **Backend API**: RESTful Express.
- **Database**: MongoDB (Mongoose).
- **Client**: React (Hooks, Context-like props).
- **Security Standards**: WebCrypto API, CryptoJS, JWT, Bcrypt.

> [!IMPORTANT]
> **Privacy Note**: Because the private keys are stored exclusively in the browser, if a user clears their cache or loses their device without a backup, they will lose access to their past encrypted messages. This is the hallmark of true zero-knowledge privacy.
