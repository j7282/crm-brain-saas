import { useState, useEffect, useRef } from 'react'
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
  Bot
} from 'lucide-react' // Wait, I need to install lucide-react first. I will replace these with placeholders for now.

function App() {
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [brainName, setBrainName] = useState('');
  const [waQR, setWaQR] = useState(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [activeTab, setActiveTab] = useState('inbox');

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
  const [activeBrainId, setActiveBrainId] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling para QR de WhatsApp
  useEffect(() => {
    let interval;
    if (isOnboarding && onboardingStep === 2 && token) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/whatsapp/qr`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          setWaQR(data.qr);
          setWaStatus(data.status);

          if (data.status === 'connected') {
            clearInterval(interval);
            setTimeout(() => setOnboardingStep(3), 1500); // Transition on success
          }
        } catch (err) {
          console.error("Error polling QR:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isOnboarding, onboardingStep, token]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = { role: 'client', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setLastQuery(inputText);
    try {
      const response = await fetch(`${BACKEND_URL}/api/cerebro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mensajeCliente: inputText,
          historial: messages.slice(-5),
          brainId: activeBrainId
        })
      });

      const data = await response.json();

      if (data.respuestaTexto) {
        setMessages(prev => [...prev, { role: 'ai', text: data.respuestaTexto }]);
        if (data.sentiment) setCurrentSentiment(data.sentiment);
      }
    } catch (error) {
      console.error("Error en simulación:", error);
      setMessages(prev => [...prev, { role: 'ai', text: "Lo siento, mi conexión cerebral ha fallado momentáneamente." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderAuth = () => {
    return (
      <div className="onboarding-overlay" style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.9)' }}>
        <div className="onboarding-card auth-card" style={{ maxWidth: '400px', margin: 'auto', background: 'var(--bg-secondary)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div className="logo-icon grow" style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '24px' }}>🧠</div>
          <h2 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>{authMode === 'login' ? 'Bienvenido de Nuevo' : 'Crear Cuenta SaaS'}</h2>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.7rem', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', opacity: 0.8 }}>v1.5.0-DEPLOY-CHECK</span>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Protege tus cerebros clonados y accede desde cualquier lugar.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Correo Electrónico</label>
            <input
              type="email"
              className="input-field"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Contraseña</label>
            <input
              type="password"
              className="input-field"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            className="primary-btn"
            style={{ width: '100%', marginBottom: '16px' }}
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
              } catch (err) {
                alert("Error de conexión con el servidor.");
              }
            }}
          >
            {authMode === 'login' ? 'Entrar al Centro de Mando' : 'Registrar y Empezar'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
            {authMode === 'login' ? '¿No tienes cuenta?' : '¿Ya eres miembro?'}
            <span
              style={{ color: 'var(--accent-cyan)', cursor: 'pointer', marginLeft: '8px' }}
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
            </span>
          </p>
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
                    <div style={{ color: 'var(--bg-secondary)', textAlign: 'center', fontSize: '0.8rem', padding: '10px' }}>
                      {waStatus === 'connecting' ? 'Iniciando...' : 'Generando QR Real...'}
                    </div>
                  )}
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                  {waStatus === 'connected' ? '¡Dispositivo Vinculado! ✅' : 'Escanea este código con tu WhatsApp'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="secondary-btn" onClick={() => setOnboardingStep(1)}>
                  ← Volver
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Detectando escaneo automáticamente...
                </div>
              </div>
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
                    <button key={btn} className="secondary-btn" style={{ flex: 1, padding: '8px' }}>{btn}</button>
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
                  <input type="checkbox" style={{ transform: 'scale(1.5)', cursor: 'pointer' }} defaultChecked />
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
                        niche: 'Autos/Pipas',
                        shadowMode: true
                      })
                    });
                    const data = await res.json();
                    if (data._id) {
                      setActiveBrainId(data._id);
                      setIsOnboarding(false);
                    }
                  } catch (err) {
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
              <aside className="sidebar">
                <div className="sidebar-header">
                  <div className="logo-icon grow">🧠</div>
                  <div className="logo-text">ANTIGRAVITY</div>
                </div>

                <div className="account-selector">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-dot green"></div>
                    <div>
                      <div className="label">Cerebro Activo</div>
                      <div className="value">{brainName || "Cerebro Central"}</div>
                    </div>
                  </div>
                  <ChevronDown size={16} />
                </div>

                <nav className="nav-menu">
                  <div className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
                    <MessageSquareText size={18} />
                    <span>Bandeja de Entrada</span>
                  </div>
                  <div className={`nav-item ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')}>
                    <LineChart size={18} />
                    <span>Pipeline Kanban</span>
                  </div>
                  <div className={`nav-item ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')}>
                    <Cpu size={18} />
                    <span>Laboratorio Neuronal</span>
                  </div>
                  <div className={`nav-item ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>
                    <Mic size={18} />
                    <span>Clonador de Voz</span>
                  </div>
                  <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                    <ShieldAlert size={18} />
                    <span>Supervisión</span>
                  </div>
                </nav>

                <div style={{ marginTop: 'auto', padding: '16px' }}>
                  <button className="secondary-btn" style={{ width: '100%' }} onClick={() => {
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                  }}>
                    Cerrar Sesión
                  </button>
                </div>
              </aside>
              {/* Main Content (Keep original routing logic here or similar) */}
              <main className="main-content">
                {activeTab === 'inbox' && (
                  <div className="inbox-layout">
                    {/* Chat List (Sidebar of Inbox) */}
                    <div className="chat-list">
                      <div className="chat-item sentiment-red active">
                        <div className="chat-header">
                          <span className="contact-name">Carlos Ruiz</span>
                          <span className="time">10:42 AM</span>
                        </div>
                        <p className="last-message" style={{ color: 'var(--text-primary)' }}>¡Ya deposité hace 2 horas y no me confirman!</p>
                      </div>

                      <div className="chat-item sentiment-green">
                        <div className="chat-header">
                          <span className="contact-name">Ana M. (Cot. #492)</span>
                          <span className="time">10:38 AM</span>
                        </div>
                        <p className="last-message">Perfecto, mándame los datos para la transferencia.</p>
                      </div>

                      <div className="chat-item sentiment-yellow">
                        <div className="chat-header">
                          <span className="contact-name">Roberto J.</span>
                          <span className="time">09:15 AM</span>
                        </div>
                        <p className="last-message">Me gusta, pero vi uno similar más barato en otra agencia.</p>
                      </div>
                    </div>

                    {/* Active Chat View */}
                    <div className="chat-view">
                      <div className="chat-view-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>CR</div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Carlos Ruiz</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="sentiment-badge badge-red">Estado: Molesto</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Prioridad: Urgente</span>
                            </div>
                          </div>
                        </div>
                        <button className="take-control-btn" onClick={() => {
                          setSuggestedResponse("¡Hola Carlos! Siento mucho la demora. He verificado manualmente y tu pago ya fue recibido. En 5 minutos te llega el contrato.");
                          setIsInterventionMode(true);
                        }}>
                          <span>🛑</span> Tomar Control Manual
                        </button>
                      </div>

                      <div className="messages-area">
                        <div style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Inicio de la conversación (Simulador)</div>

                        <div className="message client">
                          ¡Hola! Ya hice el pago del enganche para el auto, te mandé foto del comprobante hace como 2 horas y nadie me dice nada. ¿Qué pasó?
                        </div>

                        <div className="message ai">
                          Hola Carlos. Entiendo completamente tu preocupación. Una disculpa por la demora, estábamos verificando el reflejo del pago en el sistema bancario.
                          <br /><br />
                          ¡Buenas noticias! Tu pago inicial ya está confirmado. En unos minutos te enviaré el contrato digital para firma.
                          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>✨</span> Generado automáticamente - Estrategia Emocional: "Validación y Rapidez"
                          </div>
                        </div>

                        {messages.map((msg, idx) => (
                          <div key={idx} className={`message ${msg.role}`}>
                            {msg.text}
                          </div>
                        ))}

                        {isTyping && (
                          <div className="message ai" style={{ opacity: 0.7, fontStyle: 'italic' }}>
                            Escribiendo...
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <div className="input-area">
                        <div className="action-btn">📎</div>
                        <div className="action-btn" style={{ position: 'relative' }}>
                          🎙️
                          <div style={{ position: 'absolute', top: -4, right: -4, width: '12px', height: '12px', backgroundColor: 'var(--accent-purple)', borderRadius: '50%', border: '2px solid var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '6px' }}>✨</span>
                          </div>
                        </div>
                        <input
                          type="text"
                          className="chat-input"
                          placeholder="Escribe un mensaje para probar la IA..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          disabled={isTyping}
                        />
                        <div className="action-btn send" onClick={handleSendMessage} style={{ cursor: isTyping ? 'not-allowed' : 'pointer' }}>
                          {isTyping ? '...' : '➤'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'kanban' && (
                  <div className="kanban-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Pipeline de Ventas Automático</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>La IA mueve a los clientes entre columnas según el progreso del cierre.</p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, overflowX: 'auto', paddingBottom: '20px' }}>
                      <div className="kanban-column" style={{ minWidth: '300px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Nuevos Prospectos</h3>
                        <div className="kanban-card" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                          <strong>+52 55 1122 3344</strong>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>"Info de la pipa para Tlalpan urg..."</p>
                        </div>
                      </div>
                      {/* Repetir estructura para otras columnas si es necesario, o mantener simple */}
                    </div>
                  </div>
                )}

                {activeTab === 'lab' && (
                  <div className="lab-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
                    <h2>Laboratorio Neuronal</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Configura las reglas de aprendizaje de {brainName}.</p>
                    {/* ... Contenido del laboratorio ... */}
                  </div>
                )}

                {activeTab === 'voice' && (
                  <div className="voice-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
                    <h2>Clonador de Perfil Vocal</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Sube muestras de tu voz para que la IA responda por audio.</p>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="settings-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
                    <h2>Supervisión</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Control de acceso y alertas de WhatsApp.</p>
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
