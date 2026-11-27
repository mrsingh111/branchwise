import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  Settings,
  Trash2,
  Sun,
  Moon,
  HelpCircle,
  Heart,
  X,
} from 'lucide-react';
import { BRANCH_COLORS, TRENDING_TOPICS } from '../data/presets';

function MiniLatticePreview({ branches }) {
  const cx = 64;
  const cy = 50;
  const r = 34;
  const count = Math.max(1, branches.length);

  return (
    <svg width="128" height="100" viewBox="0 0 128 100" style={{ flexShrink: 0 }}>
      {branches.map((b, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const color = BRANCH_COLORS[b.colorIdx % BRANCH_COLORS.length].accent;
        return (
          <g key={b.id || i}>
            <line
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.65"
            />
            <circle cx={x} cy={y} r="5.5" fill={color} />
          </g>
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r="9"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function HomeView({
  maps,
  settings,
  theme,
  onToggleTheme,
  onCreateMap,
  onOpenMap,
  onDeleteMap,
  onOpenQuiz,
  onOpenChat,
  onOpenSettings,
}) {
  const [input, setInput] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);

  const isLive = Boolean(
    settings.apiKey?.trim() ||
      settings.baseUrl?.includes('localhost') ||
      settings.baseUrl?.includes('127.0.0.1')
  );

  const featuredMap = maps[0];
  const olderMaps = maps.slice(1);

  const handleBuildMap = (e) => {
    e.preventDefault();
    const topic = input.trim();
    if (!topic) return;
    setInput('');
    onCreateMap(topic);
  };

  return (
    <div className="home-canvas" style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="2.5" stroke="#D49B38" strokeWidth="1.8" />
            <circle cx="18" cy="6" r="2.5" stroke="#4D88E5" strokeWidth="1.8" />
            <circle cx="12" cy="18" r="2.5" stroke="#52A87A" strokeWidth="1.8" />
            <path
              d="M8.3 7.2L15.7 7.2M7.2 8.2L10.8 15.8M16.8 8.2L13.2 15.8"
              stroke="var(--muted)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span style={styles.wordmark}>MindLattice</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="ml-btn"
            style={styles.topSupportBtn}
            title="Support Sewak Singh"
          >
            <Heart size={13} color="#E06C52" />
            <span>Support Me</span>
          </button>
          <button
            onClick={onToggleTheme}
            className="ml-btn"
            style={styles.iconBtn}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={onOpenSettings} className="ml-btn" style={styles.apiStatusBtn}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: isLive ? '#52A87A' : settings.useDemoIfNoKey ? '#D49B38' : '#E06C52',
              }}
            />
            <span className="mono" style={{ fontSize: 11.5 }}>
              {isLive
                ? settings.model || 'live'
                : settings.useDemoIfNoKey
                ? 'demo'
                : 'key required'}
            </span>
            <Settings size={13} color="var(--muted)" />
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Editorial Command Studio */}
        <section style={styles.heroSection}>
          <div className="mono" style={styles.kicker}>
            KNOWLEDGE DRAFTING WORKSPACE
          </div>
          <h1 style={styles.heading}>
            Map any idea into a{' '}
            <span className="serif" style={styles.headingItalic}>
              living lattice.
            </span>
          </h1>
          <p style={styles.subheading}>
            Deconstruct complex topics into 3-level visual trees, expand branches on canvas, and check retention.
          </p>

          <form onSubmit={handleBuildMap} className="ml-input-box" style={styles.promptBox}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a topic, concept, or question..."
              style={styles.promptInput}
            />
            <div style={styles.promptActions}>
              <button
                type="button"
                onClick={() => onOpenChat(input.trim())}
                className="ml-btn"
                style={styles.chatBtn}
              >
                <MessageSquare size={14} />
                <span>Chat</span>
              </button>
              <button type="submit" className="ml-btn" style={styles.buildBtn}>
                <span>Build Map</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </section>

        {/* Featured Active Lattice Card */}
        {featuredMap && (
          <section>
            <div style={styles.sectionHeader}>
              <span className="mono" style={styles.sectionLabel}>
                ACTIVE LATTICE
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                {featuredMap.createdAt}
              </span>
            </div>

            <div onClick={() => onOpenMap(featuredMap)} className="ml-node" style={styles.featuredCard}>
              <div style={styles.featuredLeft}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={styles.featuredTitle}>{featuredMap.title}</h2>
                </div>

                <div style={styles.branchPillsRow}>
                  {featuredMap.branches.slice(0, 6).map((b, i) => {
                    const color = BRANCH_COLORS[b.colorIdx % BRANCH_COLORS.length].accent;
                    return (
                      <span key={b.id || i} style={styles.branchChip}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
                        <span>{b.label}</span>
                      </span>
                    );
                  })}
                </div>

                <div style={styles.featuredFooter}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMap(featuredMap);
                    }}
                    className="ml-btn"
                    style={styles.openCanvasBtn}
                  >
                    <span>Open Canvas</span>
                    <ArrowUpRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQuiz(featuredMap);
                    }}
                    className="ml-btn"
                    style={styles.quizOutlineBtn}
                  >
                    <HelpCircle size={13} />
                    <span>Retention Quiz</span>
                  </button>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {(featuredMap.exploredBranchIds || []).length}/{featuredMap.branches.length} explored
                  </span>
                </div>
              </div>

              <div style={styles.previewBox}>
                <MiniLatticePreview branches={featuredMap.branches} />
              </div>
            </div>
          </section>
        )}

        {/* Two-Column Lower Section: Archive + Curated Starters */}
        <div style={styles.columns}>
          {olderMaps.length > 0 && (
            <section>
              <div style={styles.sectionHeader}>
                <span className="mono" style={styles.sectionLabel}>
                  SAVED ARCHIVE
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {olderMaps.length}
                </span>
              </div>

              <div style={styles.tableBox}>
                {olderMaps.map((m, idx) => {
                  const explored = (m.exploredBranchIds || []).length;
                  return (
                    <div
                      key={m.id}
                      onClick={() => onOpenMap(m)}
                      className="ml-row"
                      style={{
                        ...styles.rowItem,
                        borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.rowTitle}>{m.title}</div>
                        <div className="mono" style={styles.rowMeta}>
                          {m.createdAt} · {explored}/{m.branches.length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenQuiz(m);
                        }}
                        className="ml-btn"
                        style={styles.rowActionBtn}
                      >
                        Quiz
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMap(m.id);
                        }}
                        style={styles.trashBtn}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section style={{ gridColumn: olderMaps.length === 0 ? '1 / -1' : 'auto' }}>
            <div style={styles.sectionHeader}>
              <span className="mono" style={styles.sectionLabel}>
                EXPLORE TOPICS
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                1-click map
              </span>
            </div>

            <div style={styles.topicGrid}>
              {TRENDING_TOPICS.slice(0, 6).map((t, idx) => {
                const accent = BRANCH_COLORS[idx % BRANCH_COLORS.length].accent;
                return (
                  <button
                    key={idx}
                    onClick={() => onCreateMap(t.title)}
                    className="ml-row"
                    style={styles.topicCard}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className="mono" style={{ ...styles.catLabel, color: accent }}>
                        {t.category}
                      </span>
                      <ArrowUpRight size={13} color="var(--muted)" />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', textAlign: 'left', lineHeight: 1.35 }}>
                      {t.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer style={styles.footer}>
          <div style={styles.footerText}>
            <span>Made by </span>
            <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Sewak Singh</strong>
            <span> · Free for everyone</span>
          </div>
        </footer>
      </main>

      {supportOpen && (
        <div style={styles.modalOverlay} onClick={() => setSupportOpen(false)}>
          <div style={styles.supportModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 16 }}>
                <Heart size={16} color="#E06C52" />
                <span>Support Sewak Singh</span>
              </div>
              <button onClick={() => setSupportOpen(false)} style={styles.closeBtn}>
                <X size={15} />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              <strong>MindLattice</strong> is built freely for everyone to think clearly and learn faster. If you find it useful, your support keeps it going!
            </p>
            <a
              href="https://buymeacoffee.com/sewak_singh"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-btn"
              style={styles.bmcLink}
            >
              <Heart size={14} color="#E06C52" />
              <span>Support on Buy Me a Coffee</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  header: {
    width: '100%',
    borderBottom: '1px solid var(--border)',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backdropFilter: 'blur(8px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },
  wordmark: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: -0.3,
    color: 'var(--text)',
  },
  topSupportBtn: {
    background: 'rgba(224, 108, 82, 0.12)',
    border: '1px solid rgba(224, 108, 82, 0.32)',
    color: 'var(--text)',
    borderRadius: 6,
    height: 30,
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  iconBtn: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-soft)',
    width: 30,
    height: 30,
    borderRadius: 6,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  apiStatusBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-soft)',
    borderRadius: 6,
    height: 30,
    padding: '0 10px',
    cursor: 'pointer',
  },
  main: {
    width: '100%',
    maxWidth: 980,
    margin: '0 auto',
    padding: '40px 24px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 34,
  },
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: 'var(--muted)',
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(28px, 4vw, 38px)',
    fontWeight: 600,
    letterSpacing: -0.8,
    lineHeight: 1.12,
    color: 'var(--text)',
  },
  headingItalic: {
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: 'clamp(32px, 4.4vw, 44px)',
    letterSpacing: -0.4,
  },
  subheading: {
    margin: '0 0 6px',
    fontSize: 14,
    color: 'var(--text-soft)',
    maxWidth: 560,
    lineHeight: 1.5,
  },
  promptBox: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: 7,
    boxShadow: '0 6px 22px var(--shadow)',
  },
  promptInput: {
    flex: '1 1 260px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 14,
    padding: '8px 12px',
    outline: 'none',
  },
  promptActions: {
    display: 'flex',
    gap: 6,
  },
  chatBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-soft)',
    borderRadius: 7,
    padding: '8px 13px',
    fontSize: 13,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  buildBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'var(--accent-inv)',
    borderRadius: 7,
    padding: '8px 15px',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.8,
    color: 'var(--muted)',
  },
  featuredCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 12,
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    boxShadow: '0 6px 22px var(--shadow)',
    cursor: 'pointer',
  },
  featuredLeft: {
    flex: '1 1 320px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  featuredTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: -0.3,
    color: 'var(--text)',
  },
  branchPillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  branchChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11.5,
    color: 'var(--text-soft)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 9px',
  },
  featuredFooter: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  openCanvasBtn: {
    background: 'var(--accent)',
    color: 'var(--accent-inv)',
    border: 'none',
    borderRadius: 7,
    padding: '7px 13px',
    fontSize: 12.5,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  quizOutlineBtn: {
    background: 'transparent',
    color: 'var(--text-soft)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '7px 12px',
    fontSize: 12.5,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  previewBox: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '6px 10px',
    display: 'grid',
    placeItems: 'center',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
    alignItems: 'start',
  },
  tableBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  rowItem: {
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowMeta: {
    fontSize: 11,
    color: 'var(--muted)',
    marginTop: 3,
  },
  rowActionBtn: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-soft)',
    borderRadius: 5,
    padding: '4px 9px',
    fontSize: 11.5,
    fontWeight: 500,
    cursor: 'pointer',
  },
  trashBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'grid',
    placeItems: 'center',
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 10,
  },
  topicCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '13px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    cursor: 'pointer',
  },
  catLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  footer: {
    marginTop: 14,
    paddingTop: 18,
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerText: {
    fontSize: 12.5,
    color: 'var(--muted)',
  },
  supportBtn: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 7,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 100,
    padding: 16,
  },
  supportModal: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 12,
    padding: 20,
    color: 'var(--text)',
    boxShadow: '0 20px 50px var(--shadow)',
  },
  closeBtn: {
    background: 'var(--surface-2)',
    border: 'none',
    color: 'var(--text-soft)',
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  bmcLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    background: 'var(--accent)',
    color: 'var(--accent-inv)',
    textDecoration: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13.5,
    fontWeight: 600,
  },
};
