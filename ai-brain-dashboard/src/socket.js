import { io } from 'socket.io-client';

const BACKEND_URL = 'https://zestful-alignment-production-c71f.up.railway.app';

export const socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

export default socket;
