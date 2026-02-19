// Dynamic API base — detects whether running on localhost or a network IP
// This ensures all API calls go to the SAME machine running the backend,
// regardless of how the frontend is accessed.

const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// Backend is always on port 5000 of the same host
export const API_BASE = `http://${hostname}:5000/api`;
export const SOCKET_URL = `http://${hostname}:5000`;
