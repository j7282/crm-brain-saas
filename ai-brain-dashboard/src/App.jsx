import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://crm-brain-backend.onrender.com';
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

const socket = io(BACKEND_URL);

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

  // Simulación de Chat
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hola Carlos. Entiendo completamente tu preocupación. Una disculpa por la demora, estábamos verificando el reflejo del pago en el sistema bancario.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSentiment, setCurrentSentiment] = useState('red');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
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

  // Polling para QR de WhatsApp con auto-reset si no aparece
  useEffect(() => {
    let interval;
    let pollCount = 0;
    const MAX_POLLS_BEFORE_RESET = 30; // 60 segundos sin QR = reintentar (Render es lento)
    
    // Función de chequeo de estado para bypass
    const checkStatus = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/whatsapp/qr`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        setWaQR(data.qr);
        setWaStatus(data.status);

        if (data.status === 'connected') {
          setWaQR(null);
          if (isOnboarding) {
            console.log('[WhatsApp] Auto-bypass onboarding: connected');
            setIsOnboarding(false);
            setActiveTab('inbox');
          }
          return true;
        }
        return false;
      } catch (err) { return false; }
    };

    if (token) {
      checkStatus();
      interval = setInterval(async () => {
        const connected = await checkStatus();
        if (connected) {
          clearInterval(interval);
          return;
        }

        if (isOnboarding && onboardingStep === 2) {
          // Lógica de reset si no hay QR
          pollCount++;
          if (pollCount >= MAX_POLLS_BEFORE_RESET) {
            console.log('[WhatsApp] Auto-reset triggered');
            pollCount = 0;
            fetch(`${BACKEND_URL}/api/whatsapp/reset`, {
              method: 'POST',
              headers: {
                'X-App-Version': '1.6.4-MULTIMEDIA',
                'Authorization': `Bearer ${token}`
              }
            });
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isOnboarding, onboardingStep, token]);

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
          const res = await fetch(`${BACKEND_URL}/api/whatsapp/messages/${selectedChatJid}?limit=40`, {
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
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/messages/${selectedChatJid}?limit=40&before=${firstMsgTimestamp}`, {
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
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jid: selectedChatJid,
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
                    localStorage.setItem('token', data.token);
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
                      aiResponse: messages[messages.length - 1]?.text, // La última respuesta de la IA que estamos corrigiendo
                      correction: suggestedResponse
                    })
                  });
                } catch (err) {
                  console.error("Error entrenando:", err);
                }
              }
              setMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: suggestedResponse }]);
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
                      setWaQR(null);
                      await fetch(`${BACKEND_URL}/api/whatsapp/reset`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                    }}
                    style={{ fontSize: '0.75rem', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', marginTop: '4px' }}
                  >
                    🔄 Reintentar QR
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
                        padding: '8px',
                        border: historyMonths === btn ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        backgroundColor: historyMonths === btn ? 'rgba(0, 240, 255, 0.1)' : 'transparent'
                      }}
                      onClick={() => setHistoryMonths(btn)}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{ fontSize: '1.2rem' }}>👁️</div>
                <div>
                  <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }}>Modo Espejo (Observador)</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    La IA solo leerá tus respuestas actuales sin contestar automáticamente por 7 días, aprendiendo en tiempo real tu técnica de cierre.
                  </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                    checked={mirrorMode}
                    onChange={(e) => setMirrorMode(e.target.checked)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="secondary-btn" onClick={() => setOnboardingStep(2)}>
                  ← Volver
                </button>
                <button className="primary-btn" onClick={async () => {
                  try {
                    const res = await fetch(`${BACKEND_URL}/api/brains`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        name: brainName,
                        niche: 'Ventas Automáticas',
                        historyLimit: historyMonths,
                        personalityTraits: {
                          isMirrorMode: true, // Siempre empezamos en Vigilante J7282
                          isWhatsAppStyle: true,
                          aggressivenessLevel: 5
                        }
                      })
                    });
                    const data = await res.json();
                    if (data._id) {
                      setActiveBrainId(data._id);
                      setIsOnboarding(false);
                    }
                  } catch (_err) {
                    alert("Error guardando el cerebro.");
                  }
                }}>
                  Activar Cerebro e ir al Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {!token ? renderAuth() : (
        <>
          {isOnboarding ? renderOnboarding() : (
            <>
              {isInterventionMode && renderInterventionModal()}
              {/* Sidebar */}
              <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  <div className="logo-icon grow">🧠</div>
                  {!isSidebarCollapsed && <div className="logo-text">ANTIGRAVITY</div>}
                </div>

                <div className="account-selector">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-dot green"></div>
                    {!isSidebarCollapsed && (
                      <div>
                        <div className="label">Cerebro Activo</div>
                        <div className="value">{brainName || "Cerebro Central"}</div>
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && <ChevronDown size={16} />}
                </div>

                <nav className="nav-menu">
                  <div className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')} title="Bandeja de Entrada">
                    <MessageSquareText size={20} />
                    {!isSidebarCollapsed && <span>Bandeja de Entrada</span>}
                  </div>
                  <div className={`nav-item ${activeTab === 'mirror' ? 'active' : ''}`} onClick={() => setActiveTab('mirror')} title="WhatsApp Real">
                    <Zap size={20} style={{ color: '#ff9800' }} />
                    {!isSidebarCollapsed && <span style={{ fontWeight: 700 }}>WhatsApp Real</span>}
                  </div>
                  <div className={`nav-item ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')} title="Pipeline Kanban">
                    <LineChart size={20} />
                    {!isSidebarCollapsed && <span>Pipeline Kanban</span>}
                  </div>
                  <div className={`nav-item ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')} title="Laboratorio Neuronal">
                    <Cpu size={20} />
                    {!isSidebarCollapsed && <span>Laboratorio Neuronal</span>}
                  </div>
                  <div className={`nav-item ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')} title="Clonador de Voz">
                    <Mic size={20} />
                    {!isSidebarCollapsed && <span>Clonador de Voz</span>}
                  </div>
                  <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Supervisión">
                    <ShieldAlert size={20} />
                    {!isSidebarCollapsed && <span>Supervisión</span>}
                  </div>
                </nav>

                <div style={{ marginTop: 'auto', padding: '16px' }}>
                  <div className="nav-item" onClick={() => {
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                  }} title="Cerrar Sesión">
                    <Bot size={20} />
                    {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
                  </div>
                </div>
              </aside>
              {/* Main Content (Keep original routing logic here or similar) */}
              <main className="main-content">
                {activeTab === 'inbox' && (
                  <div className="inbox-layout">
                    {/* Chat List (Sidebar of Inbox) */}
                    <div className="chat-list">
                      <div className="inbox-header-tabs" style={{ alignItems: 'center', padding: '0 15px', borderBottom: '1px solid var(--border-color)', height: '60px' }}>
                        <div className={`inbox-tab ${inboxFilterStatus === 'Por resolver' ? 'active' : ''}`} onClick={() => setInboxFilterStatus('Por resolver')}>Por resolver</div>
                        <div className={`inbox-tab ${inboxFilterStatus === 'Resueltos' ? 'active' : ''}`} onClick={() => setInboxFilterStatus('Resueltos')}>Resueltos</div>
                        <div className={`inbox-tab ${inboxFilterStatus === 'Todos' ? 'active' : ''}`} onClick={() => setInboxFilterStatus('Todos')}>Todos ({totalChats})</div>
                        
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                           {/* Escudo de Protección de Cerebro */}
                           <div style={{ 
                             display: 'flex', 
                             alignItems: 'center', 
                             gap: '6px', 
                             backgroundColor: 'rgba(53, 162, 235, 0.08)', 
                             padding: '6px 12px', 
                             borderRadius: '8px',
                             border: '1px solid rgba(53, 162, 235, 0.2)'
                           }} title="Tu entrenamiento y configuración están blindados en la base de datos central.">
                             <ShieldAlert size={14} style={{ color: 'var(--accent-blue)' }} />
                             <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.5px' }}>CEREBRO BLINDADO</span>
                           </div>

                           <span style={{ 
                             fontSize: '0.7rem', 
                             color: waStatus === 'connected' ? 'var(--wa-green)' : '#ff5252',
                             backgroundColor: waStatus === 'connected' ? 'rgba(37, 211, 102, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                             padding: '6px 10px',
                             borderRadius: '8px',
                             fontWeight: 600,
                             border: waStatus === 'connected' ? '1px solid rgba(37, 211, 102, 0.2)' : '1px solid rgba(255, 82, 82, 0.2)'
                           }}>
                             {waStatus === 'connected' ? '● EN LÍNEA' : '● DESCONECTADO'}
                           </span>
                           <button 
                               onClick={() => fetch(`${BACKEND_URL}/api/whatsapp/sync-previews`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })}
                               style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}
                               title="Sincronizar Mensajes"
                           >
                               🔄
                           </button>
                        </div>
                      </div>

                      <div className="inbox-assignee-filters">
                        <div className={`filter-chip ${inboxFilterAssignee === 'all' ? 'active' : ''}`} onClick={() => setInboxFilterAssignee('all')}>Todos</div>
                        <div className={`filter-chip ${inboxFilterAssignee === 'me' ? 'active' : ''}`} onClick={() => setInboxFilterAssignee('me')}>👤 Míos</div>
                        <div className={`filter-chip ${inboxFilterAssignee === 'ai' ? 'active' : ''}`} onClick={() => setInboxFilterAssignee('ai')}>🤖 De la IA</div>
                        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>Darwin v1.6.6</div>
                      </div>

                        <div className="chat-list-items" 
                             style={{ flex: 1, overflowY: 'auto', background: '#fff', contain: 'content' }} 
                             onScroll={handleChatListScroll}>
                          {filteredChats.length === 0 && !isLoadingMoreChats ? (
                            <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
                              No hay chats que coincidan con los filtros.
                            </div>
                          ) : (
                            filteredChats.slice(0, chatRenderLimit).map((chat) => (
                              <ChatListItem 
                                key={chat.jid} 
                                chat={chat} 
                                isActive={selectedChatJid === chat.jid}
                                onClick={handleChatClick}
                              />
                            ))
                          )}
                        {isLoadingMoreChats && (
                          <div className="shimmer-item" style={{ height: '72px', margin: '10px', background: '#f0f2f5', borderRadius: '8px' }}></div>
                        )}
                      </div>
                    </div>

                    <div className="chat-view">
                      {!selectedChatJid ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: '#f0f2f5' }}>
                          <Bot size={64} style={{ marginBottom: '24px', opacity: 0.1 }} />
                          <h3 style={{ fontWeight: 500 }}>Darwin Elite Intelligence</h3>
                          <p style={{ opacity: 0.6 }}>Selecciona un cliente para comenzar el cierre.</p>
                        </div>
                      ) : (
                        <>
                          <div className="chat-view-header">
                            <div className="header-user-info">
                              <div className="avatar" style={{ width: '40px', height: '40px', marginRight: '12px' }}>
                                {chats.find(c => c.jid === selectedChatJid)?.pushName?.substring(0, 2).toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="contact-name" style={{ fontSize: '1rem', fontWeight: 600 }}>
                                  {chats.find(c => c.jid === selectedChatJid)?.pushName || selectedChatJid.split('@')[0]}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--wa-green)', fontWeight: 500 }}>● Sincronizado J7282</span>
                              </div>
                            </div>
                          </div>

                          <div className="messages-area" onScroll={handleScroll} style={{ background: '#efeae2' }}>
                            {isLoadingMore && (
                              <div style={{ textAlign: 'center', padding: '15px', fontSize: '0.75rem', color: '#667781' }}>
                                Cargando historial...
                              </div>
                            )}
                            {/* Solo renderizamos el lote actual solicitado para máxima velocidad J7282 */}
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
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'mirror' && (
                  <div className="mirror-layout" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b141a', color: '#e9edef' }}>
                     <div style={{ padding: '15px 25px', background: '#202c33', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374045' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           <div className="pulse-icon" style={{ width: '10px', height: '10px', background: '#00a884', borderRadius: '50%' }}></div>
                           <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Sincronización de Alta Fidelidad J7282</span>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                           <button 
                            onClick={() => window.location.reload()}
                            style={{ background: '#00a884', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}
                           >
                             Forzar Re-carga J7282
                           </button>
                           <div style={{ fontSize: '0.85rem', color: '#8696a0' }}>Motor Darwin 2.0 Activo 🧠</div>
                        </div>
                     </div>
                     <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '20px', padding: '40px' }}>
                        <Zap size={60} color="#ff9800" />
                        <h2 style={{ margin: 0 }}>Modo Real-Time Optimizado</h2>
                        <p style={{ maxWidth: '600px', textAlign: 'center', color: '#8696a0', lineHeight: '1.6' }}>
                          Para evitar bloqueos de seguridad de Meta, hemos integrado la inteligencia de Darwin directamente en tu Inbox de la izquierda. 
                          <br/><br/>
                          <strong>Instrucciones:</strong> Si no ves mensajes, usa el botón "Forzar Re-carga" o asegúrate de que el Backend esté procesando el historial. Los mensajes aparecerán instantáneamente en tu Inbox Inteligente. J7282.
                        </p>
                     </div>
                  </div>
                )}

                {activeTab === 'kanban' && (
                  <div className="kanban-layout" style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '32px' }}>
                      <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Pipeline de Ventas Automático</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>La IA mueve a los clientes entre columnas según el progreso del cierre.</p>
                    </div>

                    <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', alignItems: 'flex-start' }}>
                      {['Prospecto', 'Cliente', 'VIP', 'Urgente', 'Seguimiento', 'Cerrado'].map((label) => {
                        const labelChats = chats.filter(c => c.labels?.includes(label));
                        return (
                          <div key={label} className="kanban-column" style={{ background: 'rgba(0,0,0,0.02)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', minHeight: '500px' }}>
                            <div className="kanban-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid rgba(53, 162, 235, 0.3)', paddingBottom: '8px' }}>
                              <span className="kanban-column-title" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
                              <span className="kanban-count" style={{ fontSize: '0.8rem', opacity: 0.5 }}>{labelChats.length}</span>
                            </div>
                            
                            {labelChats.map(chat => (
                              <div key={chat.jid} className="kanban-card" onClick={() => { setSelectedChatJid(chat.jid); setActiveTab('inbox'); }} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{chat.pushName || chat.jid.split('@')[0]}</div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.lastMessage}</p>
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={`sentiment-badge bg-${chat.sentiment || 'yellow'}`} style={{ width: '8px', height: '8px' }}></span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{new Date(chat.lastTimestamp).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}

                            {labelChats.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '40px 10px', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                Sin prospectos
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'lab' && (
                  <div className="lab-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Laboratorio Neuronal</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Configura las reglas de aprendizaje y comportamiento emocional de {brainName}.</p>

                    <div className="settings-section" style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>🧠 Rasgos de Personalidad (Traits)</h3>

                      <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>Estilo WhatsApp (Recomendado)</strong>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Obliga a la IA a ser casual, usar emojis cortos y evitar lenguaje robótico o exigir correos electrónicos.</p>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={personalityWhatsApp} onChange={(e) => setPersonalityWhatsApp(e.target.checked)} />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>Prohibir Enviar Links</strong>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Evita que la IA invente o envíe URLs largas que pueden romper la experiencia de chat móvil.</p>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={personalityForbidLinks} onChange={(e) => setPersonalityForbidLinks(e.target.checked)} />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <strong style={{ color: 'var(--accent-purple)' }}>Respuestas con Voz Clonada (Darwin Voice)</strong>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Darwin responderá usando notas de voz con tu perfil replicado de ElevenLabs.</p>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={personalityUseVoice} onChange={(e) => setPersonalityUseVoice(e.target.checked)} />
                          <span className="slider round" style={{ backgroundColor: personalityUseVoice ? 'var(--accent-purple)' : '' }}></span>
                        </label>
                      </div>

                      <div className="setting-item">
                        <div style={{ marginBottom: '8px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Agresividad de Cierre: <span style={{ color: 'var(--wa-green)' }}>{personalityAggressiveness}</span> / 10</strong>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Nivel 1 es consultivo y paciente. Nivel 10 es un agente que empuja activamente al pago inmediato.</p>
                        </div>
                        <input type="range" min="1" max="10" value={personalityAggressiveness} onChange={(e) => setPersonalityAggressiveness(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--wa-green)' }} />
                      </div>

                      <div className="setting-item" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(53, 162, 235, 0.05)', borderRadius: '8px', border: '1px solid rgba(53, 162, 235, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: 'var(--accent-blue)' }}>🛡️ MODO VIGILANTE (Mirror Mode)</strong>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Fase de 7 días. Darwin observa y analiza tus ventas pero **NO** responde a los clientes. Ideal para aprendizaje neuronal.</p>
                          </div>
                          <label className="switch">
                            <input type="checkbox" checked={mirrorMode} onChange={(e) => setMirrorMode(e.target.checked)} />
                            <span className="slider round"></span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="settings-section" style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>🧬 Escaneo Neuronal de ADN (1-6 Meses)</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Darwin analizará meses de historial para clonar tu tono, ganchos de cierre y vocabulario técnico automáticamente.</p>
                      
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select 
                          className="input-field" 
                          value={historyMonths} 
                          onChange={(e) => setHistoryMonths(e.target.value)}
                          style={{ flex: 1, height: '42px' }}
                        >
                          <option>1 Mes</option>
                          <option>2 Meses</option>
                          <option>3 Meses</option>
                          <option>4 Meses</option>
                          <option>5 Meses</option>
                          <option>6 Meses</option>
                        </select>
                        <button 
                          className="secondary-btn"
                          style={{ minWidth: '150px', backgroundColor: 'var(--bg-navy)', color: 'white' }}
                          onClick={async () => {
                            if (!activeBrainId) return alert('Selecciona un cerebro primero.');
                            try {
                              const res = await fetch(`${BACKEND_URL}/api/whatsapp/scan-dna`, {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ brainId: activeBrainId, months: parseInt(historyMonths) })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert('🧬 Escaneo de ADN iniciado. Darwin está procesando ' + historyMonths + ' de historial en segundo plano.');
                              } else {
                                alert('Error: ' + data.error);
                              }
                            } catch (e) {
                              alert('Error de conexión al iniciar el escaneo.');
                            }
                          }}
                        >
                          Escanear ADN
                        </button>
                      </div>
                    </div>

                    <div className="settings-section" style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>🌐 Alimentar con URL (Darwin Reader)</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Pega el link de tu catálogo, blog o servicios para que la IA aprenda los detalles automáticamente.</p>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="https://ejemplo.com/servicios" 
                          value={knowledgeUrl}
                          onChange={(e) => setKnowledgeUrl(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button 
                          className="secondary-btn" 
                          disabled={!knowledgeUrl || isScraping}
                          style={{ minWidth: '100px' }}
                          onClick={async () => {
                            if (!activeBrainId) return alert('Debes seleccionar un cerebro primero.');
                            setIsScraping(true);
                            try {
                              const res = await fetch(`${BACKEND_URL}/api/knowledge/url`, {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ url: knowledgeUrl, brainId: activeBrainId })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert('¡Contenido de la URL absorbido con éxito!');
                                setKnowledgeUrl('');
                              } else {
                                alert('Error: ' + data.error);
                              }
                            } catch (e) {
                              alert('Error de conexión al leer el link.');
                            } finally {
                              setIsScraping(false);
                            }
                          }}
                        >
                          {isScraping ? 'Leyendo...' : 'Alimentar'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="primary-btn" style={{ flex: 1 }} onClick={async () => {
                        if (!activeBrainId) return alert('Selecciona un cerebro primero.');
                        try {
                          const res = await fetch(`${BACKEND_URL}/api/brains/${activeBrainId}/traits`, {
                            method: 'PATCH',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ 
                              personalityTraits: {
                                isWhatsAppStyle: personalityWhatsApp,
                                aggressivenessLevel: personalityAggressiveness,
                                forbidLongLinks: personalityForbidLinks,
                                useVoiceResponse: personalityUseVoice,
                                isMirrorMode: mirrorMode
                              }
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            alert('¡Configuración Neuronal cargada exitosamente!');
                          } else {
                            alert('Error: ' + data.error);
                          }
                        } catch (e) {
                          alert('Error al conectar con el laboratorio.');
                        }
                      }}>
                        Guardar Configuración Neuronal
                      </button>

                      <button className="secondary-btn" title="Descargar copia de seguridad del agente" onClick={async () => {
                        if (!activeBrainId) return alert('Selecciona un cerebro primero.');
                        try {
                          const res = await fetch(`${BACKEND_URL}/api/brains/${activeBrainId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          const brain = await res.json();
                          const blob = new Blob([JSON.stringify(brain, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Darwin_Backup_${brain.name}_${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        } catch (e) {
                          alert('Error al generar la copia de seguridad.');
                        }
                      }}>
                        📥 Backup
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'voice' && (
                  <div className="voice-layout" style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '32px' }}>
                      <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Clonador de Perfil Vocal</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Entrena a tu IA con muestras de tu propia voz para respuestas humanas.</p>
                    </div>

                    <div className="voice-grid">
                      <div className="premium-card">
                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Mic size={20} color="var(--accent-blue)" /> Cargar Nueva Muestra
                        </h3>
                        <div className="upload-zone">
                          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>☁️</div>
                          <p style={{ fontWeight: 600 }}>Cargar audio</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Arrastra o selecciona un archivo (Max 10MB)</p>
                        </div>
                      </div>

                      <div className="premium-card">
                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <ShieldAlert size={20} color="var(--accent-purple)" /> Estado de ElevenLabs
                        </h3>
                        <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Sincronización</span>
                            <span style={{ color: 'var(--wa-green)', fontWeight: 600 }}>Activa</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', backgroundColor: '#eee', borderRadius: '2px' }}>
                            <div style={{ width: '85%', height: '100%', backgroundColor: 'var(--accent-purple)', borderRadius: '2px' }}></div>
                          </div>
                          <p style={{ fontSize: '0.75rem', marginTop: '12px', color: 'var(--text-secondary)' }}>Voz actual: "Vendedor Elite - Optimizado"</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '40px' }}>
                      <h3 style={{ marginBottom: '20px' }}>Muestras en la Base de Conocimiento</h3>
                      {[1, 2].map((i) => (
                        <div key={i} className="premium-card" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-navy)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                              ▶️
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, margin: 0 }}>Muestra_Referencia_00{i}.mp3</p>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Cargado el 15 Mar 2026</p>
                            </div>
                          </div>
                          <button className="secondary-btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Eliminar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="settings-layout" style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '32px' }}>
                      <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Supervisión del Cerebro</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Métricas de rendimiento y control de calidad de la IA en tiempo real.</p>
                    </div>

                    <div className="metric-grid">
                      {/* Monitor de Aprendizaje Neuronal */}
                      <div className="metric-card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, #1a1f3c 0%, #2a305c 100%)', padding: '24px', border: '1px solid var(--accent-purple)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BrainCircuit size={20} className="text-purple" style={{ color: 'var(--accent-purple)' }} /> 
                            Progreso de Clonación Neuronal de Darwin
                          </h3>
                        </div>
                        
                        <div className="learning-progress-container">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Fase: {neuronalLogs.length > 5 ? 'Sincronización de Estilo' : 'Análisis Inicial'}</span>
                            <span style={{ color: 'var(--wa-green)' }}>{Math.min(100, (neuronalLogs.length * 10))}%</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (neuronalLogs.length * 10))}%`, height: '100%', background: 'var(--accent-purple)', transition: 'width 1s ease' }}></div>
                          </div>
                          <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            Darwin ha procesado {neuronalLogs.length} eventos neuronales y analizado {chats.length} conversaciones reales.
                          </p>
                        </div>
                      </div>

                      <div className="metric-card" style={{ gridColumn: 'span 2', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--accent-blue)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--accent-blue)' }}>📊 Reporte "Corte de Caja Cognitivo"</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Envía manualmente el resumen de aprendizajes al +52 1 55 4624 0128.</p>
                        </div>
                        <button 
                          className="primary-btn" 
                          style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                          onClick={async () => {
                            try {
                              const res = await fetch(`${BACKEND_URL}/api/whatsapp/report`, {
                                method: 'POST',
                                headers: { 
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                }
                              });
                              const data = await res.json();
                              if (data.success) alert('Reporte enviado con éxito.');
                              else alert('Error: ' + data.error);
                            } catch (e) { alert('Error de conexión.'); }
                          }}
                        >
                          Enviar Reporte Ahora
                        </button>
                      </div>

                      <div className="metric-card">
                        <span className="metric-label">Sentiment Score</span>
                        <span className="metric-value">94%</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">Tasa de Cierre</span>
                        <span className="metric-value">22.5%</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">Intervenciones</span>
                        <span className="metric-value">4</span>
                      </div>
                      <div className="metric-card" style={{ background: 'var(--accent-blue)' }}>
                        <span className="metric-label">Estado</span>
                        <span className="metric-value" style={{ fontSize: '1.2rem' }}>OPTIMIZADO</span>
                      </div>
                    </div>

                    <div className="premium-card">
                      <h3 style={{ marginBottom: '20px' }}>Log de Eventos Neuronales (En Vivo)</h3>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', maxHeight: '400px', overflowY: 'auto' }}>
                        {neuronalLogs.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            Esperando actividad neuronal...
                          </div>
                        ) : (
                          neuronalLogs.map((log, idx) => (
                            <div key={idx} style={{ 
                              padding: '10px 0', 
                              borderBottom: '1px solid var(--border-color)', 
                              color: log.type === 'ai' ? 'var(--wa-green)' : 
                                     log.type === 'brain' ? 'var(--accent-purple)' : 
                                     log.type === 'system' ? 'var(--accent-blue)' : 'var(--text-secondary)'
                            }}>
                              [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] {log.message}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </main>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
