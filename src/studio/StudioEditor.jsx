import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Magnet,
  Code2,
  GitBranch,
  Download,
  Upload,
  Sun,
  Moon,
  Search,
  Layers,
  Shapes,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Group,
  Ungroup,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Eye,
  EyeOff,
  PanelLeft,
  PanelRight,
  MousePointer2,
  Hand,
  LayoutGrid,
  X,
} from 'lucide-react';
import {
  SHAPE_GROUPS,
  COLOR_SWATCHES,
  getNodePorts,
  buildEdgePath,
  alignSelectedNodes,
  distributeSelectedNodes,
  applyGridAutoLayout,
} from './shapeCatalog';
import {
  autoLayoutNodes,
  detectMermaidType,
  parseMermaid,
  serializeToMermaid,
  validateMermaid,
} from '../mermaid/mermaidEngine';
import { parseCsvToDiagram } from '../mermaid/csvImport';
import {
  generateDiagramSVG,
  exportDiagramPNG,
  exportDiagramPDF,
  downloadTextFile,
} from './exportEngine';
import BranchHistoryDrawer from './BranchHistoryDrawer';
import {
  createBranchSnapshot,
  createDuplicateBranch,
  getActiveBranch,
  makeId,
  renameBranchById,
  restoreBranchSnapshot,
  switchActiveBranch,
  updateActiveBranch,
} from '../storage/db';

const GRID_SIZE = 20;
const snapVal = (v, enabled) => (enabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : v);

function renderShapeSVG(node, isSelected, conditionalColor, isDark) {
  const { w, h, shape, label, fill, stroke, textColor, fontSize = 13, metadata } = node;
  const bg =
    fill ||
    conditionalColor?.fill ||
    (shape === 'container'
      ? 'rgba(110,138,230,0.05)'
      : shape === 'sticky'
      ? 'rgba(250,204,21,0.22)'
      : 'var(--surface)');
  const border =
    stroke ||
    conditionalColor?.stroke ||
    (isSelected ? '#6E8AE6' : shape === 'container' ? 'var(--border-strong)' : isDark ? '#4B5563' : '#94A3B8');
  const fg = textColor || 'var(--text)';
  const cx = w / 2;
  const cy = h / 2;

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
      {shape === 'diamond' || shape === 'decision' ? (
        <polygon
          points={`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`}
          fill={bg}
          stroke={border}
          strokeWidth={isSelected ? 2.5 : 1.8}
        />
      ) : shape === 'circle' ? (
        <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={bg} stroke={border} strokeWidth={isSelected ? 2.5 : 1.8} />
      ) : shape === 'database' ? (
        <>
          <path
            d={`M 0 12 L 0 ${h - 12} A ${w / 2} 12 0 0 0 ${w} ${h - 12} L ${w} 12 Z`}
            fill={bg}
            stroke={border}
            strokeWidth={isSelected ? 2.5 : 1.8}
          />
          <ellipse cx={cx} cy={12} rx={w / 2} ry={12} fill={bg} stroke={border} strokeWidth={isSelected ? 2.5 : 1.8} />
        </>
      ) : shape === 'document' ? (
        <path
          d={`M 0 0 L ${w} 0 L ${w} ${h - 10} Q ${w * 0.75} ${h + 4} ${cx} ${h - 8} T 0 ${h - 8} Z`}
          fill={bg}
          stroke={border}
          strokeWidth={isSelected ? 2.5 : 1.8}
        />
      ) : shape === 'container' ? (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={12}
          fill={bg}
          stroke={border}
          strokeWidth={isSelected ? 2.5 : 1.8}
          strokeDasharray="7 5"
        />
      ) : shape === 'text' ? (
        <rect x={0} y={0} width={w} height={h} rx={4} fill="transparent" stroke={isSelected ? '#6E8AE6' : 'transparent'} strokeDasharray="4 3" />
      ) : (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={shape === 'start' || shape === 'end' ? h / 2 : shape === 'rounded' ? 14 : 8}
          fill={bg}
          stroke={border}
          strokeWidth={isSelected ? 2.5 : 1.8}
        />
      )}

      {(shape === 'class' || shape === 'er_table') && Array.isArray(metadata?.members || metadata?.columns) ? (
        <>
          <line x1={0} y1={34} x2={w} y2={34} stroke={border} strokeWidth="1.4" />
          <text x={cx} y={22} textAnchor="middle" fill={fg} fontSize={fontSize} fontWeight="700">
            {label}
          </text>
          {(metadata.members || metadata.columns || []).slice(0, 6).map((row, idx) => (
            <text key={idx} x={10} y={53 + idx * 18} fill="var(--text-soft)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {row}
            </text>
          ))}
        </>
      ) : shape === 'container' ? (
        <text x={14} y={22} fill="var(--text-soft)" fontSize="12" fontWeight="700">
          {label}
        </text>
      ) : (
        <text x={cx} y={cy + 4} textAnchor="middle" fill={fg} fontSize={fontSize} fontWeight="600">
          {label}
        </text>
      )}
    </svg>
  );
}

export default function StudioEditor({
  doc,
  theme,
  saveStatus,
  onToggleTheme,
  onUpdateDoc,
  onBack,
  onOpenTemplates,
}) {
  const activeBranch = useMemo(() => getActiveBranch(doc), [doc]);
  const nodes = activeBranch?.nodes || [];
  const edges = activeBranch?.edges || [];
  const layers = activeBranch?.layers || [{ id: 'layer_default', name: 'Default Layer', visible: true, locked: false }];

  const isMobileInit = typeof window !== 'undefined' && window.innerWidth < 768;
  const [isNarrow, setIsNarrow] = useState(isMobileInit);

  const [tool, setTool] = useState('select'); // 'select' | 'pan'
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [viewport, setViewport] = useState(() => activeBranch?.viewport || { x: 80, y: 80, zoom: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [leftOpen, setLeftOpen] = useState(!isMobileInit);
  const [rightOpen, setRightOpen] = useState(!isMobileInit);

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < 768;
      setIsNarrow(narrow);
      if (narrow) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [leftTab, setLeftTab] = useState('shapes'); // 'shapes' | 'layers' | 'find'
  const [shapeSearch, setShapeSearch] = useState('');
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [splitMermaid, setSplitMermaid] = useState(false);
  const [mermaidCode, setMermaidCode] = useState(() => activeBranch?.mermaidSource || serializeToMermaid(nodes, edges));
  const [mermaidType, setMermaidType] = useState(() => detectMermaidType(activeBranch?.mermaidSource || '') || 'flowchart');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [exportScale, setExportScale] = useState(2);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [inlineEdit, setInlineEdit] = useState(null); // { type: 'node' | 'edge', id, value }
  const [alignGuides, setAlignGuides] = useState({ x: null, y: null });
  const [marquee, setMarquee] = useState(null); // { x1, y1, x2, y2 }
  const [connecting, setConnecting] = useState(null); // { sourceId, startX, startY, curX, curY }
  const [clipboard, setClipboard] = useState([]);
  const [condRule, setCondRule] = useState({ keyword: '', fill: 'rgba(224, 108, 117, 0.2)', stroke: '#E06C75' });

  // Undo / Redo stacks (store { nodes, edges } snapshots)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const interactionRef = useRef(null);
  const spaceHeldRef = useRef(false);

  // Sync mermaid code when switching branches
  useEffect(() => {
    setMermaidCode(activeBranch?.mermaidSource || serializeToMermaid(activeBranch?.nodes || [], activeBranch?.edges || []));
    setViewport(activeBranch?.viewport || { x: 80, y: 80, zoom: 1 });
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setUndoStack([]);
    setRedoStack([]);
  }, [activeBranch?.id]);

  // Periodic automatic snapshot every 90s if nodes exist
  useEffect(() => {
    const timer = setInterval(() => {
      if ((activeBranch?.nodes || []).length > 0) {
        onUpdateDoc((prev) => createBranchSnapshot(prev, '', true));
      }
    }, 90000);
    return () => clearInterval(timer);
  }, [activeBranch?.id, activeBranch?.nodes?.length]);

  const commitGraph = useCallback(
    (nextNodes, nextEdges, pushUndo = true) => {
      if (pushUndo) {
        setUndoStack((prev) => [...prev.slice(-39), { nodes, edges }]);
        setRedoStack([]);
      }
      onUpdateDoc((prev) =>
        updateActiveBranch(prev, {
          nodes: nextNodes,
          edges: nextEdges,
        })
      );
    },
    [nodes, edges, onUpdateDoc]
  );

  const handleUndo = useCallback(() => {
    if (!undoStack.length) return;
    const prevSnap = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { nodes, edges }]);
    setUndoStack((u) => u.slice(0, -1));
    onUpdateDoc((prev) => updateActiveBranch(prev, { nodes: prevSnap.nodes, edges: prevSnap.edges }));
  }, [undoStack, nodes, edges, onUpdateDoc]);

  const handleRedo = useCallback(() => {
    if (!redoStack.length) return;
    const nextSnap = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { nodes, edges }]);
    setRedoStack((r) => r.slice(0, -1));
    onUpdateDoc((prev) => updateActiveBranch(prev, { nodes: nextSnap.nodes, edges: nextSnap.edges }));
  }, [redoStack, nodes, edges, onUpdateDoc]);

  const selectedNodes = useMemo(() => nodes.filter((n) => selectedNodeIds.includes(n.id)), [nodes, selectedNodeIds]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

  const layerMap = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);
  const visibleNodes = useMemo(
    () => nodes.filter((n) => layerMap.get(n.layerId || 'layer_default')?.visible !== false),
    [nodes, layerMap]
  );
  const visibleNodeMap = useMemo(() => new Map(visibleNodes.map((n) => [n.id, n])), [visibleNodes]);

  const screenToCanvas = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const zoomToBounds = useCallback((targetNodes) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !targetNodes.length) {
      setViewport({ x: 80, y: 80, zoom: 1 });
      return;
    }
    const minX = Math.min(...targetNodes.map((n) => n.x));
    const minY = Math.min(...targetNodes.map((n) => n.y));
    const maxX = Math.max(...targetNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...targetNodes.map((n) => n.y + n.h));
    const bw = Math.max(120, maxX - minX);
    const bh = Math.max(120, maxY - minY);
    const pad = 70;
    const zoom = Math.max(0.2, Math.min(1.6, Math.min((rect.width - pad * 2) / bw, (rect.height - pad * 2) / bh)));
    const x = (rect.width - bw * zoom) / 2 - minX * zoom;
    const y = (rect.height - bh * zoom) / 2 - minY * zoom;
    setViewport({ x, y, zoom });
  }, []);

  const addShapeAtCenter = (item) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - viewport.x) / viewport.zoom : 300;
    const cy = rect ? (rect.height / 2 - viewport.y) / viewport.zoom : 250;
    const newNode = {
      id: makeId('n'),
      label: item.label,
      shape: item.shape,
      x: snapVal(cx - item.w / 2, snapToGrid),
      y: snapVal(cy - item.h / 2, snapToGrid),
      w: item.w,
      h: item.h,
      fill: '',
      stroke: '',
      textColor: '',
      fontSize: 13,
      layerId: layers[0]?.id || 'layer_default',
      locked: false,
      groupId: null,
      metadata:
        item.shape === 'class'
          ? { members: ['+id: string', '+execute()'] }
          : item.shape === 'er_table'
          ? { columns: ['PK uuid id', 'string name'] }
          : {},
    };
    commitGraph([...nodes, newNode], edges);
    setSelectedNodeIds([newNode.id]);
    setSelectedEdgeId(null);
  };

  const deleteSelection = useCallback(() => {
    if (selectedEdgeId) {
      commitGraph(nodes, edges.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedNodeIds.length) return;
    const unlockedIds = new Set(
      nodes.filter((n) => selectedNodeIds.includes(n.id) && !n.locked).map((n) => n.id)
    );
    if (!unlockedIds.size) return;
    commitGraph(
      nodes.filter((n) => !unlockedIds.has(n.id)),
      edges.filter((e) => !unlockedIds.has(e.source) && !unlockedIds.has(e.target))
    );
    setSelectedNodeIds([]);
  }, [selectedEdgeId, selectedNodeIds, nodes, edges, commitGraph]);

  const duplicateSelection = useCallback(() => {
    if (!selectedNodeIds.length) return;
    const clones = nodes
      .filter((n) => selectedNodeIds.includes(n.id))
      .map((n) => ({
        ...JSON.parse(JSON.stringify(n)),
        id: makeId('n'),
        x: n.x + 32,
        y: n.y + 32,
        locked: false,
      }));
    commitGraph([...nodes, ...clones], edges);
    setSelectedNodeIds(clones.map((c) => c.id));
  }, [selectedNodeIds, nodes, edges, commitGraph]);

  const groupSelection = useCallback(() => {
    if (selectedNodeIds.length < 2) return;
    const gid = makeId('grp');
    commitGraph(
      nodes.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, groupId: gid } : n)),
      edges
    );
  }, [selectedNodeIds, nodes, edges, commitGraph]);

  const ungroupSelection = useCallback(() => {
    if (!selectedNodeIds.length) return;
    commitGraph(
      nodes.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, groupId: null } : n)),
      edges
    );
  }, [selectedNodeIds, nodes, edges, commitGraph]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || inlineEdit) return;
      if (e.code === 'Space') {
        spaceHeldRef.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedNodes.length) setClipboard(JSON.parse(JSON.stringify(selectedNodes)));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length) {
          e.preventDefault();
          const pasted = clipboard.map((n) => ({ ...n, id: makeId('n'), x: n.x + 36, y: n.y + 36 }));
          commitGraph([...nodes, ...pasted], edges);
          setSelectedNodeIds(pasted.map((p) => p.id));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedNodeIds(visibleNodes.map((n) => n.id));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    inlineEdit,
    handleUndo,
    handleRedo,
    duplicateSelection,
    selectedNodes,
    clipboard,
    nodes,
    edges,
    commitGraph,
    groupSelection,
    ungroupSelection,
    visibleNodes,
    deleteSelection,
  ]);

  // Canvas pointer handlers
  const handleCanvasPointerDown = (e) => {
    if (e.button === 1 || tool === 'pan' || spaceHeldRef.current) {
      interactionRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origVp: { ...viewport },
      };
      return;
    }
    if (e.target === canvasRef.current || e.target.dataset?.canvasBg === 'true') {
      const pt = screenToCanvas(e.clientX, e.clientY);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      interactionRef.current = { mode: 'marquee', startPt: pt };
      setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    }
  };

  const handleNodePointerDown = (e, node) => {
    e.stopPropagation();
    if (tool === 'pan' || spaceHeldRef.current) return;
    setSelectedEdgeId(null);

    let nextSel = selectedNodeIds;
    if (e.shiftKey) {
      nextSel = selectedNodeIds.includes(node.id)
        ? selectedNodeIds.filter((id) => id !== node.id)
        : [...selectedNodeIds, node.id];
    } else if (!selectedNodeIds.includes(node.id)) {
      if (node.groupId) {
        nextSel = nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id);
      } else {
        nextSel = [node.id];
      }
    }
    setSelectedNodeIds(nextSel);

    const layerLocked = layerMap.get(node.layerId || 'layer_default')?.locked;
    if (node.locked || layerLocked) return;

    const pt = screenToCanvas(e.clientX, e.clientY);
    const movingNodes = nodes.filter((n) => nextSel.includes(n.id) && !n.locked);
    interactionRef.current = {
      mode: 'drag',
      startPt: pt,
      origPositions: new Map(movingNodes.map((n) => [n.id, { x: n.x, y: n.y }])),
      anchorId: node.id,
      snapshotBefore: { nodes, edges },
    };
  };

  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    if (!selectedNodes.length) return;
    const minX = Math.min(...selectedNodes.map((n) => n.x));
    const minY = Math.min(...selectedNodes.map((n) => n.y));
    const maxX = Math.max(...selectedNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...selectedNodes.map((n) => n.y + n.h));
    interactionRef.current = {
      mode: 'resize',
      startPt: screenToCanvas(e.clientX, e.clientY),
      bounds: { minX, minY, w: Math.max(40, maxX - minX), h: Math.max(30, maxY - minY) },
      origNodes: new Map(selectedNodes.map((n) => [n.id, { ...n }])),
      snapshotBefore: { nodes, edges },
    };
  };

  const handlePortPointerDown = (e, node, portPoint) => {
    e.stopPropagation();
    interactionRef.current = { mode: 'connect', sourceId: node.id };
    setConnecting({
      sourceId: node.id,
      startX: portPoint.x,
      startY: portPoint.y,
      curX: portPoint.x,
      curY: portPoint.y,
    });
  };

  const handleCanvasPointerMove = (e) => {
    const act = interactionRef.current;
    if (!act) return;

    if (act.mode === 'pan') {
      setViewport({
        ...act.origVp,
        x: act.origVp.x + (e.clientX - act.startX),
        y: act.origVp.y + (e.clientY - act.startY),
      });
      return;
    }

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (act.mode === 'marquee') {
      setMarquee((m) => (m ? { ...m, x2: pt.x, y2: pt.y } : null));
      return;
    }

    if (act.mode === 'connect') {
      setConnecting((c) => (c ? { ...c, curX: pt.x, curY: pt.y } : null));
      return;
    }

    if (act.mode === 'drag') {
      const dx = pt.x - act.startPt.x;
      const dy = pt.y - act.startPt.y;
      let guideX = null;
      let guideY = null;

      const anchorOrig = act.origPositions.get(act.anchorId);
      const anchorNode = nodes.find((n) => n.id === act.anchorId);
      let adjDx = dx;
      let adjDy = dy;

      if (anchorOrig && anchorNode) {
        const rawX = anchorOrig.x + dx;
        const rawY = anchorOrig.y + dy;
        const aCx = rawX + anchorNode.w / 2;
        const aCy = rawY + anchorNode.h / 2;

        // Smart alignment guides against non-moving nodes (skip full scan on >200 nodes for 60fps drag)
        if (visibleNodes.length <= 200) {
          for (const other of visibleNodes) {
            if (act.origPositions.has(other.id)) continue;
            const oCx = other.x + other.w / 2;
            const oCy = other.y + other.h / 2;
            if (guideX === null) {
              if (Math.abs(aCx - oCx) < 7) {
                adjDx += oCx - aCx;
                guideX = oCx;
              } else if (Math.abs(rawX - other.x) < 7) {
                adjDx += other.x - rawX;
                guideX = other.x;
              }
            }
            if (guideY === null) {
              if (Math.abs(aCy - oCy) < 7) {
                adjDy += oCy - aCy;
                guideY = oCy;
              } else if (Math.abs(rawY - other.y) < 7) {
                adjDy += other.y - rawY;
                guideY = other.y;
              }
            }
            if (guideX !== null && guideY !== null) break;
          }
        }
      }

      setAlignGuides({ x: guideX, y: guideY });

      const nextNodes = nodes.map((n) => {
        const orig = act.origPositions.get(n.id);
        if (!orig) return n;
        const nx = guideX !== null ? orig.x + adjDx : snapVal(orig.x + adjDx, snapToGrid);
        const ny = guideY !== null ? orig.y + adjDy : snapVal(orig.y + adjDy, snapToGrid);
        return { ...n, x: nx, y: ny };
      });
      onUpdateDoc((prev) => updateActiveBranch(prev, { nodes: nextNodes }));
      return;
    }

    if (act.mode === 'resize') {
      const dx = pt.x - act.startPt.x;
      const dy = pt.y - act.startPt.y;
      const { minX, minY, w, h } = act.bounds;
      const scaleX = Math.max(0.25, (w + dx) / w);
      const scaleY = Math.max(0.25, (h + dy) / h);

      const nextNodes = nodes.map((n) => {
        const orig = act.origNodes.get(n.id);
        if (!orig || n.locked) return n;
        return {
          ...n,
          x: minX + (orig.x - minX) * scaleX,
          y: minY + (orig.y - minY) * scaleY,
          w: Math.max(44, Math.round(orig.w * scaleX)),
          h: Math.max(32, Math.round(orig.h * scaleY)),
        };
      });
      onUpdateDoc((prev) => updateActiveBranch(prev, { nodes: nextNodes }));
    }
  };

  const handleCanvasPointerUp = (e) => {
    const act = interactionRef.current;
    interactionRef.current = null;
    setAlignGuides({ x: null, y: null });

    if (!act) return;

    if (act.mode === 'drag' || act.mode === 'resize') {
      setUndoStack((u) => [...u.slice(-39), act.snapshotBefore]);
      setRedoStack([]);
    }

    if (act.mode === 'marquee' && marquee) {
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);
      if (maxX - minX > 6 || maxY - minY > 6) {
        const hit = visibleNodes
          .filter((n) => n.x + n.w >= minX && n.x <= maxX && n.y + n.h >= minY && n.y <= maxY)
          .map((n) => n.id);
        setSelectedNodeIds(hit);
      }
      setMarquee(null);
    }

    if (act.mode === 'connect' && connecting) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      const target = [...visibleNodes]
        .reverse()
        .find((n) => n.id !== act.sourceId && pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h);
      if (target) {
        const newEdge = {
          id: makeId('e'),
          source: act.sourceId,
          target: target.id,
          label: '',
          routing: 'orthogonal',
          lineStyle: 'solid',
          arrowEnd: 'arrow',
          arrowStart: 'none',
          stroke: '',
          strokeWidth: 2,
          layerId: layers[0]?.id || 'layer_default',
        };
        commitGraph(nodes, [...edges, newEdge]);
        setSelectedEdgeId(newEdge.id);
        setSelectedNodeIds([]);
      }
      setConnecting(null);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = e.deltaY < 0 ? 1.09 : 0.91;
      const nextZoom = Math.max(0.2, Math.min(2.5, viewport.zoom * factor));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = (mx - viewport.x) / viewport.zoom;
      const cy = (my - viewport.y) / viewport.zoom;
      setViewport({
        zoom: nextZoom,
        x: mx - cx * nextZoom,
        y: my - cy * nextZoom,
      });
    }
  };

  // Mermaid Split-Screen Validation & Sync (runs full parse so syntax/directive errors & warnings are never hidden)
  const mermaidValidation = useMemo(() => parseMermaid(mermaidCode), [mermaidCode]);

  const handleApplyMermaidToCanvas = () => {
    const parsed = parseMermaid(mermaidCode);
    if (parsed.nodes.length === 0 && !parsed.valid) return;
    commitGraph(parsed.nodes, parsed.edges);
    onUpdateDoc((prev) => updateActiveBranch(prev, { mermaidSource: mermaidCode }));
    setTimeout(() => zoomToBounds(parsed.nodes), 30);
  };

  const handleSyncCanvasToMermaid = () => {
    const generated = serializeToMermaid(nodes, edges, mermaidType, 'TD');
    setMermaidCode(generated);
    onUpdateDoc((prev) => updateActiveBranch(prev, { mermaidSource: generated }));
  };

  // Validation inside Find tab
  const diagramWarnings = useMemo(() => {
    const warns = [];
    const connectedIds = new Set();
    edges.forEach((e) => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });
    nodes.forEach((n) => {
      if (n.shape !== 'container' && !connectedIds.has(n.id) && nodes.length > 1) {
        warns.push(`Disconnected node: "${n.label}"`);
      }
      if (!String(n.label || '').trim()) {
        warns.push(`Node ${n.id} has an empty label`);
      }
    });
    return warns;
  }, [nodes, edges]);

  // Selection bounding box for multi-resize
  const selectionBounds = useMemo(() => {
    if (!selectedNodes.length) return null;
    const minX = Math.min(...selectedNodes.map((n) => n.x));
    const minY = Math.min(...selectedNodes.map((n) => n.y));
    const maxX = Math.max(...selectedNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...selectedNodes.map((n) => n.y + n.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [selectedNodes]);

  // File Import (Mermaid / CSV / JSON)
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'csv') {
        const { nodes: cn, edges: ce } = parseCsvToDiagram(text);
        commitGraph(cn, ce);
        zoomToBounds(cn);
      } else if (ext === 'json') {
        const parsed = JSON.parse(text);
        const rawNodes = Array.isArray(parsed?.nodes)
          ? parsed.nodes
          : Array.isArray(parsed?.branches?.[0]?.nodes)
          ? parsed.branches[0].nodes
          : null;
        const rawEdges = Array.isArray(parsed?.edges)
          ? parsed.edges
          : Array.isArray(parsed?.branches?.[0]?.edges)
          ? parsed.branches[0].edges
          : [];
        if (!rawNodes) {
          throw new Error('JSON file must contain a "nodes" array or a Branchwise "branches" array.');
        }
        const safeNodes = rawNodes.map((n, idx) => ({
          ...n,
          id: String(n?.id || makeId(`imp_${idx}`)),
          label: String(n?.label ?? 'Node'),
          shape: String(n?.shape || 'rect'),
          x: Number.isFinite(Number(n?.x)) ? Number(n.x) : 100 + (idx % 6) * 190,
          y: Number.isFinite(Number(n?.y)) ? Number(n.y) : 100 + Math.floor(idx / 6) * 110,
          w: Math.max(40, Number(n?.w) || 160),
          h: Math.max(30, Number(n?.h) || 64),
        }));
        const nodeIds = new Set(safeNodes.map((n) => n.id));
        const safeEdges = rawEdges.filter((ed) => ed && nodeIds.has(String(ed.source)) && nodeIds.has(String(ed.target)));
        commitGraph(safeNodes, safeEdges);
        zoomToBounds(safeNodes);
      } else {
        setMermaidCode(text);
        setSplitMermaid(true);
        const parsed = parseMermaid(text);
        if (parsed.nodes.length) {
          commitGraph(parsed.nodes, parsed.edges);
          zoomToBounds(parsed.nodes);
        }
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  };

  // Minimap bounds
  const minimapData = useMemo(() => {
    if (!visibleNodes.length) return null;
    const minX = Math.min(...visibleNodes.map((n) => n.x)) - 60;
    const minY = Math.min(...visibleNodes.map((n) => n.y)) - 60;
    const maxX = Math.max(...visibleNodes.map((n) => n.x + n.w)) + 60;
    const maxY = Math.max(...visibleNodes.map((n) => n.y + n.h)) + 60;
    return { minX, minY, w: Math.max(300, maxX - minX), h: Math.max(200, maxY - minY) };
  }, [visibleNodes]);

  const updateSelectedNodes = (patchFn) => {
    const next = nodes.map((n) => (selectedNodeIds.includes(n.id) ? patchFn(n) : n));
    commitGraph(next, edges);
  };

  return (
    <div style={styles.root}>
      {/* TOP BAR */}
      <header style={styles.topBar}>
        <div style={styles.topGroup}>
          <button onClick={onBack} style={styles.topBtn} title="Back to Home">
            <ArrowLeft size={16} />
          </button>
          <div style={styles.brandBadge}>BW</div>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim()) onUpdateDoc((d) => ({ ...d, title: titleDraft.trim() }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
              }}
              style={styles.titleInput}
              autoFocus
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} style={styles.titleBtn} title="Click to rename document">
              {doc.title}
            </button>
          )}
          <span style={styles.savePill}>{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
        </div>

        <div style={styles.topGroup}>
          <button
            onClick={() => setTool('select')}
            style={{ ...styles.topBtn, background: tool === 'select' ? 'var(--accent)' : 'var(--surface-2)', color: tool === 'select' ? 'var(--accent-inv)' : 'var(--text)' }}
            title="Select Tool (V)"
          >
            <MousePointer2 size={15} />
          </button>
          <button
            onClick={() => setTool('pan')}
            style={{ ...styles.topBtn, background: tool === 'pan' ? 'var(--accent)' : 'var(--surface-2)', color: tool === 'pan' ? 'var(--accent-inv)' : 'var(--text)' }}
            title="Pan Tool (Space + Drag)"
          >
            <Hand size={15} />
          </button>
          <div style={styles.divider} />
          <button onClick={handleUndo} disabled={!undoStack.length} style={{ ...styles.topBtn, opacity: undoStack.length ? 1 : 0.4 }} title="Undo (Ctrl+Z)">
            <Undo2 size={15} />
          </button>
          <button onClick={handleRedo} disabled={!redoStack.length} style={{ ...styles.topBtn, opacity: redoStack.length ? 1 : 0.4 }} title="Redo (Ctrl+Y)">
            <Redo2 size={15} />
          </button>
          <div style={styles.divider} />
          <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.2, v.zoom - 0.12) }))} style={styles.topBtn} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <span style={styles.zoomText}>{Math.round(viewport.zoom * 100)}%</span>
          <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(2.5, v.zoom + 0.12) }))} style={styles.topBtn} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <button onClick={() => zoomToBounds(visibleNodes)} style={styles.topBtn} title="Zoom to Fit">
            <Maximize2 size={15} />
          </button>
          {selectedNodes.length > 0 && (
            <button onClick={() => zoomToBounds(selectedNodes)} style={styles.topTextBtn} title="Zoom to Selection">
              Fit Sel
            </button>
          )}
          <div style={styles.divider} />
          <button
            onClick={() => setShowGrid((g) => !g)}
            style={{ ...styles.topBtn, color: showGrid ? '#6E8AE6' : 'var(--muted)' }}
            title="Toggle Grid"
          >
            <Grid3X3 size={15} />
          </button>
          <button
            onClick={() => setSnapToGrid((s) => !s)}
            style={{ ...styles.topBtn, color: snapToGrid ? '#6E8AE6' : 'var(--muted)' }}
            title="Snap to Grid"
          >
            <Magnet size={15} />
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setLayoutMenuOpen((o) => !o)} style={styles.topTextBtn} title="Auto-Layout">
              <LayoutGrid size={14} /> Layout
            </button>
            {layoutMenuOpen && (
              <div style={styles.dropdown} onClick={() => setLayoutMenuOpen(false)}>
                <button
                  style={styles.dropItem}
                  onClick={() => {
                    const laid = autoLayoutNodes(nodes, edges, 'TD');
                    commitGraph(laid, edges);
                    zoomToBounds(laid);
                  }}
                >
                  Hierarchical (Top-Down)
                </button>
                <button
                  style={styles.dropItem}
                  onClick={() => {
                    const laid = autoLayoutNodes(nodes, edges, 'LR');
                    commitGraph(laid, edges);
                    zoomToBounds(laid);
                  }}
                >
                  Hierarchical (Left-Right)
                </button>
                <button
                  style={styles.dropItem}
                  onClick={() => {
                    const laid = applyGridAutoLayout(nodes);
                    commitGraph(laid, edges);
                    zoomToBounds(laid);
                  }}
                >
                  Grid Layout
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={styles.topGroup}>
          <button
            onClick={() => setSplitMermaid((s) => !s)}
            style={{
              ...styles.topTextBtn,
              background: splitMermaid ? 'rgba(110,138,230,0.18)' : 'var(--surface-2)',
              borderColor: splitMermaid ? '#6E8AE6' : 'var(--border)',
              color: splitMermaid ? '#6E8AE6' : 'var(--text)',
            }}
          >
            <Code2 size={14} /> Mermaid
          </button>
          <button onClick={() => setHistoryOpen(true)} style={styles.topTextBtn} title="Branches & Version History">
            <GitBranch size={14} color="#52A87A" /> {activeBranch?.name || 'main'}
          </button>
          <button onClick={onOpenTemplates} style={styles.topTextBtn} title="Open Template Gallery">
            <Sparkles size={14} /> Templates
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mmd,.mermaid,.txt,.csv,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button onClick={() => fileInputRef.current?.click()} style={styles.topTextBtn} title="Import Mermaid / CSV / JSON">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setExportOpen(true)} style={styles.exportBtn} title="Export PNG, SVG, PDF, JSON, Mermaid">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setLeftOpen((o) => !o)} style={styles.topBtn} title="Toggle Left Sidebar">
            <PanelLeft size={15} />
          </button>
          <button onClick={() => setRightOpen((o) => !o)} style={styles.topBtn} title="Toggle Properties">
            <PanelRight size={15} />
          </button>
          <button onClick={onToggleTheme} style={styles.topBtn} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* MAIN 3-PANE BODY */}
      <div style={styles.workspace}>
        {/* LEFT SIDEBAR */}
        {leftOpen && (
          <aside
            style={{
              ...styles.leftSidebar,
              ...(isNarrow
                ? { position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 25, boxShadow: '8px 0 24px rgba(0,0,0,0.35)' }
                : {}),
            }}
          >
            <div style={styles.tabRow}>
              {[
                { id: 'shapes', label: 'Shapes', Icon: Shapes },
                { id: 'layers', label: 'Layers', Icon: Layers },
                { id: 'find', label: 'Find', Icon: Search },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setLeftTab(id)}
                  style={{
                    ...styles.tabBtn,
                    borderBottomColor: leftTab === id ? '#6E8AE6' : 'transparent',
                    color: leftTab === id ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {leftTab === 'shapes' && (
              <div style={styles.sideScroll}>
                <div style={styles.searchBox}>
                  <Search size={13} color="var(--muted)" />
                  <input
                    value={shapeSearch}
                    onChange={(e) => setShapeSearch(e.target.value)}
                    placeholder="Search shapes..."
                    style={styles.searchInput}
                  />
                </div>
                {SHAPE_GROUPS.map((grp) => {
                  const items = grp.items.filter(
                    (it) => !shapeSearch.trim() || it.label.toLowerCase().includes(shapeSearch.toLowerCase())
                  );
                  if (!items.length) return null;
                  return (
                    <div key={grp.name} style={{ marginBottom: 14 }}>
                      <div style={styles.groupTitle}>{grp.name}</div>
                      <div style={styles.shapeGrid}>
                        {items.map((it) => (
                          <button
                            key={it.shape}
                            onClick={() => addShapeAtCenter(it)}
                            style={styles.shapeCard}
                            title={`Add ${it.label}`}
                          >
                            <span style={styles.shapePreview}>{it.shape.slice(0, 3).toUpperCase()}</span>
                            <span style={styles.shapeLabel}>{it.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {leftTab === 'layers' && (
              <div style={styles.sideScroll}>
                <button
                  onClick={() => {
                    const nl = { id: makeId('lyr'), name: `Layer ${layers.length + 1}`, visible: true, locked: false };
                    onUpdateDoc((prev) => updateActiveBranch(prev, { layers: [...layers, nl] }));
                  }}
                  style={styles.fullBtn}
                >
                  <Plus size={14} /> Add Layer
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {layers.map((lyr) => (
                    <div key={lyr.id} style={styles.layerRow}>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{lyr.name}</span>
                      <button
                        style={styles.miniBtn}
                        onClick={() =>
                          onUpdateDoc((prev) =>
                            updateActiveBranch(prev, {
                              layers: layers.map((l) => (l.id === lyr.id ? { ...l, visible: !l.visible } : l)),
                            })
                          )
                        }
                        title="Toggle Visibility"
                      >
                        {lyr.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        style={styles.miniBtn}
                        onClick={() =>
                          onUpdateDoc((prev) =>
                            updateActiveBranch(prev, {
                              layers: layers.map((l) => (l.id === lyr.id ? { ...l, locked: !l.locked } : l)),
                            })
                          )
                        }
                        title="Toggle Layer Lock"
                      >
                        {lyr.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftTab === 'find' && (
              <div style={styles.sideScroll}>
                <div style={styles.groupTitle}>Find & Replace Labels</div>
                <input
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="Find label text..."
                  style={styles.propInput}
                />
                <input
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace with..."
                  style={{ ...styles.propInput, marginTop: 6 }}
                />
                <button
                  onClick={() => {
                    if (!findQuery) return;
                    const next = nodes.map((n) => ({
                      ...n,
                      label: String(n.label || '').split(findQuery).join(replaceQuery),
                    }));
                    commitGraph(next, edges);
                  }}
                  style={{ ...styles.fullBtn, marginTop: 8 }}
                >
                  Replace All
                </button>

                <div style={{ ...styles.groupTitle, marginTop: 16 }}>
                  Matching Nodes ({nodes.filter((n) => !findQuery || n.label.toLowerCase().includes(findQuery.toLowerCase())).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {nodes
                    .filter((n) => !findQuery || n.label.toLowerCase().includes(findQuery.toLowerCase()))
                    .map((n) => (
                      <button
                        key={n.id}
                        style={styles.findItem}
                        onClick={() => {
                          setSelectedNodeIds([n.id]);
                          zoomToBounds([n]);
                        }}
                      >
                        {n.label}
                      </button>
                    ))}
                </div>

                <div style={{ ...styles.groupTitle, marginTop: 18 }}>Diagram Validation</div>
                {diagramWarnings.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#52A87A', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> No structural warnings
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diagramWarnings.map((w, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: '#D49B38', display: 'flex', gap: 6 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* SPLIT-SCREEN MERMAID CODE PANE */}
        {splitMermaid && (
          <section style={styles.mermaidPane}>
            <div style={styles.mermaidHeader}>
              <select value={mermaidType} onChange={(e) => setMermaidType(e.target.value)} style={styles.smallSelect}>
                <option value="flowchart">flowchart</option>
                <option value="sequenceDiagram">sequenceDiagram</option>
                <option value="classDiagram">classDiagram</option>
                <option value="stateDiagram-v2">stateDiagram-v2</option>
                <option value="erDiagram">erDiagram</option>
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSyncCanvasToMermaid} style={styles.miniTextBtn} title="Serialize visual diagram to Mermaid">
                  From Canvas
                </button>
                <button onClick={handleApplyMermaidToCanvas} style={styles.applyMermaidBtn} title="Parse Mermaid into editable canvas">
                  Apply to Canvas
                </button>
              </div>
            </div>
            <textarea
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              spellCheck={false}
              style={styles.codeArea}
              placeholder="flowchart TD&#10;  A[Start] --> B{Decision}"
            />
            <div style={styles.mermaidStatus}>
              {mermaidValidation.valid ? (
                <span style={{ color: '#52A87A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} /> Valid {mermaidValidation.diagramType} ({mermaidValidation.nodes.length} nodes)
                </span>
              ) : (
                <div style={{ color: '#E06C75' }}>
                  {mermaidValidation.errors.map((err, i) => (
                    <div key={i}>
                      Line {err.line}: {err.message}
                    </div>
                  ))}
                </div>
              )}
              {mermaidValidation.warnings?.length > 0 && (
                <div style={{ color: '#D49B38', marginTop: 4 }}>
                  {mermaidValidation.warnings.map((w, i) => (
                    <div key={i}>
                      Warning (Line {w.line}): {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* CENTER INFINITE CANVAS */}
        <main
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onWheel={handleWheel}
          style={{
            ...styles.canvas,
            cursor: tool === 'pan' ? 'grab' : connecting ? 'crosshair' : 'default',
            backgroundImage: showGrid
              ? `radial-gradient(var(--grid-line) 1.3px, transparent 1.3px)`
              : 'none',
            backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
        >
          <div
            data-canvas-bg="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              transformOrigin: '0 0',
              width: 1,
              height: 1,
            }}
          >
            {/* Edges SVG Layer */}
            <svg
              style={{
                position: 'absolute',
                left: -5000,
                top: -5000,
                width: 10000,
                height: 10000,
                overflow: 'visible',
                pointerEvents: 'none',
              }}
              viewBox="-5000 -5000 10000 10000"
            >
              <defs>
                <marker id="studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-soft)" />
                </marker>
                <marker id="studio-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6E8AE6" />
                </marker>
              </defs>

              {/* Smart alignment guide lines */}
              {alignGuides.x !== null && (
                <line x1={alignGuides.x} y1={-4000} x2={alignGuides.x} y2={4000} stroke="#48B2C6" strokeWidth={1.2} strokeDasharray="5 4" />
              )}
              {alignGuides.y !== null && (
                <line x1={-4000} y1={alignGuides.y} x2={4000} y2={alignGuides.y} stroke="#48B2C6" strokeWidth={1.2} strokeDasharray="5 4" />
              )}

              {/* Live drag-to-connect preview */}
              {connecting && (
                <line
                  x1={connecting.startX}
                  y1={connecting.startY}
                  x2={connecting.curX}
                  y2={connecting.curY}
                  stroke="#6E8AE6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}

              {edges.map((edge) => {
                const s = visibleNodeMap.get(edge.source);
                const t = visibleNodeMap.get(edge.target);
                if (!s || !t) return null;
                const { d, labelX, labelY } = buildEdgePath(s, t, edge.routing || 'orthogonal');
                const isSel = selectedEdgeId === edge.id;
                return (
                  <g key={edge.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeIds([]);
                      }}
                      onDoubleClick={(ev) => {
                        ev.stopPropagation();
                        setInlineEdit({ type: 'edge', id: edge.id, value: edge.label || '' });
                      }}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={isSel ? '#6E8AE6' : edge.stroke || 'var(--text-soft)'}
                      strokeWidth={isSel ? (edge.strokeWidth || 2) + 1 : edge.strokeWidth || 2}
                      strokeDasharray={edge.lineStyle === 'dashed' ? '7 5' : undefined}
                      markerEnd={edge.arrowEnd !== 'none' ? (isSel ? 'url(#studio-arrow-sel)' : 'url(#studio-arrow)') : undefined}
                      markerStart={edge.arrowStart === 'arrow' ? 'url(#studio-arrow)' : undefined}
                      style={{ pointerEvents: 'none' }}
                    />
                    {edge.label && (
                      <g
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeIds([]);
                        }}
                        onDoubleClick={(ev) => {
                          ev.stopPropagation();
                          setInlineEdit({ type: 'edge', id: edge.id, value: edge.label || '' });
                        }}
                      >
                        <rect
                          x={labelX - edge.label.length * 3.6 - 7}
                          y={labelY - 11}
                          width={edge.label.length * 7.2 + 14}
                          height={22}
                          rx={6}
                          fill="var(--surface)"
                          stroke={isSel ? '#6E8AE6' : 'var(--border-strong)'}
                        />
                        <text x={labelX} y={labelY + 4} textAnchor="middle" fill="var(--text)" fontSize="11.5" fontWeight="500">
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes Layer (containers first so they sit behind) */}
            {[...visibleNodes.filter((n) => n.shape === 'container'), ...visibleNodes.filter((n) => n.shape !== 'container')].map((node) => {
              const isSel = selectedNodeIds.includes(node.id);
              const ports = getNodePorts(node);
              const condMatch =
                condRule.keyword.trim() &&
                String(node.label || '').toLowerCase().includes(condRule.keyword.trim().toLowerCase());
              const condColor = condMatch ? { fill: condRule.fill, stroke: condRule.stroke } : null;

              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setInlineEdit({ type: 'node', id: node.id, value: node.label || '' });
                  }}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    cursor: node.locked ? 'not-allowed' : 'move',
                    userSelect: 'none',
                  }}
                >
                  {renderShapeSVG(node, isSel, condColor, theme === 'dark')}

                  {node.locked && (
                    <div style={styles.lockBadge} title="Locked">
                      <Lock size={10} />
                    </div>
                  )}

                  {(() => {
                    const rawLink = String(node.metadata?.link || '').trim();
                    const safeLink = /^(https?:\/\/|mailto:)/i.test(rawLink) ? rawLink : '';
                    return safeLink ? (
                      <a
                        href={safeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={styles.linkBadge}
                        title={safeLink}
                      >
                        <ExternalLink size={10} />
                      </a>
                    ) : null;
                  })()}

                  {/* Connection Ports */}
                  {isSel &&
                    Object.entries(ports).map(([dir, pt]) => (
                      <div
                        key={dir}
                        onPointerDown={(e) => handlePortPointerDown(e, node, pt)}
                        style={{
                          ...styles.port,
                          left: pt.x - node.x - 5,
                          top: pt.y - node.y - 5,
                        }}
                        title={`Drag to connect from ${dir}`}
                      />
                    ))}

                  {/* Inline Label Editor */}
                  {inlineEdit?.type === 'node' && inlineEdit.id === node.id && (
                    <input
                      value={inlineEdit.value}
                      onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                      onBlur={() => {
                        commitGraph(
                          nodes.map((n) => (n.id === node.id ? { ...n, label: inlineEdit.value } : n)),
                          edges
                        );
                        setInlineEdit(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') setInlineEdit(null);
                      }}
                      style={styles.inlineInput}
                      autoFocus
                    />
                  )}
                </div>
              );
            })}

            {/* Multi-object / Single-object Selection Bounding Box & Resize Handle */}
            {selectionBounds && (
              <div
                style={{
                  position: 'absolute',
                  left: selectionBounds.x - 4,
                  top: selectionBounds.y - 4,
                  width: selectionBounds.w + 8,
                  height: selectionBounds.h + 8,
                  border: '1.5px dashed #6E8AE6',
                  borderRadius: 6,
                  pointerEvents: 'none',
                }}
              >
                <div
                  onPointerDown={handleResizePointerDown}
                  style={{ ...styles.resizeHandle, pointerEvents: 'auto' }}
                  title="Drag to resize"
                />
              </div>
            )}

            {/* Marquee Box */}
            {marquee && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(marquee.x1, marquee.x2),
                  top: Math.min(marquee.y1, marquee.y2),
                  width: Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                  background: 'rgba(110, 138, 230, 0.14)',
                  border: '1px solid #6E8AE6',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Inline Edge Label Editor */}
          {inlineEdit?.type === 'edge' && (
            <div style={styles.edgeEditOverlay}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Connector Label:</span>
              <input
                value={inlineEdit.value}
                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitGraph(
                      nodes,
                      edges.map((ed) => (ed.id === inlineEdit.id ? { ...ed, label: inlineEdit.value } : ed))
                    );
                    setInlineEdit(null);
                  }
                  if (e.key === 'Escape') setInlineEdit(null);
                }}
                style={styles.propInput}
                autoFocus
              />
              <button
                style={styles.miniTextBtn}
                onClick={() => {
                  commitGraph(
                    nodes,
                    edges.map((ed) => (ed.id === inlineEdit.id ? { ...ed, label: inlineEdit.value } : ed))
                  );
                  setInlineEdit(null);
                }}
              >
                Save
              </button>
            </div>
          )}

          {/* MINIMAP */}
          {minimapData && (
            <div style={styles.minimap}>
              <svg
                width="148"
                height="94"
                viewBox={`${minimapData.minX} ${minimapData.minY} ${minimapData.w} ${minimapData.h}`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const rx = (e.clientX - rect.left) / rect.width;
                  const ry = (e.clientY - rect.top) / rect.height;
                  const cx = minimapData.minX + rx * minimapData.w;
                  const cy = minimapData.minY + ry * minimapData.h;
                  const cRect = canvasRef.current?.getBoundingClientRect();
                  if (cRect) {
                    setViewport((v) => ({ ...v, x: cRect.width / 2 - cx * v.zoom, y: cRect.height / 2 - cy * v.zoom }));
                  }
                }}
                style={{ cursor: 'pointer', display: 'block' }}
              >
                {visibleNodes.map((n) => (
                  <rect
                    key={n.id}
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    fill={selectedNodeIds.includes(n.id) ? '#6E8AE6' : 'var(--text-soft)'}
                    fillOpacity="0.45"
                    rx="4"
                  />
                ))}
              </svg>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR: PROPERTIES */}
        {rightOpen && (
          <aside
            style={{
              ...styles.rightSidebar,
              ...(isNarrow
                ? { position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 25, boxShadow: '-8px 0 24px rgba(0,0,0,0.35)' }
                : {}),
            }}
          >
            <div style={styles.propHeader}>Properties</div>
            <div style={styles.sideScroll}>
              {selectedNodes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={styles.groupTitle}>Selection ({selectedNodes.length} node{selectedNodes.length > 1 ? 's' : ''})</div>
                    <div style={styles.actionGrid}>
                      <button onClick={duplicateSelection} style={styles.miniTextBtn} title="Duplicate (Ctrl+D)">
                        <Copy size={12} /> Dup
                      </button>
                      <button
                        onClick={() => updateSelectedNodes((n) => ({ ...n, locked: !n.locked }))}
                        style={styles.miniTextBtn}
                      >
                        {selectedNodes[0].locked ? <Unlock size={12} /> : <Lock size={12} />}
                        {selectedNodes[0].locked ? 'Unlock' : 'Lock'}
                      </button>
                      <button onClick={deleteSelection} style={{ ...styles.miniTextBtn, color: '#E06C75' }}>
                        <Trash2 size={12} /> Del
                      </button>
                    </div>
                  </div>

                  {selectedNodes.length === 1 && (
                    <>
                      <div>
                        <div style={styles.groupTitle}>Label</div>
                        <input
                          value={selectedNodes[0].label}
                          onChange={(e) => updateSelectedNodes((n) => ({ ...n, label: e.target.value }))}
                          style={styles.propInput}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <div style={styles.groupTitle}>X</div>
                          <input
                            type="number"
                            value={Math.round(selectedNodes[0].x)}
                            onChange={(e) => updateSelectedNodes((n) => ({ ...n, x: Number(e.target.value) || 0 }))}
                            style={styles.propInput}
                          />
                        </div>
                        <div>
                          <div style={styles.groupTitle}>Y</div>
                          <input
                            type="number"
                            value={Math.round(selectedNodes[0].y)}
                            onChange={(e) => updateSelectedNodes((n) => ({ ...n, y: Number(e.target.value) || 0 }))}
                            style={styles.propInput}
                          />
                        </div>
                        <div>
                          <div style={styles.groupTitle}>Width</div>
                          <input
                            type="number"
                            value={Math.round(selectedNodes[0].w)}
                            onChange={(e) => updateSelectedNodes((n) => ({ ...n, w: Math.max(40, Number(e.target.value) || 40) }))}
                            style={styles.propInput}
                          />
                        </div>
                        <div>
                          <div style={styles.groupTitle}>Height</div>
                          <input
                            type="number"
                            value={Math.round(selectedNodes[0].h)}
                            onChange={(e) => updateSelectedNodes((n) => ({ ...n, h: Math.max(30, Number(e.target.value) || 30) }))}
                            style={styles.propInput}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={styles.groupTitle}>External Hyperlink</div>
                        <input
                          value={selectedNodes[0].metadata?.link || ''}
                          onChange={(e) =>
                            updateSelectedNodes((n) => ({ ...n, metadata: { ...(n.metadata || {}), link: e.target.value } }))
                          }
                          placeholder="https://..."
                          style={styles.propInput}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div style={styles.groupTitle}>Color Style</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.name}
                          onClick={() => updateSelectedNodes((n) => ({ ...n, fill: sw.fill, stroke: sw.stroke }))}
                          title={sw.name}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: sw.fill || 'var(--surface-2)',
                            border: `2px solid ${sw.stroke || 'var(--border-strong)'}`,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={styles.groupTitle}>Layer & Order</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        style={styles.miniTextBtn}
                        onClick={() => {
                          const rest = nodes.filter((n) => !selectedNodeIds.includes(n.id));
                          commitGraph([...rest, ...selectedNodes], edges);
                        }}
                      >
                        <ArrowUp size={12} /> Forward
                      </button>
                      <button
                        style={styles.miniTextBtn}
                        onClick={() => {
                          const rest = nodes.filter((n) => !selectedNodeIds.includes(n.id));
                          commitGraph([...selectedNodes, ...rest], edges);
                        }}
                      >
                        <ArrowDown size={12} /> Backward
                      </button>
                    </div>
                  </div>

                  {selectedNodes.length >= 2 && (
                    <div>
                      <div style={styles.groupTitle}>Group, Align & Distribute</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <button onClick={groupSelection} style={styles.miniTextBtn}>
                          <Group size={12} /> Group
                        </button>
                        <button onClick={ungroupSelection} style={styles.miniTextBtn}>
                          <Ungroup size={12} /> Ungroup
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'left'), edges)} style={styles.miniBtn} title="Align Left">
                          <AlignLeft size={13} />
                        </button>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'center'), edges)} style={styles.miniBtn} title="Align Center">
                          <AlignCenterHorizontal size={13} />
                        </button>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'right'), edges)} style={styles.miniBtn} title="Align Right">
                          <AlignRight size={13} />
                        </button>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'top'), edges)} style={styles.miniBtn} title="Align Top">
                          <AlignStartVertical size={13} />
                        </button>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'middle'), edges)} style={styles.miniBtn} title="Align Middle">
                          <AlignCenterVertical size={13} />
                        </button>
                        <button onClick={() => commitGraph(alignSelectedNodes(nodes, selectedNodeIds, 'bottom'), edges)} style={styles.miniBtn} title="Align Bottom">
                          <AlignEndVertical size={13} />
                        </button>
                      </div>
                      {selectedNodes.length >= 3 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button onClick={() => commitGraph(distributeSelectedNodes(nodes, selectedNodeIds, 'horizontal'), edges)} style={styles.miniTextBtn}>
                            Dist H
                          </button>
                          <button onClick={() => commitGraph(distributeSelectedNodes(nodes, selectedNodeIds, 'vertical'), edges)} style={styles.miniTextBtn}>
                            Dist V
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : selectedEdge ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={styles.groupTitle}>Connector Properties</div>
                  <div>
                    <div style={styles.groupTitle}>Source Endpoint</div>
                    <select
                      value={selectedEdge.source}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, source: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    >
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Target Endpoint</div>
                    <select
                      value={selectedEdge.target}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, target: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    >
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Label</div>
                    <input
                      value={selectedEdge.label || ''}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    />
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Routing</div>
                    <select
                      value={selectedEdge.routing || 'orthogonal'}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, routing: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    >
                      <option value="orthogonal">Orthogonal</option>
                      <option value="straight">Straight</option>
                      <option value="curved">Curved</option>
                    </select>
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Line Style</div>
                    <select
                      value={selectedEdge.lineStyle || 'solid'}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, lineStyle: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="thick">Thick</option>
                    </select>
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Arrowhead</div>
                    <select
                      value={selectedEdge.arrowEnd || 'arrow'}
                      onChange={(e) =>
                        commitGraph(
                          nodes,
                          edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, arrowEnd: e.target.value } : ed))
                        )
                      }
                      style={styles.propInput}
                    >
                      <option value="arrow">Arrow End</option>
                      <option value="none">No Arrow</option>
                    </select>
                  </div>
                  <button onClick={deleteSelection} style={{ ...styles.miniTextBtn, color: '#E06C75' }}>
                    <Trash2 size={12} /> Delete Connector
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={styles.groupTitle}>Document Metadata</div>
                    <textarea
                      value={activeBranch?.metadata?.description || ''}
                      onChange={(e) =>
                        onUpdateDoc((prev) =>
                          updateActiveBranch(prev, {
                            metadata: { ...(activeBranch?.metadata || {}), description: e.target.value },
                          })
                        )
                      }
                      placeholder="Architecture notes or description..."
                      rows={3}
                      style={styles.propInput}
                    />
                  </div>
                  <div>
                    <div style={styles.groupTitle}>Conditional Highlight</div>
                    <input
                      value={condRule.keyword}
                      onChange={(e) => setCondRule({ ...condRule, keyword: e.target.value })}
                      placeholder="Highlight nodes containing..."
                      style={styles.propInput}
                    />
                  </div>
                  <div style={styles.tipsBox}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Quick Controls</div>
                    <div>• Click shape on left to add</div>
                    <div>• Drag port dot to connect</div>
                    <div>• Double-click to edit label</div>
                    <div>• Drag empty space for marquee</div>
                    <div>• Ctrl+Z / Ctrl+Y Undo/Redo</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* BRANCH & VERSION HISTORY DRAWER */}
      <BranchHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        doc={doc}
        activeBranch={activeBranch}
        onSwitchBranch={(id) => onUpdateDoc((prev) => switchActiveBranch(prev, id))}
        onCreateBranch={(name) => onUpdateDoc((prev) => createDuplicateBranch(prev, name))}
        onRenameBranch={(id, name) => onUpdateDoc((prev) => renameBranchById(prev, id, name))}
        onSaveSnapshot={(label) => onUpdateDoc((prev) => createBranchSnapshot(prev, label, false))}
        onRestoreSnapshot={(verId) => onUpdateDoc((prev) => restoreBranchSnapshot(prev, verId))}
      />

      {/* EXPORT MODAL */}
      {exportOpen && (
        <div style={styles.modalBackdrop} onClick={() => setExportOpen(false)}>
          <div style={styles.exportModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Export Diagram</h3>
              <button onClick={() => setExportOpen(false)} style={styles.miniBtn}>
                <X size={15} />
              </button>
            </div>
            <label style={styles.checkRow}>
              <input type="checkbox" checked={exportTransparent} onChange={(e) => setExportTransparent(e.target.checked)} />
              <span>Transparent background (PNG / SVG)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 16px', fontSize: 13 }}>
              <span>PNG Scale:</span>
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setExportScale(s)}
                  style={{
                    ...styles.miniTextBtn,
                    background: exportScale === s ? 'var(--accent)' : 'var(--surface-2)',
                    color: exportScale === s ? 'var(--accent-inv)' : 'var(--text)',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={styles.exportActionBtn}
                onClick={async () => {
                  await exportDiagramPNG(nodes, edges, {
                    scale: exportScale,
                    transparent: exportTransparent,
                    theme,
                    filename: `${doc.title.replace(/\s+/g, '-').toLowerCase()}.png`,
                  });
                  setExportOpen(false);
                }}
              >
                Export PNG
              </button>
              <button
                style={styles.exportActionBtn}
                onClick={() => {
                  const svg = generateDiagramSVG(nodes, edges, {
                    theme,
                    transparent: exportTransparent,
                    title: doc.title,
                  });
                  downloadTextFile(`${doc.title.replace(/\s+/g, '-').toLowerCase()}.svg`, svg, 'image/svg+xml');
                  setExportOpen(false);
                }}
              >
                Export SVG (Vector)
              </button>
              <button
                style={styles.exportActionBtn}
                onClick={() => {
                  exportDiagramPDF(nodes, edges, { theme: 'light', title: doc.title });
                  setExportOpen(false);
                }}
              >
                Export PDF (Print)
              </button>
              <button
                style={styles.exportActionBtn}
                onClick={() => {
                  downloadTextFile(`${doc.title.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(doc, null, 2), 'application/json');
                  setExportOpen(false);
                }}
              >
                Export JSON
              </button>
              <button
                style={{ ...styles.exportActionBtn, gridColumn: '1 / -1' }}
                onClick={() => {
                  const mmd = serializeToMermaid(nodes, edges, mermaidType, 'TD');
                  downloadTextFile(`${doc.title.replace(/\s+/g, '-').toLowerCase()}.mmd`, mmd, 'text/plain');
                  setExportOpen(false);
                }}
              >
                Export Mermaid (.mmd)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg)', color: 'var(--text)' },
  topBar: {
    minHeight: 50,
    padding: '6px 12px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    zIndex: 20,
  },
  topGroup: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  brandBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    background: '#6E8AE6',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    cursor: 'pointer',
  },
  titleInput: {
    background: 'var(--bg)',
    border: '1px solid #6E8AE6',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    outline: 'none',
  },
  savePill: {
    fontSize: 11,
    color: '#52A87A',
    background: 'rgba(82,168,122,0.12)',
    padding: '2px 8px',
    borderRadius: 999,
    fontWeight: 500,
  },
  topBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  topTextBtn: {
    height: 30,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  exportBtn: {
    height: 30,
    padding: '0 11px',
    borderRadius: 7,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-inv)',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  zoomText: { fontSize: 12, fontWeight: 600, minWidth: 42, textAlign: 'center', color: 'var(--text-soft)' },
  divider: { width: 1, height: 18, background: 'var(--border)', margin: '0 2px' },
  dropdown: {
    position: 'absolute',
    top: 34,
    left: 0,
    width: 195,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 9,
    padding: 4,
    zIndex: 40,
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  },
  dropItem: {
    width: '100%',
    textAlign: 'left',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 12.5,
    cursor: 'pointer',
  },
  workspace: { flex: 1, display: 'flex', minHeight: 0, position: 'relative', overflow: 'hidden' },
  leftSidebar: {
    width: 246,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
  },
  rightSidebar: {
    width: 256,
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
  },
  tabRow: { display: 'flex', borderBottom: '1px solid var(--border)' },
  tabBtn: {
    flex: 1,
    padding: '10px 6px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  propHeader: {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--text)',
  },
  sideScroll: { flex: 1, overflowY: 'auto', padding: 12 },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 9px',
    borderRadius: 8,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    marginBottom: 12,
  },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12 },
  groupTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted)',
    marginBottom: 6,
  },
  shapeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  shapeCard: {
    padding: '8px 6px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  shapePreview: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'JetBrains Mono, monospace',
    color: '#6E8AE6',
    background: 'rgba(110,138,230,0.12)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  shapeLabel: { fontSize: 11, fontWeight: 500, textAlign: 'center' },
  fullBtn: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  layerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 9px',
    borderRadius: 8,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
  },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  miniTextBtn: {
    padding: '5px 9px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 11.5,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  findItem: {
    textAlign: 'left',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
  },
  propInput: {
    width: '100%',
    padding: '7px 9px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12.5,
    outline: 'none',
  },
  actionGrid: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tipsBox: {
    padding: 10,
    borderRadius: 9,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    fontSize: 11.5,
    color: 'var(--muted)',
    lineHeight: 1.6,
  },
  mermaidPane: {
    width: 340,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  mermaidHeader: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  smallSelect: {
    padding: '4px 6px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12,
  },
  applyMermaidBtn: {
    padding: '5px 9px',
    borderRadius: 6,
    border: 'none',
    background: '#6E8AE6',
    color: '#fff',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  codeArea: {
    flex: 1,
    padding: 12,
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12.5,
    lineHeight: 1.55,
  },
  mermaidStatus: {
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    fontSize: 11.5,
    maxHeight: 90,
    overflowY: 'auto',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--bg)',
    touchAction: 'none',
  },
  port: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#6E8AE6',
    border: '2px solid var(--surface)',
    cursor: 'crosshair',
    zIndex: 5,
  },
  resizeHandle: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 10,
    height: 10,
    borderRadius: 2,
    background: '#6E8AE6',
    border: '1.5px solid #fff',
    cursor: 'nwse-resize',
  },
  lockBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#D49B38',
  },
  linkBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#6E8AE6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineInput: {
    position: 'absolute',
    inset: 4,
    borderRadius: 6,
    border: '2px solid #6E8AE6',
    background: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
  },
  edgeEditOverlay: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    zIndex: 30,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  minimap: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    background: 'var(--surface-glass)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: 6,
    zIndex: 15,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 95,
    padding: 16,
  },
  exportModal: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 14,
    padding: 18,
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' },
  exportActionBtn: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
