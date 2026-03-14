import { useState, useEffect, useRef } from 'react'
import './App.css'

const BACKEND_URL = 'https://crm-brain-backend.onrender.com';
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
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'lab'

  // Simulación de Chat
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hola Carlos. Entiendo completamente tu preocupación. Una disculpa por la demora, estábamos verificando el reflejo del pago en el sistema bancario.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSentiment, setCurrentSentiment] = useState('red');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = { role: 'client', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/cerebro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensajeCliente: inputText,
          historial: messages.slice(-5)
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
                <div style={{ width: '160px', height: '160px', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=simulate_whatsapp_login" alt="QR Code" style={{ width: '140px', height: '140px' }} />
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Escanea este código con tu WhatsApp</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="secondary-btn" onClick={() => setOnboardingStep(1)}>
                  ← Volver
                </button>
                <button className="primary-btn" onClick={() => setOnboardingStep(3)}>
                  Simular Escaneo Exitoso
                </button>
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
                <button className="primary-btn" onClick={() => setIsOnboarding(false)}>
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
      {isOnboarding && renderOnboarding()}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">AG</div>
          <div className="logo-text">ANTIGRAVITY</div>
        </div>

        <div className="account-selector">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green', boxShadow: '0 0 10px #00ff66' }}></div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Cerebro Activo</div>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{brainName || "Cerebro 1"}</div>
            </div>
          </div>
          <div>▾</div>
        </div>

        <nav className="nav-menu">
          <div
            className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <span>💬</span>
            Bandeja de Entrada
          </div>
          <div
            className={`nav-item ${activeTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveTab('kanban')}
          >
            <span>📋</span>
            Pipeline Kanban
          </div>
          <div
            className={`nav-item ${activeTab === 'lab' ? 'active' : ''}`}
            onClick={() => setActiveTab('lab')}
          >
            <span>🧠</span>
            Laboratorio Neuronal
          </div>
          <div
            className={`nav-item ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <span>🎙️</span>
            Clonador de Voz
          </div>
          <div
            className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <span>📈</span>
            Métricas de Cierre
          </div>
          <div
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span>🛡️</span>
            Portal de Supervisión
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Semáforo de Ventas</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Visualizando y gestionando sentimientos en tiempo real</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div className="glow-effect" style={{ width: '8px', height: '8px', backgroundColor: 'var(--accent-cyan)', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>IA En Escucha Activa</span>
            </div>
          </div>
        </header>

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
                <button className="take-control-btn">
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
          <div className="kanban-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Pipeline de Ventas Automático (Kanban)</h2>
              <p style={{ color: 'var(--text-secondary)' }}>La IA mueve a los clientes entre columnas según el contexto de la conversación.</p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, overflowX: 'auto', paddingBottom: '20px' }}>
              {/* Columna 1 */}
              <div className="kanban-column" style={{ minWidth: '300px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Nuevos Prospectos</h3>
                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>2</span>
                </div>

                <div className="kanban-card" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>+52 55 1122 3344</strong>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--sentiment-green)' }}></span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>"Info de la pipa para Tlalpan urg..."</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hace 5 min</span>
                    <span>Cerebro IA</span>
                  </div>
                </div>

                <div className="kanban-card" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>+52 81 4455 6677</strong>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--sentiment-yellow)' }}></span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>"¿Tienes fotos del Jetta?"</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hace 12 min</span>
                    <span>Cerebro IA</span>
                  </div>
                </div>
              </div>

              {/* Columna 2 */}
              <div className="kanban-column" style={{ minWidth: '300px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Negociando (Cotizados)</h3>
                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>1</span>
                </div>

                <div className="kanban-card" style={{ backgroundColor: 'var(--sentiment-yellow-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--sentiment-yellow)', marginBottom: '12px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ color: 'var(--sentiment-yellow)' }}>Roberto Carlos</strong>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--sentiment-yellow)' }}></span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>"Está un poco caro, bro. ¿Es lo menos?"</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hace 1 hora</span>
                    <span style={{ color: 'var(--accent-purple)' }}>Hook Aplicado</span>
                  </div>
                </div>
              </div>

              {/* Columna 3 */}
              <div className="kanban-column" style={{ minWidth: '300px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Pago Pendiente (Datos Enviados)</h3>
                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>1</span>
                </div>

                <div className="kanban-card" style={{ backgroundColor: 'var(--sentiment-green-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--sentiment-green)', marginBottom: '12px', cursor: 'grab' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ color: 'var(--sentiment-green)' }}>Arq. Jiménez</strong>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--sentiment-green)' }}></span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>"Perfecto, mándame la cuenta."</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Esperando Ticket</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>Alerta Anti-Ghosting en 23h</span>
                  </div>
                </div>
              </div>

              {/* Columna 4 */}
              <div className="kanban-column" style={{ minWidth: '300px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', borderTop: '3px solid var(--accent-cyan)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Cerrados (Ganados)</h3>
                  <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>14</span>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Arrastra tarjetas aquí para registrar ingresos
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lab' && (
          <div className="lab-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Laboratorio Neuronal</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Aquí se inyectan conocimientos y estrategias directas a {brainName}</p>
                </div>
                <button className="primary-btn">
                  <span>➕</span> Nueva Regla de Aprendizaje
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
                {/* Panel 1: Ingestión de Respuestas Rápidas */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '36px', height: '36px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📝</div>
                    <h3 style={{ margin: 0 }}>Respuestas Rápidas</h3>
                  </div>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                    La IA analizará estos textos no solo para repetirlos, sino para entender <strong>cuándo</strong> usarlos según el contexto de la venta.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>/datos-bancarios</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Contexto: Cierre Final</span>
                      </div>
                      <p style={{ fontSize: '0.9rem' }}>Te comparto la cuenta para el enganche: BBVA 0123... A nombre de Comercializadora del Centro.</p>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>+ Simular importación desde teléfono</span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Tácticas de Cierre / Hooks */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '36px', height: '36px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🪝</div>
                    <h3 style={{ margin: 0 }}>Estrategias y "Hooks"</h3>
                  </div>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                    Reglas heurísticas para clientes que dudan o piden rebajas.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ backgroundColor: 'var(--sentiment-yellow-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--sentiment-yellow)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--sentiment-yellow)', borderRadius: '50%' }}></div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--sentiment-yellow)', fontWeight: 'bold' }}>Si el cliente dice: "Está caro"</span>
                      </div>
                      <p style={{ fontSize: '0.9rem' }}>
                        <strong>Acción IA:</strong> Aplicar regla de escasez. Mencionar: "Entiendo, pero considera que es la última unidad que nos queda a precio del mes pasado. Mañana hay ajuste de tarifa."
                      </p>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>+ Entrenar Nueva Táctica</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="voice-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Clonador de Perfil Vocal</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Genera síntesis de voz exacta para responder con tus mismos audios.</p>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: 'var(--spacing-xl)', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px' }}>
                  <div className="glow-effect" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                    🎙️
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>Estado del Modelo Vocoder: <span style={{ color: 'var(--accent-green)' }}>Activo y Entrenado</span></h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Precisión de tono: 98% | Latencia de generación: 0.8s | Tipo: Masculino / Cálido</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📁</div>
                    <h4 style={{ marginBottom: '8px' }}>Subir muestras de audio</h4>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Archivos .ogg, .mp3 o .wav para afinar la red neuronal de tu voz.</p>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ marginBottom: '16px' }}>Prueba de fuego neuronal</h4>
                    <textarea
                      className="input-field"
                      style={{ minHeight: '80px', marginBottom: '16px', resize: 'none' }}
                      placeholder="Escribe algo aquí para que el clon de IA lo lea con tu voz..."
                      defaultValue="Hola, claro que sí, te mando la cotización del vehículo ahorita mismo por PDF."
                    ></textarea>
                    <button className="primary-btn" style={{ width: '100%' }}>
                      <span>▶️</span> Generar y Escuchar Audio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="metrics-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Métricas de Rendimiento y Cierre</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>Monitor en tiempo real de la autonomía de la Inteligencia Artificial.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderTop: '3px solid var(--accent-cyan)' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '8px' }}>Tasa de Automatización</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>87.5%</div>
                  <div style={{ color: 'var(--sentiment-green)', fontSize: '0.8rem', marginTop: '8px' }}>↑ 2.4% vs Ayer</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderTop: '3px solid var(--sentiment-green)' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '8px' }}>Ventas Cerradas por IA</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>14</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px' }}>En los últimos 7 días</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderTop: '3px solid var(--sentiment-red)' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '8px' }}>Intervenciones Humanas</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--sentiment-red)' }}>3</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px' }}>Principal causa: Objeciones de precio</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', padding: 'var(--spacing-xl)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '24px' }}>Distribución de Sentimientos Atendidos</h3>
                <div style={{ display: 'flex', gap: '16px', height: '30px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '65%', backgroundColor: 'var(--sentiment-green)', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: '#000', fontSize: '0.8rem', fontWeight: 'bold' }}>Verdes (65%)</div>
                  <div style={{ width: '25%', backgroundColor: 'var(--sentiment-yellow)', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: '#000', fontSize: '0.8rem', fontWeight: 'bold' }}>Amarillos (25%)</div>
                  <div style={{ width: '10%', backgroundColor: 'var(--sentiment-red)', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>Rojos (10%)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-layout" style={{ padding: 'var(--spacing-xl)', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Portal de Supervisión</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Configuración crítica y Reportes Cognitivos hacia WhatsApp.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  <div style={{ fontSize: '2rem' }}>📱</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '8px' }}>Alertas de Supervisión en WhatsApp</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                      Notificaciones Push hacia el número Master cuando la IA identifique cierres críticos o conflictos irrevocables.
                    </p>
                    <input type="text" className="input-field" placeholder="Número Administrador (Ej. +52 55 1234 5678)" style={{ maxWidth: '300px', marginBottom: '12px' }} defaultValue="+52 1 55 4624 0128" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" defaultChecked /> <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Recibir "Corte de Caja Cognitivo" diario a las 20:00 hrs.</label>
                    </div>
                  </div>
                  <button className="primary-btn">Guardar</button>
                </div>

                <div style={{ backgroundColor: 'var(--sentiment-red-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--sentiment-red)', display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  <div style={{ fontSize: '2rem' }}>☢️</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: 'var(--sentiment-red)', marginBottom: '8px' }}>Zona Crítica: Aislamiento Neural</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                      Acciones irreversibles sobre los datos aprendidos del Cerebro actual ({brainName}).
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button className="secondary-btn" style={{ borderColor: 'var(--sentiment-red)', color: 'var(--sentiment-red)' }}>Purgar Memoria</button>
                      <button className="secondary-btn" style={{ backgroundColor: 'var(--sentiment-red)', color: '#fff', border: 'none' }}>Destruir Instancia y Desvincular QR</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
