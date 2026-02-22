# CryptChat: Secure Messaging & File Sharing System
## Final Project Report - Team 05 (CSC-DS)

---

### 1. Team Information
**Team Name:** Team 05 CSC-DS
**Project Title:** CryptChat

| Roll Number | Name | Role |
| :--- | :--- | :--- |
| **23B21A4655** | **Repaka Somasekhara Venkata Durga S Prakash** | **Team Lead & Lead Developer** |
| 23B21A4684 | Kadali Satya Sruthi | Documentation Specialist |
| 24B25A4606 | Jalligampala Venkataraju | Backend & Database Developer |
| 23B21A4618 | Lithikasraya C | UI/UX Designer |
| 23B21A4634 | Gandham Leela Venkata Satyanarayana | Security Researcher |

---

### 2. Abstract
CryptChat is a high-security, real-time messaging platform designed to provide an alternative to mainstream messaging apps with a focus on absolute privacy. By implementing **Zero-Knowledge Architecture**, the system ensures that user data is encrypted client-side before ever reaching the server. The project leverages modern web technologies (MERN Stack) and advanced cryptographic standards (WebCrypto API) to deliver a seamless, secure, and cross-platform experience.

---

### 3. Problem Statement
In the digital age, privacy is often compromised for convenience. Most messaging platforms have access to user metadata or, in some cases, the content of the messages themselves. CryptChat addresses the following issues:
- **Data Breaches:** Leakage of sensitive chat history from central servers.
- **Privacy Intrusion:** Platforms reading user messages for targeted advertising.
- **Lack of Forward Secrecy:** Stolen keys compromising past communications.

---

### 4. System Architecture
The application is built using the **MERN Stack** (MongoDB, Express.js, React, Node.js) with **Socket.io** for real-time bidirectional communication.

#### **Backend (Node.js & Express)**
- Handles user authentication (JWT-based).
- Manages Socket.io namespaces for real-time messaging.
- Acts as a relay for encrypted payloads (Zero-Knowledge).
- **Database (MongoDB):** Stores user profiles, public keys, and encrypted message blobs.

#### **Frontend (React)**
- Responsively designed UI with a focus on modern aesthetics.
- Performs all cryptographic operations in the browser (client-side).
- Implemented as a **Progressive Web App (PWA)** for native-like performance on mobile and desktop.

---

### 5. Features
- **End-to-End Encryption (E2EE):** All messages and files are encrypted using RSA/AES before transmission.
- **Perfect Forward Secrecy (PFS):** Utilizes ECDH handshakes to generate session-specific keys.
- **Real-Time Communication:** Instant delivery using Socket.io.
- **Voice Messaging:** Securely record and send voice notes.
- **File Sharing:** AES-GCM encrypted file transfers.
- **Multi-Factor Authentication (MFA):** Extra layer of security for user accounts.
- **Admin Dashboard:** Real-time monitoring of system traffic and user activity audit logs.
- **Secure Rooms:** Encrypted group chats with derived room keys.
- **Link Previews:** Securely fetches and displays metadata for shared URLs.

---

### 6. Security Protocol (Technical Details)
CryptChat uses a 4-layered security approach:
1. **Identity Layer:** RSA-2048 keys are generated on signup. The Private Key is stored ONLY in the user's browser.
2. **Message Layer:** Hybrid encryption where message content is AES-256 encrypted, and the AES key is RSA-wrapped for the recipient.
3. **File Layer:** Files are encrypted with AES-GCM (Galois/Counter Mode) for authenticated encryption.
4. **Resilience Layer:** P-256 Elliptic Curve Diffie-Hellman (ECDH) ensures that even if a future key is compromised, past messages remain secure.

---

### 7. Hyper-Advancements (New)
To provide a superior user experience and demonstrate technical depth, the following high-end features were implemented:
- **Live Crypto-HUD:** A terminal-style Heads-Up Display in the chat UI that logs every cryptographic step (e.g., "RSA Wrapping," "AES Key Derivation") in real-time, providing transparency to the user.
- **Cyber-Security Terminal UI:** The Admin Dashboard was overhauled with a "Network Interceptor" aesthetic, featuring CRT scanline effects, neon glow themes, and live traffic pulsing.
- **Quantum-Ready Preparation:** The internal architecture is modularized to support Post-Quantum Cryptography (PQC) algorithms like Dilithium and Kyber in future patches.

### 8. Implementation Challenges
- **Key Management:** Ensuring the Private Key persists in local storage without being vulnerable to XSS.
- **Speed vs. Security:** Balancing the overhead of client-side encryption with real-time performance.
- **Cross-Device Sync:** Solving the challenge of message decryption when private keys are device-tied.

---

### 8. Conclusion
The CryptChat project successfully demonstrates that high-level security does not have to come at the cost of usability. By combining the MERN stack with native browser cryptographic APIs, the team has built a resilient platform that guarantees user privacy by design.

---

### 9. Future Scope
- **Post-Quantum Cryptography:** Integrating Lattice-based algorithms (e.g., Kyber).
- **Video Calling:** peer-to-peer encrypted video streams using WebRTC.
- **Decentralized Storage:** Moving from centralized MongoDB to IPFS for message persistence.
