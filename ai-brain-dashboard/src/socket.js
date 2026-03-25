```
import { io } from 'socket.io-client';

// J7282: URL de producción corregida a Railway
const BACKEND_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : 'https://zestful-alignment-production-c71f.up.railway.app';

export const socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

export default socket;
