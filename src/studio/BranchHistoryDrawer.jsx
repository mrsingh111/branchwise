import React, { useMemo, useState } from 'react';
import { GitBranch, History, Plus, RotateCcw, Check, GitCompare, X, Edit2 } from 'lucide-react';
import { compareBranchVersions } from '../storage/db';

export default function BranchHistoryDrawer({
  open,
  onClose,
  doc,
  activeBranch,
  onSwitchBranch,
  onCreateBranch,
  onRenameBranch,
  onSaveSnapshot,
  onRestoreSnapshot,
}) {
  const [newBranchName, setNewBranchName] = useState('');
  const [snapLabel, setSnapLabel] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  const versions = activeBranch?.versions || [];

  const diffResult = useMemo(() => {
    if (!compareA || !compareB || compareA === compareB) return null;
    const vA = versions.find((v) => v.id === compareA);
    const vB = versions.find((v) => v.id === compareB);
    if (!vA || !vB) return null;
    return compareBranchVersions(vA, vB);
  }, [compareA, compareB, versions]);

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <aside style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <GitBranch size={17} color="#6E8AE6" />
            <h3 style={styles.title}>Branches & Version History</h3>
          </div>
          <button onClick={onClose} style={styles.iconBtn} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div style={styles.scroll}>
          {/* Local Branches Section */}
          <section style={styles.section}>
            <div style={styles.secTitle}>Local Branches ({doc.branches.length})</div>
            <p style={styles.hint}>
              Branches are independent local alternatives of this diagram. Switch or duplicate anytime without altering the original.
            </p>
            <div style={styles.branchList}>
              {doc.branches.map((b) => {
                const isActive = b.id === activeBranch?.id;
                return (
                  <div
                    key={b.id}
                    style={{
                      ...styles.branchItem,
                      borderColor: isActive ? '#6E8AE6' : 'var(--border)',
                      background: isActive ? 'rgba(110, 138, 230, 0.1)' : 'var(--surface-2)',
                    }}
                  >
                    {renamingId === b.id ? (
                      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        <input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameBranch(b.id, renameVal);
                              setRenamingId(null);
                            }
                          }}
                          style={styles.smallInput}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            onRenameBranch(b.id, renameVal);
                            setRenamingId(null);
                          }}
                          style={styles.smallBtn}
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSwitchBranch(b.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GitBranch size={13} color={isActive ? '#6E8AE6' : 'var(--muted)'} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
                            {isActive && <span style={styles.activePill}>Active</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {(b.nodes || []).length} nodes · {(b.versions || []).length} snapshots
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setRenamingId(b.id);
                            setRenameVal(b.name);
                          }}
                          style={styles.iconBtn}
                          title="Rename branch"
                        >
                          <Edit2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onCreateBranch(newBranchName);
                setNewBranchName('');
              }}
              style={styles.rowForm}
            >
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="New branch name (e.g. v2-async)"
                style={styles.smallInput}
              />
              <button type="submit" style={styles.primaryBtn}>
                <Plus size={14} /> Branch
              </button>
            </form>
          </section>

          {/* Snapshots Section */}
          <section style={styles.section}>
            <div style={styles.secTitle}>
              <History size={13} /> Version Timeline ({versions.length})
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveSnapshot(snapLabel);
                setSnapLabel('');
              }}
              style={styles.rowForm}
            >
              <input
                value={snapLabel}
                onChange={(e) => setSnapLabel(e.target.value)}
                placeholder="Snapshot label (e.g. Before refactor)"
                style={styles.smallInput}
              />
              <button type="submit" style={styles.primaryBtn}>
                Save
              </button>
            </form>

            {versions.length === 0 ? (
              <div style={styles.empty}>No snapshots saved yet on this branch.</div>
            ) : (
              <div style={styles.timeline}>
                {versions.map((v) => (
                  <div key={v.id} style={styles.verItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{v.label}</span>
                        {v.auto && <span style={styles.autoBadge}>Auto</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {new Date(v.createdAt).toLocaleString()} · {(v.snapshot?.nodes || []).length} nodes
                      </div>
                    </div>
                    <button onClick={() => onRestoreSnapshot(v.id)} style={styles.restoreBtn} title="Restore this version">
                      <RotateCcw size={12} /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Compare Versions */}
          {versions.length >= 2 && (
            <section style={styles.section}>
              <div style={styles.secTitle}>
                <GitCompare size={13} /> Compare Two Versions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select value={compareA} onChange={(e) => setCompareA(e.target.value)} style={styles.select}>
                  <option value="">Baseline (A)...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select value={compareB} onChange={(e) => setCompareB(e.target.value)} style={styles.select}>
                  <option value="">Target (B)...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              {diffResult && (
                <div style={styles.diffBox}>
                  <div style={{ color: '#52A87A' }}>+ Added nodes: {diffResult.addedNodes.length}</div>
                  <div style={{ color: '#E06C75' }}>- Removed nodes: {diffResult.removedNodes.length}</div>
                  <div style={{ color: '#D49B38' }}>~ Modified nodes: {diffResult.modifiedNodes.length}</div>
                  <div style={{ color: 'var(--text-soft)', marginTop: 4 }}>
                    Connectors: +{diffResult.addedEdges.length} / -{diffResult.removedEdges.length}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 90,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: '100%',
    maxWidth: 400,
    height: '100%',
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border-strong)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  scroll: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  secTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted)',
  },
  hint: { margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 },
  branchList: { display: 'flex', flexDirection: 'column', gap: 6 },
  branchItem: {
    padding: '9px 11px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  activePill: {
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 999,
    background: '#6E8AE6',
    color: '#fff',
  },
  rowForm: { display: 'flex', gap: 6 },
  smallInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12.5,
    outline: 'none',
  },
  primaryBtn: {
    padding: '7px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-inv)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  smallBtn: {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  timeline: { display: 'flex', flexDirection: 'column', gap: 6 },
  verItem: {
    padding: '9px 11px',
    borderRadius: 9,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  autoBadge: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'var(--bg)',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
  },
  restoreBtn: {
    padding: '5px 9px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 11.5,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  empty: { fontSize: 12, color: 'var(--muted)', padding: '8px 0' },
  select: {
    padding: '7px 8px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12,
  },
  diffBox: {
    padding: 10,
    borderRadius: 9,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    fontSize: 12,
    lineHeight: 1.6,
    fontFamily: 'JetBrains Mono, monospace',
  },
};
