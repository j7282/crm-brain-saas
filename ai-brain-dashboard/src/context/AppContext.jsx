// J7282: Context API Global - Creado por auditoría de Claude para optimizar estado
import { createContext, useContext, useState, useEffect } from 'react';
import socket from '../socket';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Estado de autenticación
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('darwin_token'));

  // Estado de WhatsApp
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waQR, setWaQR] = useState(null);

  // Estado de chats y mensajes
  const [chats, setChats] = useState([]);
  const [selectedChatJid, setSelectedChatJid] = useState(null);
  const [messages, setMessages] = useState([]);

  // Estado del cerebro AI
  const [activeBrainId, setActiveBrainId] = useState(localStorage.getItem('activeBrainId'));
  const [brainName, setBrainName] = useState(localStorage.getItem('activeBrainName') || '');

  // Estado de la UI
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'inbox');
  const [isOnboarding, setIsOnboarding] = useState(localStorage.getItem('isOnboarding') !== 'false');

  // Persistir estado en localStorage
  useEffect(() => {
    localStorage.setItem('isOnboarding', isOnboarding);
    localStorage.setItem('activeTab', activeTab);
    if (activeBrainId) localStorage.setItem('activeBrainId', activeBrainId);
    if (brainName) localStorage.setItem('activeBrainName', brainName);
    if (token) localStorage.setItem('darwin_token', token);
  }, [isOnboarding, activeTab, activeBrainId, brainName, token]);

  // Socket.io listeners
  useEffect(() => {
    if (!token || !user) return;

    socket.emit('join', user.id || user.userId);

    const handleQR = (data) => setWaQR(data.qr);
    const handleStatus = (data) => {
      setWaStatus(data.connected ? 'connected' : 'disconnected');
      if (data.connected) setWaQR(null);
    };

    socket.on('qr', handleQR);
    socket.on('wa-status', handleStatus);
    socket.on('new-message', (msg) => {
      if (selectedChatJid === msg.jid) {
        setMessages(prev => [...prev, msg]);
      }
    });
    socket.on('chat-update', (update) => {
      setChats(prev => prev.map(c => c.jid === update.jid ? { ...c, ...update } : c));
    });

    return () => {
      socket.off('qr', handleQR);
      socket.off('wa-status', handleStatus);
      socket.off('new-message');
      socket.off('chat-update');
    };
  }, [token, user, selectedChatJid]);

  // Funciones de autenticación
  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('darwin_token', newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('darwin_token');
  };

  const value = {
    // Estado
    user,
    setUser,
    token,
    setToken,
    waStatus,
    setWaStatus,
    waQR,
    setWaQR,
    chats,
    setChats,
    selectedChatJid,
    setSelectedChatJid,
    messages,
    setMessages,
    activeBrainId,
    setActiveBrainId,
    brainName,
    setBrainName,
    activeTab,
    setActiveTab,
    isOnboarding,
    setIsOnboarding,
    // Funciones
    login,
    logout
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return context;
};
