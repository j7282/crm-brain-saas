import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import socket from './socket'
import './App.css'

const BACKEND_URL = 'https://zestful-alignment-production-c71f.up.railway.app';
import {
  BrainCircuit,
  MessageSquareText,
  Settings,
  LineChart,
  ChevronDown,
  Mic,
  Cpu,
  ShieldAlert,
  Bot,
  Plus,
  Smile,
  Send,
  Zap
} from 'lucide-react'

// socket is now imported from ./socket.js

// --- Professional Memoized Sub-components J7282 ---

const ChatListItem = memo(({ chat, isActive, onClick }) => {
  return (
    <div 
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={() => onClick(chat.jid)}
    >
      <div className="avatar" style={{ background: chat.sentiment === 'verde' ? '#dcf8c6' : (chat.sentiment === 'rojo' ? '#ffebee' : '#f0f2f5') }}>
        {chat.pushName?.substring(0, 1).toUpperCase() || 'W'}
      </div>
      <div className="chat-info">
        <div className="chat-header">
          <span className="contact-name" style={{ fontWeight: 600, color: '#111b21', fontSize: '1.05rem' }}>
            {chat.pushName || chat.jid.split('@')[0]}
          </span>
          <span className="time" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            {new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="chat-preview-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, overflow: 'hidden' }}>
            {chat.role === 'ai' && <span style={{ color: '#53bdeb' }}>✓✓</span>}
            <p className="last-message" style={{ margin: 0, fontSize: '0.85rem', color: '#667781' }}>
              {chat.lastMessage || 'Sin mensajes'}
            </p>
          </div>
          <span className={`sentiment-badge bg-${chat.sentiment || 'yellow'}`} title={`Sentimiento: ${chat.sentiment}`}></span>
        </div>
      </div>
    </div>
  );
});

const MessageBubble = memo(({ msg, isLast }) => {
  return (
    <div className={`message-wrapper ${msg.role === 'ai' || msg.role === 'agent' ? 'ai' : 'user'}`}>
      <div className={`message-bubble ${msg.role === 'ai' || msg.role === 'agent' ? 'ai' : 'user'}`}>
        <div className="message-content">
          {msg.type === 'audio' && msg.mediaUrl && (
            <audio src={`${BACKEND_URL}${msg.mediaUrl}`} controls style={{ width: '100%', height: '35px', marginBottom: '8px' }} />
          )}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{msg.text}</div>
          <div className="message-meta">
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
            </span>
            {(msg.role === 'ai' || msg.role === 'agent') && (
              <span className="message-status" style={{ color: '#53bdeb' }}>✓✓</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatInput = memo(({ onSendMessage }) => {
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <div className="input-area">
      <div className="input-main" style={{ display: 'flex', alignItems: 'center', padding: '10px 15px' }}>
        <div className="chat-input-wrapper" style={{ flex: 1, margin: '0 10px' }}>
          <textarea
            className="chat-input"
            placeholder="Escribe un mensaje aquí..."
            rows="1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <div className="action-btn send" onClick={handleSend}>
          <Send size={20} />
        </div>
      </div>
    </div>
  );
});

function App() {
  const [isOnboarding, setIsOnboarding] = useState(localStorage.getItem('isOnboarding') !== 'false');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [brainName, setBrainName] = useState(localStorage.getItem('activeBrainName') || '');
  const [waQR, setWaQR] = useState(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'inbox');

  // Real Data State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSentiment, setCurrentSentiment] = useState('red');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('darwin_token'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isInterventionMode, setIsInterventionMode] = useState(false);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [activeBrainId, setActiveBrainId] = useState(localStorage.getItem('activeBrainId'));
  const [lastQuery, setLastQuery] = useState('');
  const [historyMonths, setHistoryMonths] = useState('3 Meses');
  const [mirrorMode, setMirrorMode] = useState(true);
  const [inboxFilterStatus, setInboxFilterStatus] = useState('Por resolver'); // 'Por resolver', 'Resueltos', 'Todos'
  const [inboxFilterAssignee, setInboxFilterAssignee] = useState('all'); // 'all', 'me', 'ai'
  const [personalityWhatsApp, setPersonalityWhatsApp] = useState(true);
  const [personalityAggressiveness, setPersonalityAggressiveness] = useState(5);
  const [personalityForbidLinks, setPersonalityForbidLinks] = useState(false);
  const [personalityUseVoice, setPersonalityUseVoice] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [chats, setChats] = useState([]);
  const [chatRenderLimit, setChatRenderLimit] = useState(40); // Elite 40 J7282
  const [totalChats, setTotalChats] = useState(0);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [selectedChatJid, setSelectedChatJid] = useState(null);
  const [realMessages, setRealMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [neuronalLogs, setNeuronalLogs] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    localStorage.setItem('isOnboarding', isOnboarding);
    localStorage.setItem('activeTab', activeTab);
    if (activeBrainId) localStorage.setItem('activeBrainId', activeBrainId);
    if (brainName) localStorage.setItem('activeBrainName', brainName);
  }, [isOnboarding, activeTab, activeBrainId, brainName]);

  // Persistent Auth & WhatsApp Status J7282
  useEffect(() => {
    if (token && !user) {
      fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.userId || data.id) {
          // Normalizar id/userId
          const normalized = { ...data, id: data.id || data.userId };
          setUser(normalized);
        }
      })
      .catch(err => console.error("Error fetching me:", err));
    }
    
    if (token) {
      fetch(`${BACKEND_URL}/api/whatsapp/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setWaStatus(data.connected ? 'connected' : 'disconnected');
      })
      .catch(err => console.error("Error fetching initial status:", err));
    }
  }, [token]);

  // Recuperar cerebros al iniciar para saltar onboarding
  useEffect(() => {
    if (token && isOnboarding) {
      const checkExistingBrains = async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/brains`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const brains = await res.json();
          if (Array.isArray(brains) && brains.length > 0) {
            const lastBrain = brains[brains.length - 1];
            setActiveBrainId(lastBrain._id);
            setBrainName(lastBrain.nombre);
            setIsOnboarding(false);
          }
        } catch (e) { console.error("Error recuperando cerebros:", e); }
      };
      checkExistingBrains();
    }
  }, [token]);

  const shouldScrollToBottomRef = useRef(true);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      scrollToBottom();
    }
  }, [realMessages]);

  // Manejo de Socket.io en tiempo real J7282
  useEffect(() => {
    if (!token || !user) return;

    // Join room del usuario
    socket.emit('join', user.id || user.userId);
    console.log('[Socket] Joined room:', user.id || user.userId);

    const handleQR = (data) => {
      console.log('[Socket] QR Recibido');
      setWaQR(data.qr);
    };

    const handleStatus = (data) => {
      console.log('[Socket] Status:', data);
      setWaStatus(data.connected ? 'connected' : 'disconnected');
      if (data.connected) {
        setWaQR(null);
        if (isOnboarding) {
          setIsOnboarding(false);
          setActiveTab('inbox');
        }
      }
    };

    socket.on('qr', handleQR);
    socket.on('wa-status', handleStatus);

    return () => {
      socket.off('qr', handleQR);
      socket.off('wa-status', handleStatus);
    };
  }, [token, user, isOnboarding]);

  // Polling para Chats - Optimizado a 15s J7282
  useEffect(() => {
    let interval;
    if (token) {
      const fetchChats = async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/whatsapp/chats?limit=40`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) return;
          const data = await res.json();
          // data format: { chats, total } J7282
          if (data && Array.isArray(data.chats)) {
            setChats(prev => {
                // Mapeo por JID para evitar duplicados y preservar chats cargados por scroll J7282
                const newChats = [...data.chats];
                const existingJids = new Set(newChats.map(c => c.jid));
                
                // Agregamos los que ya teníamos pero que NO están en los primeros 50 del server
                prev.forEach(oldChat => {
                  if (!existingJids.has(oldChat.jid)) {
                    newChats.push(oldChat);
                  }
                });
                
                // Ordenar por último timestamp para mantener consistencia
                return newChats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            });
            setTotalChats(data.total);
            if (!selectedChatJid && data.chats.length > 0) {
              setSelectedChatJid(data.chats[0].jid);
            }
            if (data.chats.length > 0 && isOnboarding) {
              setIsOnboarding(false);
              setActiveTab('inbox');
            }
          }
        } catch (err) { }
      };
      fetchChats();
      interval = setInterval(fetchChats, 15000); // 15s es suficiente con Sockets J7282
    }
    return () => clearInterval(interval);
  }, [token, selectedChatJid, isOnboarding]);

  const loadMoreChats = async () => {
    if (isLoadingMoreChats || !hasMoreChats || !token) return;
    setIsLoadingMoreChats(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/chats?limit=40&skip=${chats.length}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && Array.isArray(data.chats)) {
        setChats(prev => [...prev, ...data.chats]);
        setHasMoreChats(chats.length + data.chats.length < data.total);
      }
    } catch (err) {
      console.error("Error loading more chats:", err);
    } finally {
      setIsLoadingMoreChats(false);
    }
  };

  const handleChatListScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Si estamos cerca del fondo del scroll J7282
    if (scrollHeight - scrollTop <= clientHeight + 150) {
      // 1. Si tenemos más chats filtrados en local pero no visibles, aumentamos el límite de renderizado
      if (chatRenderLimit < filteredChats.length) {
        setChatRenderLimit(prev => prev + 25);
      } 
      // 2. Si ya mostramos todo lo local pero hay más en el server, cargamos más
      else if (hasMoreChats && !isLoadingMoreChats) {
        loadMoreChats();
      }
    }
  };

  // Polling para Logs Neuronales
  useEffect(() => {
    let interval;
    if (token && activeTab === 'settings') {
      const fetchLogs = async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/neuronal-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) setNeuronalLogs(data);
        } catch (err) { }
      };
      fetchLogs();
      interval = setInterval(fetchLogs, 4000);
    }
    return () => clearInterval(interval);
  }, [token, activeTab]);

  // Conexión por WebSockets para Tiempo Real
  useEffect(() => {
    socket.on('connect', () => console.log('[Socket] Conectado al backend'));
    
    socket.on('new-message', (newMsg) => {
      console.log('[Socket] Nuevo mensaje:', newMsg);
      if (selectedChatJid === newMsg.jid) {
        setRealMessages(prev => {
          const index = prev.findIndex(m => m._id === newMsg._id && newMsg._id !== undefined);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = newMsg;
            return updated;
          }
          shouldScrollToBottomRef.current = true;
          return [...prev, newMsg];
        });
      }
    });

    socket.on('chat-update', (update) => {
      console.log('[Socket] Actualización de chat:', update);
      setChats(prev => prev.map(c => 
        c.jid === update.jid ? { ...c, ...update } : c
      ));
    });

    socket.on('neuronal-log', (log) => {
      setNeuronalLogs(prev => [log, ...prev].slice(0, 50));
    });

    socket.on('all-chats', (allChats) => {
      console.log('[Socket] Chats iniciales recibidos:', allChats.length);
      setChats(allChats);
    });

    return () => {
      socket.off('new-message');
      socket.off('chat-update');
      socket.off('neuronal-log');
      socket.off('all-chats');
    };
  }, [selectedChatJid]);

  // Carga de Mensajes Paginada J7282
  useEffect(() => {
    if (token && selectedChatJid) {
      const fetchInitialMessages = async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/conversations/${selectedChatJid.split('@')[0]}?limit=40`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) {
            shouldScrollToBottomRef.current = true;
            setRealMessages(data);
            setHasMore(data.length >= 40);
          }
        } catch (err) { }
      };
      fetchInitialMessages();
    }
  }, [token, selectedChatJid]);

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore || !selectedChatJid) return;
    setIsLoadingMore(true);
    shouldScrollToBottomRef.current = false;
    
    try {
      const firstMsgTimestamp = realMessages[0]?.timestamp;
      const res = await fetch(`${BACKEND_URL}/api/conversations/${selectedChatJid.split('@')[0]}?limit=40&before=${firstMsgTimestamp}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setRealMessages(prev => [...data, ...prev]);
        setHasMore(data.length >= 40);
      }
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop < 50 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    if (activeBrainId && token) {
      fetch(`${BACKEND_URL}/api/brains/${activeBrainId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.personalityTraits) {
          setPersonalityWhatsApp(data.personalityTraits.isWhatsAppStyle);
          setPersonalityAggressiveness(data.personalityTraits.aggressivenessLevel);
          setPersonalityForbidLinks(data.personalityTraits.forbidLongLinks);
          setMirrorMode(data.personalityTraits.isMirrorMode || false);
        }
        if (data.name) setBrainName(data.name);
      })
      .catch(err => console.error("Error fetching brain details:", err));
    }
  }, [activeBrainId, token]);

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || !selectedChatJid) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${selectedChatJid.split('@')[0]}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (!res.ok) {
        alert("Error al enviar mensaje real.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }, [token, selectedChatJid]);

  const handleChatClick = useCallback((jid) => {
    setSelectedChatJid(jid);
  }, []);

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      if (inboxFilterStatus === 'Por resolver') {
        return !chat.labels || chat.labels.length === 0 || !chat.labels.includes('Cerrado');
      }
      if (inboxFilterStatus === 'Resueltos') {
        return chat.labels?.includes('Cerrado');
      }
      return true;
    }).filter(chat => {
      if (inboxFilterAssignee === 'me') return chat.assignee === 'me';
      if (inboxFilterAssignee === 'ai') return chat.assignee === 'ai';
      return true;
    });
  }, [chats, inboxFilterStatus, inboxFilterAssignee]);

  // Resetear el límite de renderizado cuando cambian los filtros J7282
  useEffect(() => {
    setChatRenderLimit(40);
  }, [inboxFilterStatus, inboxFilterAssignee]);

  const renderAuth = () => {
    return (
      <div className="google-auth-container">
        <div className="google-auth-card">
          <div className="google-logo">
            <span style={{ color: '#4285F4' }}>G</span>
            <span style={{ color: '#EA4335' }}>o</span>
            <span style={{ color: '#FBBC05' }}>o</span>
            <span style={{ color: '#4285F4' }}>g</span>
            <span style={{ color: '#34A853' }}>l</span>
            <span style={{ color: '#EA4335' }}>e</span>
          </div>
          
          <h1 className="google-title">
            {authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="google-subtitle">
            {authMode === 'login' ? 'Ir a Antigravity Dashboard' : 'Para continuar a Antigravity'}
          </p>

          <div className="google-input-group">
            <input
              type="email"
              className="google-input"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              required
              placeholder=" "
              id="google-email"
            />
            <label className="google-label" htmlFor="google-email">Correo electrónico</label>
          </div>

          <div className="google-input-group">
            <input
              type="password"
              className="google-input"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              required
              placeholder=" "
              id="google-password"
            />
            <label className="google-label" htmlFor="google-password">Contraseña</label>
          </div>

          <p className="google-forgot">
            ¿Olvidaste tu contraseña?
          </p>

          <div className="google-footer-actions">
            <button
              className="google-link-btn"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Crear cuenta' : 'Iniciar sesión en su lugar'}
            </button>
            <button
              className="google-next-btn"
              onClick={async () => {
                const endpoint = authMode === 'login' ? 'login' : 'register';
                try {
                  const res = await fetch(`${BACKEND_URL}/api/auth/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: authEmail, password: authPassword })
                  });
                  const data = await res.json();
                  if (data.token) {
                    setToken(data.token);
                    localStorage.setItem('darwin_token', data.token);
                    setUser(data.user);
                  } else {
                    alert(data.error || "Algo salió mal");
                  }
                } catch (_err) {
                  alert("Error de conexión con el servidor. ¿Está encendido el backend?");
                }
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
        
        <div className="google-auth-footer">
          <div className="google-footer-left">
            <span>Español (España)</span>
            <ChevronDown size={14} />
          </div>
          <div className="google-footer-right">
            <span>Ayuda</span>
            <span>Privacidad</span>
            <span>Términos</span>
          </div>
        </div>
      </div>
    );
  };

  const renderInterventionModal = () => {
    return (
      <div className="onboarding-overlay" style={{ zIndex: 1100 }}>
        <div className="onboarding-card" style={{ maxWidth: '600px', background: 'var(--bg-secondary)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ color: 'var(--text-primary)' }}>🎨 Modificar Sensación Neuronal</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Ajusta la respuesta de la IA antes de enviarla. El cerebro aprenderá de este cambio.
          </p>
          <textarea
            className="input-field"
            style={{ minHeight: '150px', marginBottom: '20px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            value={suggestedResponse}
            onChange={e => setSuggestedResponse(e.target.value)}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="secondary-btn" onClick={() => setIsInterventionMode(false)}>Descartar</button>
            <button className="primary-btn" onClick={async () => {
              // Enviar corrección al backend para entrenamiento
              if (activeBrainId) {
                try {
                  await fetch(`${BACKEND_URL}/api/brains/${activeBrainId}/train`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      query: lastQuery,
                      aiResponse: realMessages[realMessages.length - 1]?.text, // La última respuesta de la IA que estamos corrigiendo
                      correction: suggestedResponse
                    })
                  });
                } catch (err) {
                  console.error("Error entrenando:", err);
                }
              }
              setRealMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: suggestedResponse }]);
              setIsInterventionMode(false);
            }}>Enviar y Entregar IA</button>
          </div>
        </div>
      </div>
    );
  };

  const renderOnboarding = () => {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-card">
          {onboardingStep === 1 && (
            <div className="step-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div className="logo-icon grow">🧠</div>
                <h2 style={{ marginBottom: 0 }}>Inicialización Neuronal</h2>
              </div>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Bienvenido al Centro de Mando. Para crear tu primer Cerebro Clonado, necesitamos definir su enfoque. ¿Qué nicho o producto va a vender esta instancia?
              </p>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Nombre del Cerebro (Ej. Ventas Autos, Pipas CDMX)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Escribe el nombre aquí..."
                  value={brainName}
                  onChange={(e) => setBrainName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="primary-btn"
                  onClick={() => setOnboardingStep(2)}
                  disabled={!brainName.trim()}
                  style={{ opacity: !brainName.trim() ? 0.5 : 1, cursor: !brainName.trim() ? 'not-allowed' : 'pointer' }}
                >
                  Continuar absorción →
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="step-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div className="logo-icon grow">📱</div>
                <h2 style={{ marginBottom: 0 }}>Sincronización WhatsApp</h2>
              </div>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Vincula el número de teléfono con {brainName}. Esto creará un canal de lectura aislado para que la red neuronal empiece a leer el historial de ventas.
              </p>

              <div style={{
                background: 'var(--bg-primary)',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px'
              }}>
                <div style={{ width: '160px', height: '160px', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {waQR ? (
                    <img src={waQR} alt="WhatsApp QR" style={{ width: '150px', height: '150px' }} />
                  ) : (
                    <div style={{ color: '#999', textAlign: 'center', fontSize: '0.8rem', padding: '10px' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
                      <div>Generando QR...</div>
                      <div style={{ fontSize: '0.65rem', marginTop: '4px', color: '#bbb' }}>Conectando a WhatsApp</div>
                    </div>
                  )}
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                  {waStatus === 'connected' ? '¡Dispositivo Vinculado! ✅' : 'Escanea este código con tu WhatsApp'}
                </p>
                  {!waQR && waStatus !== 'connected' && (
                    <button
                      onClick={async () => {
                        console.log('[WhatsApp] Mandando connect...');
                        setWaQR(null);
                        await fetch(`${BACKEND_URL}/api/whatsapp/connect`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                      }}
                      style={{ fontSize: '0.75rem', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', marginTop: '4px' }}
                    >
                      🔄 Vincular WhatsApp
                    </button>
                  )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button className="secondary-btn" onClick={() => setOnboardingStep(1)}>
                  ← Volver
                </button>
                <button
                  className="primary-btn"
                  onClick={() => setOnboardingStep(3)}
                  style={{ background: 'linear-gradient(135deg, #4CAF50, #2E7D32)', fontSize: '0.85rem' }}
                >
                  Saltar por ahora →
                </button>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '12px', fontStyle: 'italic' }}>
                Puedes vincular WhatsApp más tarde desde Configuración
              </p>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="step-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div className="logo-icon grow">⚙️</div>
                <h2 style={{ marginBottom: 0 }}>Parámetros de Aprendizaje</h2>
              </div>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Configura cómo quieres que actúe {brainName} en sus primeros días.
              </p>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Meses de historial a escanear
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['1 Mes', '3 Meses', '6 Meses', 'Todo'].map(btn => (
                    <button
                      key={btn}
                      className={`secondary-btn ${historyMonths === btn ? 'active' : ''}`}
                      style={{
                        flex: 1,
                        background: historyMonths === btn ? 'var(--wa-green)' : 'none',
                        color: historyMonths === btn ? '#fff' : 'var(--text-secondary)',
                        borderColor: historyMonths === btn ? 'var(--wa-green)' : 'var(--border-color)',
                        padding: '12px',
                        fontSize: '0.8rem'
                      }}
                      onClick={() => setHistoryMonths(btn)}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-card" style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Modo Espejo J7282</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>La IA solo observa y aprende sin responder.</div>
                  </div>
                  <div 
                    className={`toggle-switch ${mirrorMode ? 'active' : ''}`}
                    onClick={() => setMirrorMode(!mirrorMode)}
                  >
                    <div className="toggle-knob"></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="primary-btn"
                  onClick={async () => {
                    // Finalizar onboarding y crear cerebro en el backend
                    try {
                      const res = await fetch(`${BACKEND_URL}/api/brains`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          nombre: brainName,
                          personalityTraits: {
                            isMirrorMode: mirrorMode,
                            historyMonths: historyMonths
                          }
                        })
                      });
                      const data = await res.json();
                      if (data._id) {
                        setActiveBrainId(data._id);
                        setIsOnboarding(false);
                      }
                    } catch (err) {
                      setIsOnboarding(false);
                    }
                  }}
                  style={{ background: 'linear-gradient(135deg, #00A884, #005A4E)' }}
                >
                  Finalizar Configuración →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    return (
      <div className="dashboard-content dashboard-grid">
        <div className="card stat-card">
          <div className="card-label">Salud del Cerebro</div>
          <div className="stat-value">98.4%</div>
          <div style={{ color: 'var(--wa-green)', fontSize: '0.75rem', marginTop: '8px' }}>+1.2% vs ayer</div>
        </div>
        <div className="card stat-card">
          <div className="card-label">ADN Recolectado</div>
          <div className="stat-value">{chats.length > 0 ? 'Fase 2' : 'Fase 1'}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '8px' }}>
            {chats.length > 0 ? `${chats.length} conversaciones base` : 'Escaneando historial...'}
          </div>
        </div>
        <div className="card stat-card">
          <div className="card-label">Sincronización</div>
          <div className="stat-value" style={{ color: waStatus === 'connected' ? 'var(--wa-green)' : '#ff5252' }}>
            {waStatus === 'connected' ? 'LIVE' : 'OFF'}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h3 className="card-title">Rendimiento Cognitivo J7282</h3>
          </div>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '10px' }}>
            {[45, 67, 89, 72, 95, 88, 98].map((h, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: 'var(--wa-green)', opacity: 0.3 + (i*0.1), height: h + '%', borderRadius: '4px' }}></div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Próxima Acción Elite J7282</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {waStatus === 'connected' 
              ? 'El cerebro está en modo espejo. Analizando 14 conversaciones activas.' 
              : 'Conecta WhatsApp para iniciar la recolección de ADN neuronal.'}
          </p>
        </div>
      </div>
    );
  };

  if (!token) return renderAuth();
  if (isOnboarding) return renderOnboarding();

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      {isInterventionMode && renderInterventionModal()}
      
      {/* Sidebar J7282 */}
      <div className="sidebar">
        <div className="sidebar-header" style={{ padding: isSidebarCollapsed ? '20px 0' : '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
            <div className="logo-icon">🧠</div>
            {!isSidebarCollapsed && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>DARWIN</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--wa-green)', letterSpacing: '1px' }}>V2.0 NEURONAL</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="sidebar-nav">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} title="Dashboard">
            <LineChart size={20} />
            {!isSidebarCollapsed && <span>Vista General</span>}
          </div>
          <div className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')} title="Live Agent">
            <MessageSquareText size={20} />
            {!isSidebarCollapsed && <span>Agente en Vivo</span>}
          </div>
          <div className={`nav-item ${activeTab === 'mirror' ? 'active' : ''}`} onClick={() => setActiveTab('mirror')} title="Cerebro Espejo">
            <Zap size={20} />
            {!isSidebarCollapsed && <span>Cerebro Espejo</span>}
          </div>
          <div className={`nav-item ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')} title="Laboratorio">
            <Cpu size={20} />
            {!isSidebarCollapsed && <span>Laboratorio</span>}
          </div>
          
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Configuración">
              <Settings size={20} />
              {!isSidebarCollapsed && <span>Configuración</span>}
            </div>
            <div className="nav-item" onClick={() => {
              localStorage.removeItem('darwin_token');
              setToken(null);
              setUser(null);
            }} title="Cerrar Sesión">
              <ShieldAlert size={20} />
              {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content J7282 */}
      <div className="main-content">
        <div className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
              {activeTab === 'dashboard' && 'Dashboard Estratégico'}
              {activeTab === 'inbox' && 'Agente de Ventas en Vivo'}
              {activeTab === 'mirror' && 'Modo Espejo (Aprendizaje)'}
              {activeTab === 'lab' && 'Laboratorio Neuronal'}
              {activeTab === 'settings' && 'Log Corporativo'}
            </h1>
            <div className="status-badge">
              <div className="status-dot pulsed" style={{ backgroundColor: waStatus === 'connected' ? 'var(--wa-green)' : '#ff5252' }}></div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{waStatus === 'connected' ? 'SISTEMA ONLINE' : 'WA DESCONECTADO'}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             {!isSidebarCollapsed && (
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.email || 'Admin User'}</div>
                 <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Elite License Elite J7282</div>
               </div>
             )}
             <div className="avatar" style={{ width: '35px', height: '35px', borderRadius: '8px' }}>
               {user?.email?.substring(0, 1).toUpperCase() || 'A'}
             </div>
          </div>
        </div>

        <div className="scrollable-content">
          {activeTab === 'dashboard' && renderDashboard()}
          
          {activeTab === 'inbox' && (
            <div className="inbox-layout">
              <div className="chat-list-container">
                <div className="inbox-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>Chats de Ventas</h3>
                    <div className="status-badge" style={{ padding: '4px 8px' }}>
                      {chats.length} totales
                    </div>
                  </div>
                  
                  <div className="filter-pill-container">
                    {['Por resolver', 'Resueltos', 'Todos'].map(f => (
                      <div 
                        key={f}
                        className={`filter-pill ${inboxFilterStatus === f ? 'active' : ''}`}
                        onClick={() => setInboxFilterStatus(f)}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="chat-list" onScroll={handleChatListScroll}>
                  {filteredChats.slice(0, chatRenderLimit).map(chat => (
                    <ChatListItem 
                      key={chat.jid} 
                      chat={chat} 
                      isActive={selectedChatJid === chat.jid}
                      onClick={handleChatClick}
                    />
                  ))}
                  {isLoadingMoreChats && (
                    <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', opacity: 0.7 }}>
                      Cargando más chats...
                    </div>
                  )}
                  {filteredChats.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No hay conversaciones para mostrar.
                    </div>
                  )}
                </div>
              </div>

              <div className="chat-window">
                {selectedChatJid ? (
                  <>
                    <div className="chat-window-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar">
                           {chats.find(c => c.jid === selectedChatJid)?.pushName?.substring(0, 1).toUpperCase() || 'W'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{chats.find(c => c.jid === selectedChatJid)?.pushName || selectedChatJid.split('@')[0]}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--wa-green)' }}>● EN LÍNEA</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className={`secondary-btn ${mirrorMode ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                          MODO ESPEJO {mirrorMode ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>

                    <div className="messages-area" onScroll={handleScroll} style={{ background: '#efeae2' }}>
                      {isLoadingMore && (
                        <div style={{ textAlign: 'center', padding: '15px', fontSize: '0.75rem', color: '#667781' }}>
                          Cargando historial...
                        </div>
                      )}
                      {realMessages.map((msg, idx) => (
                        <MessageBubble 
                          key={msg._id || idx} 
                          msg={msg} 
                          isLast={idx === realMessages.length - 1} 
                        />
                      ))}
                      <div ref={messagesEndRef} style={{ height: '1px' }} />
                    </div>

                    <ChatInput onSendMessage={handleSendMessage} />
                  </>
                ) : (
                  <div className="no-chat-selected">
                    <div className="logo-icon grow" style={{ fontSize: '4rem', opacity: 0.1, marginBottom: '20px' }}>💬</div>
                    <p style={{ opacity: 0.5 }}>Selecciona un chat para ver la conversación neuronal</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'mirror' && (
            <div style={{ padding: '24px' }}>
              <div className="card" style={{ maxWidth: '800px' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
                  🧠 Modo Espejo (Aprendizaje Pasivo J7282)
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  En este modo, Darwin actúa como un observador silencioso. Su red neuronal analiza cada interacción entre tú y tus clientes sin intervenir. Este proceso es vital para capturar tu ADN de ventas: tono, gestos, manejo de objeciones y velocidad de respuesta.
                </p>
                <div style={{ background: 'rgba(0, 168, 132, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid var(--wa-green)', marginTop: '24px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--wa-green)', marginBottom: '8px' }}>Estado actual del Aprendizaje:</div>
                  <div style={{ fontSize: '0.9rem' }}>Fase 1: Reconocimiento de Estructura de Catálogo.</div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: '34%', height: '100%', background: 'var(--wa-green)' }}></div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.7rem', marginTop: '4px', opacity: 0.7 }}>34.2% completado</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lab' && (
            <div style={{ padding: '24px' }}>
               <div className="dashboard-grid">
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                      <div className="logo-icon small">🧪</div>
                      <h3 style={{ margin: 0 }}>Escaneo de ADN Histórico</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                      Darwin puede viajar al pasado y leer tus últimos meses de historial para clonar tu personalidad instantáneamente.
                    </p>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>Profundidad del escaneo</label>
                      <select className="input-field" value={historyMonths} onChange={e => setHistoryMonths(e.target.value)}>
                        <option>1 Mes</option>
                        <option>3 Meses</option>
                        <option>6 Meses</option>
                        <option>Todo</option>
                      </select>
                    </div>
                    <button 
                      className="primary-btn" 
                      onClick={() => {
                        fetch(`${BACKEND_URL}/api/whatsapp/scan-dna`, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ months: historyMonths })
                        }).then(() => alert('Escaneo de ADN iniciado.'));
                      }}
                      style={{ width: '100%' }}
                    >
                      Iniciar Aprendizaje Elite J7282
                    </button>
                  </div>
                  
                  <div className="card">
                    <h3 style={{ margin: '0 0 20px 0' }}>Sintonización Neuronal</h3>
                    {[
                      { l: 'Agresividad de Cierre', v: personalityAggressiveness, s: setPersonalityAggressiveness },
                      { l: 'Estilo WhatsApp (Emoji/Slang)', v: personalityWhatsApp ? 10 : 0, s: (v) => setPersonalityWhatsApp(v > 5) }
                    ].map(trait => (
                      <div key={trait.l} style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                          <span>{trait.l}</span>
                          <span>{trait.v}/10</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="10" 
                          value={trait.v} 
                          onChange={e => trait.s(parseInt(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--wa-green)' }} 
                        />
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ padding: '24px' }}>
              <div className="card" style={{ background: '#000', color: '#0f0', fontFamily: 'monospace', padding: '20px', minHeight: '600px', fontSize: '0.8rem' }}>
                <div style={{ borderBottom: '1px solid #060', paddingBottom: '10px', marginBottom: '20px', color: '#0a0' }}>
                  DARWIN_OS J7282 > LOGS_NEURONALES > STREAMING_MODE
                </div>
                {neuronalLogs.map((log, i) => (
                  <div key={log._id || i} style={{ marginBottom: '4px' }}>
                    <span style={{ opacity: 0.5 }}>[{`new Date(log.timestamp).toLocaleTimeString()`}]</span> {log.message}
                  </div>
                ))}
                <div className="pulsed" style={{ color: '#0f0', marginTop: '10px' }}>_</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
