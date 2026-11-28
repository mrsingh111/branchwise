import React, { useMemo, useState } from 'react';
import { X, Search, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import { getRecentTemplateIds, recordRecentTemplateId } from '../storage/db';

function TemplateMiniPreview({ tpl }) {
  const nodes = tpl.nodes || [];
  const edges = tpl.edges || [];
  if (!nodes.length) return null;

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + (n.w || 140)));
  const maxY = Math.max(...nodes.map((n) => n.y + (n.h || 60)));
  const pad = 28;
  const vbW = Math.max(200, maxX - minX + pad * 2);
  const vbH = Math.max(120, maxY - minY + pad * 2);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{ width: '100%', height: 118, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}
    >
      {edges.map((ed) => {
        const s = nodeMap.get(ed.source);
        const t = nodeMap.get(ed.target);
        if (!s || !t) return null;
        return (
          <line
            key={ed.id}
            x1={s.x + (s.w || 140) / 2}
            y1={s.y + (s.h || 60) / 2}
            x2={t.x + (t.w || 140) / 2}
            y2={t.y + (t.h || 60) / 2}
            stroke="var(--muted)"
            strokeWidth="3"
            strokeDasharray={ed.lineStyle === 'dashed' ? '8 6' : undefined}
            strokeOpacity="0.7"
          />
        );
      })}
      {nodes.map((n) => (
        <rect
          key={n.id}
          x={n.x}
          y={n.y}
          width={n.w || 140}
          height={n.h || 60}
          rx={n.shape === 'circle' ? 999 : n.shape === 'start' || n.shape === 'end' ? 24 : 8}
          fill={n.shape === 'container' ? 'transparent' : 'var(--surface)'}
          stroke={n.shape === 'container' ? 'var(--border-strong)' : '#6E8AE6'}
          strokeWidth={n.shape === 'container' ? '3' : '4'}
          strokeDasharray={n.shape === 'container' ? '10 6' : undefined}
        />
      ))}
    </svg>
  );
}

export default function TemplateGalleryModal({ open, onClose, onSelectTemplate }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState(() => getRecentTemplateIds());

  const recentTemplates = useMemo(
    () => recentIds.map((id) => BUILTIN_TEMPLATES.find((t) => t.id === id)).filter(Boolean),
    [recentIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILTIN_TEMPLATES.filter((t) => {
      const catOk = category === 'All' || t.category === category;
      const qOk =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [category, query]);

  if (!open) return null;

  const handleUse = (tpl) => {
    setRecentIds(recordRecentTemplateId(tpl.id));
    onSelectTemplate(tpl);
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.titleRow}>
              <Sparkles size={18} color="#6E8AE6" />
              <h2 style={styles.title}>Template Gallery</h2>
            </div>
            <p style={styles.sub}>12 technical categories — every template opens as a fully editable diagram.</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close templates">
            <X size={18} />
          </button>
        </div>

        <div style={styles.controls}>
          <div style={styles.searchWrap}>
            <Search size={15} color="var(--muted)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search architecture, UML, ER, network, flowchart..."
              style={styles.searchInput}
            />
          </div>
          <div style={styles.cats}>
            {TEMPLATE_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    ...styles.catBtn,
                    background: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? 'var(--accent-inv)' : 'var(--text-soft)',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.body}>
          {recentTemplates.length > 0 && category === 'All' && !query && (
            <div style={{ marginBottom: 20 }}>
              <div style={styles.sectionLabel}>
                <Clock size={13} />
                <span>Recently Used</span>
              </div>
              <div style={styles.grid}>
                {recentTemplates.slice(0, 3).map((tpl) => (
                  <div key={`recent-${tpl.id}`} style={styles.card} onClick={() => handleUse(tpl)}>
                    <TemplateMiniPreview tpl={tpl} />
                    <div style={styles.cardMeta}>
                      <span style={styles.badge}>{tpl.category}</span>
                      <div style={styles.cardTitle}>{tpl.title}</div>
                      <div style={styles.cardDesc}>{tpl.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.sectionLabel}>
            <span>{category === 'All' ? 'All Templates' : category} ({filtered.length})</span>
          </div>
          <div style={styles.grid}>
            {filtered.map((tpl) => (
              <div key={tpl.id} style={styles.card} onClick={() => handleUse(tpl)}>
                <TemplateMiniPreview tpl={tpl} />
                <div style={styles.cardMeta}>
                  <div style={styles.cardTopRow}>
                    <span style={styles.badge}>{tpl.category}</span>
                    <span style={styles.useTag}>
                      Use <ArrowRight size={12} />
                    </span>
                  </div>
                  <div style={styles.cardTitle}>{tpl.title}</div>
                  <div style={styles.cardDesc}>{tpl.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.62)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '88vh',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  header: {
    padding: '18px 22px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' },
  sub: { margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  controls: {
    padding: '14px 22px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 13,
  },
  cats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBtn: {
    padding: '5px 11px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  body: {
    padding: '18px 22px',
    overflowY: 'auto',
    flex: 1,
  },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted)',
    marginBottom: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
  },
  card: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'border-color 0.15s ease',
  },
  cardMeta: { display: 'flex', flexDirection: 'column', gap: 5 },
  cardTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6E8AE6',
    background: 'rgba(110, 138, 230, 0.12)',
    padding: '2px 8px',
    borderRadius: 999,
  },
  useTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-soft)',
  },
  cardTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  cardDesc: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 },
};
