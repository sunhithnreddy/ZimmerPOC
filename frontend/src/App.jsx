import { useState, useRef, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Safe text renderer - prevents XSS
function SafeText({ text }) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  )
}

function AiAvatar() {
  return (
    <div className="ai-avatar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87"/>
        <circle cx="12" cy="17" r="4"/>
        <path d="M12 15v4M10 17h4"/>
      </svg>
    </div>
  )
}

function WelcomeScreen({ role, onQuickAction }) {
  const isAdmin = role === 'admin'
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87"/>
          <circle cx="12" cy="17" r="4"/>
          <path d="M12 15v4M10 17h4"/>
        </svg>
      </div>
      <h2>{isAdmin ? 'Admin Console' : 'How can I help?'}</h2>
      <p className="welcome-subtitle">
        {isAdmin
          ? 'Search tickets, view metrics, and manage escalations with AI assistance.'
          : 'Describe your issue and I\'ll find a solution or create a ticket for you.'}
      </p>
      <div className="welcome-suggestions">
        {(isAdmin ? [
          { icon: '🔍', label: 'Open incidents', query: 'Show all open incidents' },
          { icon: '🚨', label: 'P1 critical', query: 'What P1 tickets need attention?' },
          { icon: '📊', label: 'Dashboard', query: 'Show me the current ticket stats' },
          { icon: '📈', label: 'KB + tickets', query: 'Are there any database-related incidents and how do I troubleshoot them?' },
        ] : [
          { icon: '🔑', label: 'Password reset', query: 'How do I reset my password?' },
          { icon: '🌐', label: 'VPN issues', query: 'VPN not connecting' },
          { icon: '📧', label: 'Email sync', query: 'Email not syncing on my phone' },
          { icon: '🎫', label: 'Create ticket', query: 'I need to create a support ticket' },
        ]).map(s => (
          <button key={s.label} className="welcome-suggestion" onClick={() => onQuickAction(s.query)}>
            <span className="suggestion-icon">{s.icon}</span>
            <span className="suggestion-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ContextCard({ type, data }) {
  if (type === 'tickets' && data.length > 0) {
    return (
      <div className="context-card card-animate">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Short description</th>
              <th>Priority</th>
              <th>State</th>
              <th>Assigned to</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.map(t => (
              <tr key={t.id}>
                <td className="ticket-id">{t.id}</td>
                <td className="ticket-desc">{t.subject || t.short_desc}</td>
                <td><span className={`priority-badge ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                <td><span className={`state-badge ${t.status.toLowerCase().replace(' ', '-')}`}>{t.status}</span></td>
                <td className="assigned">{t.assigned}</td>
                <td className="updated">{t.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (type === 'ticket_status' && data) {
    return (
      <div className="context-card ticket-status-card card-animate">
        <div className="status-header">
          <span className="ticket-id">{data.id}</span>
          <span className={`state-badge ${data.status.toLowerCase().replace(' ', '-')}`}>{data.status}</span>
        </div>
        <h4>{data.subject}</h4>
        <div className="status-details">
          <div><span className="label">Priority:</span> <span className={`priority-badge ${data.priority.toLowerCase()}`}>{data.priority}</span></div>
          <div><span className="label">Assigned:</span> {data.assigned}</div>
          <div><span className="label">Updated:</span> {data.updated}</div>
        </div>
      </div>
    )
  }

  if (type === 'stats') {
    return (
      <div className="context-card stats-card card-animate">
        <div className="stats-row">
          <div className="stat-block">
            <span className="stat-number">{data.total_open}</span>
            <span className="stat-label">Open Incidents</span>
          </div>
          <div className="stat-block critical">
            <span className="stat-number">{data.p1_count}</span>
            <span className="stat-label">P1 - Critical</span>
          </div>
          <div className="stat-block warning">
            <span className="stat-number">{data.p2_count || 0}</span>
            <span className="stat-label">P2 - High</span>
          </div>
          <div className="stat-block positive">
            <span className="stat-number">{data.trend}</span>
            <span className="stat-label">Week over Week</span>
          </div>
        </div>
      </div>
    )
  }

  if ((type === 'kb_articles' || type === 'resolution') && data) {
    const articles = Array.isArray(data) ? data : [data]
    if (articles.length === 0) return null

    return (
      <div className="context-card kb-card card-animate">
        {articles.map(kb => (
          <div key={kb.id} className="kb-item">
            <div className="kb-header">
              <span className="kb-id">{kb.id}</span>
              <span className="kb-title">{kb.title}</span>
            </div>
            <p className="kb-excerpt">{kb.excerpt}</p>
            {kb.steps && (
              <div className="kb-steps">
                <strong>Resolution Steps:</strong>
                <ol>
                  {kb.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return null
}

function TicketForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'P3',
    requester_email: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      onSubmit(data)
    } catch (err) {
      console.error(err)
    }
    setSubmitting(false)
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <h3>Create Support Ticket</h3>
      <div className="form-group">
        <label>Your Email</label>
        <input
          type="email"
          value={form.requester_email}
          onChange={e => setForm({...form, requester_email: e.target.value})}
          placeholder="you@company.com"
          required
        />
      </div>
      <div className="form-group">
        <label>Subject</label>
        <input
          type="text"
          value={form.subject}
          onChange={e => setForm({...form, subject: e.target.value})}
          placeholder="Brief description of the issue"
          required
          minLength={5}
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          placeholder="Provide details about your issue..."
          required
          minLength={10}
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>Priority</label>
        <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
          <option value="P3">P3 - Low</option>
          <option value="P2">P2 - Medium</option>
          <option value="P1">P1 - High (Business Critical)</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Ticket'}
        </button>
      </div>
    </form>
  )
}

function EscalateButton({ onEscalate }) {
  return (
    <div className="escalate-prompt">
      <p>Didn't solve your issue?</p>
      <button className="btn-escalate" onClick={onEscalate}>
        Create Support Ticket
      </button>
    </div>
  )
}

const TOOL_LABELS = {
  search_tickets: { label: 'Searching tickets', icon: '🔍' },
  search_knowledge_base: { label: 'Searching knowledge base', icon: '📚' },
  get_ticket_statistics: { label: 'Pulling statistics', icon: '📊' },
  check_ticket_status: { label: 'Checking ticket status', icon: '🔎' },
}

function ThinkingIndicator({ phase, tools }) {
  return (
    <div className="thinking-indicator">
      <div className="thinking-steps">
        {/* Phase 1: Analyzing */}
        <div className={`thinking-step ${phase === 'analyzing' ? 'active' : phase !== 'analyzing' ? 'done' : ''}`}>
          <div className="thinking-step-icon">
            {phase === 'analyzing' ? <span className="thinking-spinner" /> : <span className="thinking-check">✓</span>}
          </div>
          <span className="thinking-step-label">Analyzing your request</span>
        </div>

        {/* Phase 2: Tool calls */}
        {tools && tools.length > 0 && tools.map((tool, i) => {
          const info = TOOL_LABELS[tool] || { label: tool.replace(/_/g, ' '), icon: '⚙️' }
          const isActive = phase === 'tools'
          const isDone = phase === 'responding'
          return (
            <div key={i} className={`thinking-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              <div className="thinking-step-icon">
                {isActive ? <span className="thinking-spinner" /> : isDone ? <span className="thinking-check">✓</span> : <span className="thinking-dot" />}
              </div>
              <span className="thinking-step-label">{info.icon} {info.label}</span>
            </div>
          )
        })}

        {/* Phase 3: Generating */}
        {(phase === 'responding') && (
          <div className="thinking-step active">
            <div className="thinking-step-icon">
              <span className="thinking-spinner" />
            </div>
            <span className="thinking-step-label">Generating response</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Message({ message, onEscalate, onShowTicketForm }) {
  const isUser = message.role === 'user'

  return (
    <div className={`message ${message.role}`}>
      {!isUser && <AiAvatar />}
      <div className="message-column">
        <div className="message-inner">
          {/* Thinking indicator - shown while waiting for response */}
          {!isUser && message.streaming && !message.content && (
            <ThinkingIndicator
              phase={message.tools?.length ? (message.contexts?.length ? 'responding' : 'tools') : 'analyzing'}
              tools={message.tools}
            />
          )}

          {/* Tool indicator - shown after response completes */}
          {!isUser && !message.streaming && message.tools && message.tools.length > 0 && (
            <div className="tool-indicator">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span>Used {message.tools.map(t => (TOOL_LABELS[t]?.label?.toLowerCase() || t.replace(/_/g, ' '))).join(', ')}</span>
            </div>
          )}
          {message.contexts && message.contexts.map((ctx, i) => (
            <ContextCard key={`${ctx.type}-${i}`} type={ctx.type} data={ctx.data} />
          ))}
          {message.content && (
            <div className="message-text">
              <SafeText text={message.content} />
              {message.streaming && <span className="cursor"></span>}
            </div>
          )}
          {message.showEscalate && <EscalateButton onEscalate={onEscalate} />}
          {message.showTicketForm && <TicketForm onSubmit={onShowTicketForm} onCancel={() => {}} />}
        </div>
        {message.timestamp && (
          <span className="message-time">{formatTime(message.timestamp)}</span>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('user') // 'user' or 'admin'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const messagesEnd = useRef(null)

  // Reset messages when tab changes
  useEffect(() => {
    setMessages([])
    setShowTicketForm(false)
  }, [activeTab])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (customMessage) => {
    const msg = customMessage || input
    if (!msg.trim() || loading) return

    const userMessage = { id: Date.now(), role: 'user', content: msg, timestamp: Date.now() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setShowTicketForm(false)

    const assistantId = Date.now() + 1
    const assistantMessage = { id: assistantId, role: 'assistant', content: '', tools: [], contexts: [], streaming: true, timestamp: Date.now() }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, role: activeTab })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            setMessages(prev => {
              const newMsgs = [...prev]
              const lastIdx = newMsgs.findIndex(m => m.id === assistantId)
              if (lastIdx === -1) return prev

              const last = { ...newMsgs[lastIdx] }

              if (data.type === 'tools') {
                last.tools = data.tools
              } else if (data.type === 'context') {
                last.contexts = [...(last.contexts || []), { type: data.context_type, data: data.data }]
              } else if (data.type === 'token') {
                last.content += data.content
              } else if (data.type === 'action') {
                if (data.action === 'show_escalate_option') {
                  last.showEscalate = true
                } else if (data.action === 'show_ticket_form') {
                  last.showTicketForm = true
                }
              } else if (data.type === 'done') {
                last.streaming = false
              }

              newMsgs[lastIdx] = last
              return newMsgs
            })
          } catch (e) {
            console.error('Parse error:', e)
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev]
        const lastIdx = newMsgs.findIndex(m => m.id === assistantId)
        if (lastIdx !== -1) {
          newMsgs[lastIdx] = {
            ...newMsgs[lastIdx],
            content: 'Unable to connect. Please check your connection and try again.',
            streaming: false
          }
        }
        return newMsgs
      })
    }

    setLoading(false)
  }

  const handleEscalate = () => {
    setShowTicketForm(true)
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'assistant',
      content: "I'll help you create a support ticket. Please fill out the form below:",
      tools: [],
      contexts: [],
      showTicketForm: true,
      timestamp: Date.now()
    }])
  }

  const handleTicketCreated = (data) => {
    setShowTicketForm(false)
    const msg = data.suggested_resolution
      ? `Ticket **${data.ticket.id}** created! While you wait, here's a possible solution from our knowledge base:`
      : `Ticket **${data.ticket.id}** created successfully! Our team will review it shortly. You'll receive updates at ${data.ticket.requester}.`

    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'assistant',
      content: msg,
      tools: [],
      contexts: data.suggested_resolution ? [{ type: 'resolution', data: data.suggested_resolution }] : [],
      timestamp: Date.now()
    }])
  }

  const quickActions = activeTab === 'admin' ? [
    { label: 'Open incidents', query: 'Show all open incidents' },
    { label: 'P1 tickets', query: 'What P1 tickets need attention?' },
    { label: 'Dashboard', query: 'Show me the current ticket stats' },
    { label: 'Escalations', query: 'Any escalated tickets?' },
  ] : [
    { label: 'Password reset', query: 'How do I reset my password?' },
    { label: 'VPN issues', query: 'VPN not connecting' },
    { label: 'Email sync', query: 'Email not syncing on my phone' },
    { label: 'Create ticket', query: 'I need to create a support ticket' },
  ]

  const showWelcome = messages.length === 0

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
          <span>Service Portal</span>
        </div>

        <div className="tab-switcher">
          <button
            className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => setActiveTab('user')}
          >
            User
          </button>
          <button
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
        </div>

        <nav className="sidebar-nav">
          {activeTab === 'user' ? (
            <>
              <button className="nav-item active">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Get Help
              </button>
              <button className="nav-item" onClick={() => sendMessage('Check my ticket status')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                My Tickets
              </button>
              <button className="nav-item" onClick={() => sendMessage('I need to create a support ticket')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Ticket
              </button>
            </>
          ) : (
            <>
              <button className="nav-item active">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Agent Chat
              </button>
              <button className="nav-item" onClick={() => sendMessage('Show all open incidents')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                Incidents
              </button>
              <button className="nav-item" onClick={() => sendMessage('Show me the current ticket stats')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
                Dashboard
              </button>
              <button className="nav-item" onClick={() => sendMessage('Any escalated tickets?')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                Escalations
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="connection-status">
            <span className="status-dot"></span>
            <span>Connected</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1>{activeTab === 'admin' ? 'Admin Console' : 'IT Help Desk'}</h1>
          <div className="header-actions">
            <span className="powered-badge">Powered by Claude AI</span>
            <span className="role-badge">{activeTab === 'admin' ? 'Administrator' : 'End User'}</span>
          </div>
        </header>

        <div className="chat-area">
          <div className="messages">
            {showWelcome && (
              <WelcomeScreen role={activeTab} onQuickAction={sendMessage} />
            )}
            {messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                onEscalate={handleEscalate}
                onShowTicketForm={handleTicketCreated}
              />
            ))}
            <div ref={messagesEnd} />
          </div>
        </div>

        <footer className="input-area">
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={activeTab === 'admin' ? 'Search tickets, view stats...' : 'Describe your issue...'}
              disabled={loading}
            />
            <button onClick={() => sendMessage()} disabled={loading} className="send-btn">
              {loading ? (
                <svg className="spinner" width="18" height="18" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 70"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
          {!showWelcome && (
            <div className="quick-actions">
              {quickActions.map(qa => (
                <button key={qa.label} onClick={() => sendMessage(qa.query)}>{qa.label}</button>
              ))}
            </div>
          )}
        </footer>
      </main>
    </div>
  )
}
