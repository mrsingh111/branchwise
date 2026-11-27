import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Maximize2,
  Sparkles,
  Download,
  Send,
  Loader2,
  Plus,
  CheckCircle2,
  HelpCircle,
  X,
  ZoomIn,
  ZoomOut,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { BRANCH_COLORS } from '../data/presets';
import { askAboutMap, expandNodeWithAI } from '../services/aiProvider';

const CANVAS_W = 3600;
const CANVAS_H = 3000;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function getBranchAngles(count) {
  const start = -Math.PI / 2;
  return Array.from({ length: count }, (_, i) => start + (i * 2 * Math.PI) / count);
}

// Push overlapping rectangles apart so no two cards ever collide on canvas
function resolveOverlaps(items, fixedCount, iterations = 30, pad = 20) {
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const overlapX = (a.w + b.w) / 2 + pad - Math.abs(a.x - b.x);
        const overlapY = (a.h + b.h) / 2 + pad - Math.abs(a.y - b.y);
        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          const aFixed = i < fixedCount;
          const bFixed = j < fixedCount;
          if (aFixed && bFixed) continue;

          if (overlapX < overlapY) {
            const sign = b.x >= a.x ? 1 : -1;
            const shift = overlapX;
            if (aFixed) b.x += sign * shift;
            else if (bFixed) a.x -= sign * shift;
            else {
              a.x -= sign * shift * 0.5;
              b.x += sign * shift * 0.5;
            }
          } else {
            const sign = b.y >= a.y ? 1 : -1;
            const shift = overlapY;
            if (aFixed) b.y += sign * shift;
            else if (bFixed) a.y -= sign * shift;
            else {
              a.y -= sign * shift * 0.5;
              b.y += sign * shift * 0.5;
            }
          }
        }
      }
    }
    if (!moved) break;
  }
}

export default function MindMapView({
  map,
  settings,
  theme,
  onToggleTheme,
  onUpdateMap,
  onBack,
  onOpenQuiz,
  onOpenSettings,
}) {
  const [expandedBranches, setExpandedBranches] = useState(() => new Set());
  const [selectedNode, setSelectedNode] = useState(null); // { branch, node, isBranch }
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.82);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Ask about this map
  const [askInput, setAskInput] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askHistory, setAskHistory] = useState([]);
  const [latestReply, setLatestReply] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);

  const layout = useMemo(() => {
    const angles = getBranchAngles(map.branches.length);
    const branchRadius = 320;
    const childRadius = 290;
    const leafRadius = 245;

    const rawBranches = map.branches.map((branch, idx) => {
      const angle = angles[idx];
      const bx = CX + Math.cos(angle) * branchRadius;
      const by = CY + Math.sin(angle) * branchRadius;
      const color = BRANCH_COLORS[branch.colorIdx % BRANCH_COLORS.length];

      const isExpanded = expandedBranches.has(branch.id);
      const children = isExpanded ? branch.children || [] : [];
      const sectorLimit = (2 * Math.PI) / Math.max(1, map.branches.length);
      const spread = Math.min(sectorLimit * 0.92, 0.48 * Math.max(1, children.length - 1));

      const childPositions = children.map((child, cIdx) => {
        const offset =
          children.length === 1
            ? 0
            : -spread / 2 + (cIdx / (children.length - 1)) * spread;
        const cAngle = angle + offset;
        const r = children.length >= 3 && cIdx % 2 === 1 ? childRadius + 58 : childRadius;
        const px = bx + Math.cos(cAngle) * r;
        const py = by + Math.sin(cAngle) * r;

        const lx = px + Math.cos(cAngle) * leafRadius;
        const ly = py + Math.sin(cAngle) * leafRadius;

        return {
          ...child,
          x: px,
          y: py,
          lx,
          ly,
          cAngle,
        };
      });

      return { branch, bx, by, angle, color, isExpanded, childPositions };
    });

    // Build AABB list: [center, ...branches, ...children, ...leaves]
    const boxes = [{ x: CX, y: CY, w: 240, h: 76 }];
    rawBranches.forEach((b) => {
      boxes.push({ x: b.bx, y: b.by, w: b.isExpanded ? 245 : 210, h: b.isExpanded ? 105 : 48 });
    });
    const fixedCount = boxes.length;

    const childRefs = [];
    const leafRefs = [];
    rawBranches.forEach((b) => {
      b.childPositions.forEach((cp) => {
        const cBox = { x: cp.x, y: cp.y, w: 195, h: 56 };
        boxes.push(cBox);
        childRefs.push({ cp, box: cBox });
        if (cp.summary) {
          const lBox = { x: cp.lx, y: cp.ly, w: 215, h: 108 };
          boxes.push(lBox);
          leafRefs.push({ cp, box: lBox });
        }
      });
    });

    resolveOverlaps(boxes, fixedCount, 35, 22);

    childRefs.forEach(({ cp, box }) => {
      cp.x = box.x;
      cp.y = box.y;
    });
    leafRefs.forEach(({ cp, box }) => {
      cp.lx = box.x;
      cp.ly = box.y;
    });

    return rawBranches;
  }, [map.branches, expandedBranches]);

  const markBranchExplored = (branchId) => {
    const existing = new Set(map.exploredBranchIds || []);
    if (!existing.has(branchId)) {
      existing.add(branchId);
      onUpdateMap({ ...map, exploredBranchIds: Array.from(existing) });
    }
  };

  const toggleBranch = (branch, bx, by) => {
    const willExpand = !expandedBranches.has(branch.id);
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch.id)) next.delete(branch.id);
      else next.add(branch.id);
      return next;
    });
    markBranchExplored(branch.id);
    setSelectedNode({ branch, node: branch, isBranch: true });

    // Gently pan toward the expanded branch so its sub-tree + explanations are in view
    if (willExpand) {
      setPan({
        x: Math.round((CX - bx) * zoom * 0.72),
        y: Math.round((CY - by) * zoom * 0.72),
      });
    }
  };

  const handleGoDeeper = async () => {
    if (!selectedNode || deepLoading) return;
    setDeepLoading(true);
    try {
      const newChildren = await expandNodeWithAI(
        map,
        selectedNode.branch,
        selectedNode.node,
        settings
      );
      const updatedBranches = map.branches.map((b) => {
        if (b.id !== selectedNode.branch.id) return b;
        return { ...b, children: [...(b.children || []), ...newChildren] };
      });
      onUpdateMap({ ...map, branches: updatedBranches });
      setExpandedBranches((prev) => new Set(prev).add(selectedNode.branch.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeepLoading(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    const q = askInput.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskInput('');
    try {
      const res = await askAboutMap(map, q, askHistory, settings);
      setAskHistory((prev) => [
        ...prev,
        { role: 'user', text: q },
        { role: 'assistant', text: res.answer },
      ]);
      setLatestReply({ question: q, ...res });
      if (res.referencedNodeIds?.length) {
        setHighlightedIds(new Set(res.referencedNodeIds));
        setExpandedBranches((prev) => {
          const next = new Set(prev);
          map.branches.forEach((b) => {
            if (
              res.referencedNodeIds.includes(b.id) ||
              b.children?.some((c) => res.referencedNodeIds.includes(c.id))
            ) {
              next.add(b.id);
            }
          });
          return next;
        });
      }
    } catch (err) {
      setLatestReply({
        question: q,
        answer: `⚠️ ${err.message}`,
        referencedNodeIds: [],
        suggestedNodes: [],
      });
    } finally {
      setAskLoading(false);
    }
  };

  const addSuggestedNode = (suggestion) => {
    const targetBranchId = suggestion.parentBranchId || map.branches[0]?.id;
    const newId = `ai-${Math.random().toString(36).slice(2, 7)}`;
    const updatedBranches = map.branches.map((b) => {
      if (b.id !== targetBranchId) return b;
      return {
        ...b,
        children: [
          ...(b.children || []),
          { id: newId, label: suggestion.label, summary: suggestion.summary },
        ],
      };
    });
    onUpdateMap({ ...map, branches: updatedBranches });
    setExpandedBranches((prev) => new Set(prev).add(targetBranchId));
    setHighlightedIds(new Set([newId]));
    setLatestReply((prev) =>
      prev
        ? {
            ...prev,
            suggestedNodes: prev.suggestedNodes.filter((s) => s !== suggestion),
          }
        : null
    );
  };

  const focusNodeById = (id) => {
    setHighlightedIds(new Set([id]));
    for (const item of layout) {
      if (item.branch.id === id) {
        setExpandedBranches((prev) => new Set(prev).add(item.branch.id));
        setSelectedNode({ branch: item.branch, node: item.branch, isBranch: true });
        setPan({
          x: Math.round((CX - item.bx) * zoom * 0.7),
          y: Math.round((CY - item.by) * zoom * 0.7),
        });
        return;
      }
      const child = item.branch.children?.find((c) => c.id === id);
      if (child) {
        setExpandedBranches((prev) => new Set(prev).add(item.branch.id));
        setSelectedNode({ branch: item.branch, node: child, isBranch: false });
        setPan({
          x: Math.round((CX - item.bx) * zoom * 0.7),
          y: Math.round((CY - item.by) * zoom * 0.7),
        });
        return;
      }
    }
  };

  const exportMarkdown = () => {
    const md = [
      `# ${map.title}`,
      '',
      ...map.branches.flatMap((b) => [
        `## ${b.label}`,
        b.summary,
        ...(b.children || []).map((c) => `- **${c.label}**: ${c.summary}`),
        '',
      ]),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('[data-node]')) return;
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const exploredCount = (map.exploredBranchIds || []).length;
  const searchLower = searchQuery.trim().toLowerCase();

  return (
    <div
      className="blueprint-grid"
      style={styles.container}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={(e) => {
        if (e.target.closest('[data-scrollable]')) return;
        const delta = e.deltaY > 0 ? -0.06 : 0.06;
        setZoom((z) => Math.min(1.6, Math.max(0.38, +(z + delta).toFixed(2))));
      }}
    >
      {/* Top Bar */}
      <header style={styles.topBar} className="no-print">
        <button onClick={onBack} style={styles.roundBtn} title="Back to Home">
          <ArrowLeft size={18} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <span style={styles.mapTitle}>{map.title}</span>
            <span style={styles.progressPill}>
              {exploredCount}/{map.branches.length} explored
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Click any branch to expand sub-nodes and notes
          </div>
        </div>

        <button onClick={onOpenQuiz} style={styles.quizBtn}>
          <HelpCircle size={15} />
          <span>Quiz</span>
        </button>

        <button onClick={exportMarkdown} style={styles.roundBtn} title="Export Markdown">
          <Download size={16} />
        </button>

        <button
          onClick={onToggleTheme}
          style={styles.roundBtn}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button onClick={onOpenSettings} style={styles.roundBtn} title="AI API Settings">
          <Settings size={16} />
        </button>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div style={styles.searchBar} className="no-print">
          <Search size={15} color="#9898A6" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes in this map..."
            style={styles.searchInput}
          />
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            style={styles.tinyClose}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Radial 3-Level Mind Map Canvas */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: draggingRef.current ? 'none' : 'transform 0.2s ease-out',
          userSelect: 'none',
        }}
      >
        <svg
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {layout.map(({ branch, bx, by, color, childPositions }) => {
            const midX = (CX + bx) / 2;
            const midY = (CY + by) / 2 + (bx > CX ? -24 : 24);
            return (
              <g key={branch.id}>
                {/* Level 0 -> Level 1 curve */}
                <path
                  d={`M ${CX} ${CY} Q ${midX} ${midY} ${bx} ${by}`}
                  stroke={color.line}
                  strokeWidth="2.2"
                  fill="none"
                  opacity="0.85"
                />
                {/* Level 1 -> Level 2 curves & Level 2 -> Level 3 explanation curves */}
                {childPositions.map((cp) => {
                  const cmx = (bx + cp.x) / 2;
                  const cmy = (by + cp.y) / 2 + (cp.x > bx ? -18 : 18);
                  const lmx = (cp.x + cp.lx) / 2 + (cp.x > bx ? 14 : -14);
                  const lmy = (cp.y + cp.ly) / 2;
                  return (
                    <g key={cp.id}>
                      <path
                        d={`M ${bx} ${by} Q ${cmx} ${cmy} ${cp.x} ${cp.y}`}
                        stroke={color.line}
                        strokeWidth="1.7"
                        fill="none"
                        opacity="0.75"
                      />
                      {cp.summary && (
                        <path
                          d={`M ${cp.x} ${cp.y} Q ${lmx} ${lmy} ${cp.lx} ${cp.ly}`}
                          stroke={color.line}
                          strokeWidth="1.4"
                          fill="none"
                          opacity="0.6"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Central Topic Node */}
        <div
          data-node
          onClick={() => setSelectedNode(null)}
          style={{
            ...styles.centerNode,
            left: CX,
            top: CY,
          }}
        >
          {map.title}
        </div>

        {/* Level 1 Branch Cards, Level 2 Sub-Branch Pills, Level 3 Leaf Explanations */}
        {layout.map(({ branch, bx, by, color, isExpanded, childPositions }) => {
          const isMatched =
            searchLower && branch.label.toLowerCase().includes(searchLower);
          const isHighlighted = highlightedIds.has(branch.id) || isMatched;
          const isExplored = (map.exploredBranchIds || []).includes(branch.id);

          return (
            <React.Fragment key={branch.id}>
              {/* Level 1: Architectural Branch Card with left accent stripe */}
              <div
                data-node
                className="ml-node"
                onClick={() => toggleBranch(branch, bx, by)}
                style={{
                  ...styles.branchNode,
                  left: bx,
                  top: by,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${color.accent}`,
                  borderRadius: 12,
                  maxWidth: isExpanded ? 240 : 205,
                  padding: isExpanded ? '12px 15px' : '10px 16px',
                  boxShadow: isHighlighted
                    ? `0 0 0 2px ${color.accent}, 0 12px 28px var(--shadow)`
                    : '0 8px 22px var(--shadow)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                  {branch.label}
                </div>
                {isExpanded && branch.summary && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      lineHeight: 1.4,
                      marginTop: 6,
                      color: 'var(--text-soft)',
                    }}
                  >
                    {branch.summary}
                  </div>
                )}
                <span
                  style={{
                    ...styles.badge,
                    background: isExplored ? color.accent : 'var(--surface-2)',
                    color: isExplored ? '#FFFFFF' : color.accent,
                    borderColor: color.accent,
                  }}
                >
                  {isExpanded ? '−' : `+${branch.children?.length || 0}`}
                </span>
              </div>

              {/* Level 2 Sub-Nodes + Level 3 Callout Explanations */}
              {childPositions.map((cp) => {
                const cMatch =
                  searchLower &&
                  (cp.label.toLowerCase().includes(searchLower) ||
                    cp.summary?.toLowerCase().includes(searchLower));
                const cHigh = highlightedIds.has(cp.id) || cMatch;
                return (
                  <React.Fragment key={cp.id}>
                    <div
                      data-node
                      className="ml-node"
                      onClick={() =>
                        setSelectedNode({ branch, node: cp, isBranch: false })
                      }
                      style={{
                        ...styles.childNode,
                        left: cp.x,
                        top: cp.y,
                        borderColor: cHigh ? color.accent : 'var(--border)',
                        boxShadow: cHigh
                          ? `0 0 0 2px ${color.accent}, 0 8px 20px var(--shadow)`
                          : '0 6px 16px var(--shadow)',
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: color.accent,
                          flexShrink: 0,
                        }}
                      />
                      <span>{cp.label}</span>
                    </div>

                    {/* Level 3: Callout explanation card right on the canvas */}
                    {cp.summary && (
                      <div
                        data-node
                        onClick={() =>
                          setSelectedNode({ branch, node: cp, isBranch: false })
                        }
                        style={{
                          ...styles.leafText,
                          left: cp.lx,
                          top: cp.ly,
                          borderLeft: `2.5px solid ${color.accent}`,
                        }}
                      >
                        {cp.summary}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Compact Node Action Card (Go Deeper with AI) */}
      {selectedNode && (
        <div data-scrollable style={styles.inspector} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B9A7FF', textTransform: 'uppercase' }}>
              {selectedNode.isBranch ? 'Branch' : selectedNode.branch.label}
            </span>
            <button onClick={() => setSelectedNode(null)} style={styles.tinyClose}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 8px' }}>
            {selectedNode.node.label}
          </div>
          <button onClick={handleGoDeeper} disabled={deepLoading} style={styles.goDeeperBtn}>
            {deepLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{deepLoading ? 'Expanding...' : 'Go Deeper with AI (+sub-nodes)'}</span>
          </button>
        </div>
      )}

      {/* Ask About This Map Reply Card */}
      {latestReply && (
        <div data-scrollable style={styles.replyCard} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#A8E5FA', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={12} /> Answer · {latestReply.question}
            </span>
            <button onClick={() => setLatestReply(null)} style={styles.tinyClose}>
              <X size={14} />
            </button>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {latestReply.answer}
          </p>

          {latestReply.referencedNodeIds?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {latestReply.referencedNodeIds.map((id) => (
                <button
                  key={id}
                  onClick={() => focusNodeById(id)}
                  style={styles.refPill}
                >
                  ↗ Jump to {id}
                </button>
              ))}
            </div>
          )}

          {latestReply.suggestedNodes?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
              <span style={{ fontSize: 11, color: '#9898A6' }}>Add new idea to map:</span>
              {latestReply.suggestedNodes.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => addSuggestedNode(s)}
                  style={styles.addSuggestBtn}
                >
                  <Plus size={13} />
                  <span>
                    <strong>{s.label}</strong> — {s.summary}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls + Ask About This Map */}
      <div style={styles.bottomDock} className="no-print">
        <div style={styles.toolbarRow}>
          <div style={styles.toolGroup}>
            <button onClick={() => setZoom((z) => Math.max(0.38, +(z - 0.12).toFixed(2)))} style={styles.toolBtn} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(0.82); }} style={styles.toolBtn} title="Fit to screen">
              <Maximize2 size={15} />
            </button>
            <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.12).toFixed(2)))} style={styles.toolBtn} title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => setSearchOpen((s) => !s)} style={styles.toolBtn} title="Search nodes">
              <Search size={15} />
            </button>
            <button
              onClick={() => {
                if (expandedBranches.size === map.branches.length) {
                  setExpandedBranches(new Set());
                } else {
                  setExpandedBranches(new Set(map.branches.map((b) => b.id)));
                }
              }}
              style={{ ...styles.toolBtn, width: 'auto', padding: '0 10px', fontSize: 12 }}
            >
              <CheckCircle2 size={14} style={{ marginRight: 5 }} />
              {expandedBranches.size === map.branches.length ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>

        <form onSubmit={handleAsk} className="ml-input-box" style={styles.askBar}>
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            placeholder="Query this lattice or propose new nodes..."
            style={styles.askInput}
          />
          <button type="submit" disabled={askLoading || !askInput.trim()} style={styles.askBtn}>
            {askLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    cursor: 'grab',
  },
  topBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'var(--top-fade)',
    borderBottom: '1px solid var(--border)',
    backdropFilter: 'blur(8px)',
  },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-soft)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressPill: {
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 4,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  quizBtn: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 6,
    height: 32,
    padding: '0 11px',
    fontSize: 12,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  searchBar: {
    position: 'fixed',
    top: 66,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '7px 14px',
    width: 'min(360px, 90vw)',
    boxShadow: '0 8px 24px var(--shadow)',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  },
  tinyClose: {
    background: 'var(--surface-2)',
    border: 'none',
    color: 'var(--text-soft)',
    width: 24,
    height: 24,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  centerNode: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: 'var(--center-bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '14px 20px',
    maxWidth: 230,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.35,
    color: 'var(--text)',
    boxShadow: '0 4px 16px var(--shadow)',
    cursor: 'pointer',
  },
  branchNode: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'transform 0.12s ease',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -6,
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid',
  },
  childNode: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: 'var(--child-bg)',
    border: '1px solid',
    borderRadius: 6,
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    maxWidth: 185,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    textAlign: 'left',
    cursor: 'pointer',
  },
  leafText: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: 205,
    fontSize: 11.5,
    lineHeight: 1.42,
    color: 'var(--text-soft)',
    textAlign: 'left',
    background: 'var(--leaf-bg)',
    border: '1px solid var(--border)',
    padding: '7px 9px',
    borderRadius: 6,
    boxShadow: '0 2px 8px var(--shadow)',
    cursor: 'pointer',
  },
  inspector: {
    position: 'fixed',
    top: 72,
    right: 16,
    zIndex: 25,
    width: 'min(260px, 85vw)',
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 14px 34px var(--shadow)',
  },
  goDeeperBtn: {
    width: '100%',
    background: 'rgba(124,108,255,0.18)',
    border: '1px solid rgba(124,108,255,0.35)',
    color: 'var(--purple)',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  replyCard: {
    position: 'fixed',
    bottom: 118,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    width: 'min(620px, 92vw)',
    maxHeight: 260,
    overflowY: 'auto',
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(124,108,255,0.28)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 18px 44px var(--shadow)',
  },
  refPill: {
    background: 'rgba(124,108,255,0.12)',
    border: '1px solid rgba(124,108,255,0.3)',
    color: 'var(--purple)',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  addSuggestBtn: {
    background: 'rgba(74,222,128,0.12)',
    border: '1px solid rgba(74,222,128,0.3)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '7px 10px',
    fontSize: 12,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    textAlign: 'left',
    cursor: 'pointer',
  },
  bottomDock: {
    position: 'fixed',
    bottom: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(620px, 94vw)',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  toolbarRow: {
    display: 'flex',
    justifyContent: 'center',
  },
  toolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 3,
    boxShadow: '0 2px 10px var(--shadow)',
  },
  toolBtn: {
    height: 28,
    width: 30,
    borderRadius: 5,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-soft)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  askBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '5px 5px 5px 14px',
    boxShadow: '0 4px 16px var(--shadow)',
  },
  askInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  },
  askBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-inv)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
};
