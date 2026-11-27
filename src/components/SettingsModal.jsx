import React, { useState } from 'react';
import { X, Key, Cpu, Check } from 'lucide-react';
import { PROVIDER_PRESETS } from '../services/aiProvider';

export default function SettingsModal({ settings, notice, onSave, onClose }) {
  const [form, setForm] = useState(settings);

  const applyPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  const isLocal = form.baseUrl?.includes('localhost') || form.baseUrl?.includes('127.0.0.1');
  const hasKey = Boolean(form.apiKey?.trim() || isLocal);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={20} color="#B9A7FF" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>AI API Configuration</h2>
          </div>
          <button onClick={onClose} style={styles.iconBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={styles.subtitle}>
          Plug in any OpenAI-compatible API — OpenAI, OpenRouter, Groq, OpenCode Zen, DeepSeek, Together AI, Mistral, xAI Grok, Gemini, or local Ollama / LM Studio.
        </p>

        <div style={styles.freeTip}>
          <strong>Tip for free API calls:</strong> Try <strong>OpenRouter</strong> (free-tier models) or{' '}
          <strong>Groq</strong> — both offer free limited API usage so you can start without paying.
        </div>

        {notice && (
          <div style={styles.noticeBanner}>
            {notice}
          </div>
        )}

        <div style={styles.presetsRow}>
          {PROVIDER_PRESETS.map((p) => {
            const active = form.baseUrl === p.baseUrl;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                style={{
                  ...styles.presetChip,
                  borderColor: active ? 'var(--accent)' : 'var(--border-strong)',
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? 'var(--accent-inv)' : 'var(--text)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            <span>Base URL</span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={13} /> API Key {isLocal && <em style={{ color: '#95E8A8' }}>(optional for local)</em>}
            </span>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-... (stored locally in your browser)"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span>Model</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="gpt-4o-mini / deepseek-chat / gemini-2.5-flash"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span>AI Thinking Style (System Prompt)</span>
            <textarea
              rows={3}
              value={form.customSystemPrompt}
              onChange={(e) => setForm({ ...form, customSystemPrompt: e.target.value })}
              style={{ ...styles.input, resize: 'vertical', lineHeight: 1.45 }}
            />
          </label>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!form.useDemoIfNoKey}
              onChange={(e) => setForm({ ...form, useDemoIfNoKey: !e.target.checked })}
            />
            <span>Require API key for AI thinking (disable Demo AI fallback)</span>
          </label>

          <div style={styles.footer}>
            <span style={{ fontSize: 12, fontWeight: 500, color: hasKey ? '#2F9E66' : form.useDemoIfNoKey ? '#D97706' : '#E11D48' }}>
              {hasKey
                ? '● Live AI API ready'
                : form.useDemoIfNoKey
                ? '● Demo AI fallback active'
                : '● API key required (no Demo fallback)'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={styles.secondaryBtn}>
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn}>
                <Check size={15} /> Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 540,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 22,
    color: 'var(--text)',
    boxShadow: '0 24px 60px var(--shadow)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconBtn: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    width: 32,
    height: 32,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  subtitle: {
    margin: '0 0 10px',
    fontSize: 13,
    color: 'var(--text-soft)',
    lineHeight: 1.5,
  },
  freeTip: {
    marginBottom: 14,
    padding: '9px 12px',
    borderRadius: 10,
    background: 'rgba(82, 168, 122, 0.14)',
    border: '1px solid rgba(82, 168, 122, 0.35)',
    color: 'var(--text)',
    fontSize: 12.5,
    lineHeight: 1.45,
  },
  noticeBanner: {
    marginBottom: 14,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(225, 29, 72, 0.12)',
    border: '1px solid rgba(225, 29, 72, 0.35)',
    color: '#E11D48',
    fontSize: 12.5,
    fontWeight: 500,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    color: 'var(--text)',
    cursor: 'pointer',
    marginTop: 2,
  },
  presetsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    border: '1px solid',
    borderRadius: 999,
    padding: '6px 11px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTop: '1px solid var(--border)',
  },
  secondaryBtn: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '9px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'var(--accent-inv)',
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};
