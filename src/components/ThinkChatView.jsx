import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Network, Loader2, Sparkles, Sun, Moon } from 'lucide-react';
import { thinkItThroughChat } from '../services/aiProvider';

export default function ThinkChatView({ initialPrompt, settings, theme, onToggleTheme, onBack, onConvertToMap }) {
  const [messages, setMessages] = useState(() => {
    const base = [
      {
        role: 'assistant',
        content:
          'What’s on your mind? Share a messy idea, problem, or topic — we’ll think it through together, and you can turn it into a Mind Map anytime.',
      },
    ];
    return base;
  });
  const [input, setInput] = useState(initialPrompt || '');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const reply = await thinkItThroughChat(
        next.map((m) => ({ role: m.role, content: m.content })),
        settings
      );
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = () => {
    const userTopics = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' — ');
    onConvertToMap(userTopics || 'Structured problem solving');
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.circleBtn}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Reasoning Chat</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Structured thinking workspace</div>
        </div>
        <button onClick={onToggleTheme} style={styles.circleBtn} title="Toggle Dark/Light">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={handleConvert} style={styles.convertBtn}>
          <Network size={15} />
          <span>Convert to Mind Map</span>
        </button>
      </header>

      <div style={styles.messages}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              ...styles.bubble,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--purple-deep)' : 'var(--surface)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              color: m.role === 'user' ? '#FFF' : 'var(--text)',
            }}
          >
            {m.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, color: 'var(--teal)' }}>
                <Sparkles size={12} /> MindLattice AI
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14 }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.bubble, alignSelf: 'flex-start', background: '#18181F', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={15} className="spin" color="#A8E5FA" />
            <span style={{ fontSize: 13, color: '#9898A6' }}>Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} style={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Think through an idea or question..."
          style={styles.input}
        />
        <button type="submit" disabled={loading || !input.trim()} style={styles.sendBtn}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 760,
    margin: '0 auto',
    background: 'var(--bg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  convertBtn: {
    background: 'rgba(124,108,255,0.16)',
    border: '1px solid rgba(124,108,255,0.35)',
    color: 'var(--purple)',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bubble: {
    maxWidth: '82%',
    padding: '12px 15px',
    borderRadius: 16,
  },
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 18px 18px',
    borderTop: '1px solid var(--border)',
  },
  input: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '12px 18px',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: 'none',
    background: 'var(--purple-deep)',
    color: '#FFF',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
};
