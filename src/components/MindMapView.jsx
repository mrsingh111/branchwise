import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  EyeOff,
  Eye,
  Link2,
  Check,
  RotateCcw,
  LayoutGrid,
  Image as ImageIcon,
  Undo2,
  Pencil,
  Trash2,
  Database,
  Cog,
  GitFork,
  Square,
  Play,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode2,
} from 'lucide-react';
import { BRANCH_COLORS } from '../data/presets';
import { askAboutMap, editMapWithAI, expandNodeWithAI, synthesizeNodes } from '../services/aiProvider';

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

  // Responsive initial zoom so all 6 branches fit cleanly on mobile screens
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const defaultZoom = isMobile ? 0.44 : 0.82;

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(defaultZoom);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Ask about this map
  const [askInput, setAskInput] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askHistory, setAskHistory] = useState([]);
  const [latestReply, setLatestReply] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);

  // Spatial Active Recall & Mastery
  const [recallMode, setRecallMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState(() => new Set());

  // Cross-Node Synthesis
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [activeLink, setActiveLink] = useState(null);

  // Layout switcher & draggable node offsets
  const [layoutMode, setLayoutMode] = useState('radial'); // 'radial' | 'tree' | 'org'
  const [nodeOffsets, setNodeOffsets] = useState({});
  const nodeDragRef = useRef({ active: false, id: null, startX: 0, startY: 0, origDx: 0, origDy: 0, moved: false });

  // Undo stack, inline editing, and Ask vs Edit mode
  const [undoStack, setUndoStack] = useState([]);
  const [barMode, setBarMode] = useState('ask'); // 'ask' | 'edit'
  const [editingNode, setEditingNode] = useState(null); // { id, text, isBranch, branchId }
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [presentIdx, setPresentIdx] = useState(null); // null | 0..branches.length-1

  const commitMapUpdate = (nextMap) => {
    setUndoStack((prev) => [...prev.slice(-14), map]);
    onUpdateMap(nextMap);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    onUpdateMap(prev);
  };

  const layout = useMemo(() => {
    const count = Math.max(1, map.branches.length);
    const angles = getBranchAngles(count);
    const branchRadius = 355;
    const childRadius = 325;
    const leafRadius = 275;

    const rawBranches = map.branches.map((branch, idx) => {
      const color = BRANCH_COLORS[branch.colorIdx % BRANCH_COLORS.length];
      const isExpanded = expandedBranches.has(branch.id);
      const children = isExpanded ? branch.children || [] : [];

      let bx, by, angle;
      let childPositions = [];

      if (layoutMode === 'tree') {
        // Left -> Right structured tree
        const rowGap = 210;
        const totalH = (count - 1) * rowGap;
        bx = CX - 120 + 360;
        by = CY - totalH / 2 + idx * rowGap;
        angle = 0;

        const cGap = 138;
        const cTotal = (children.length - 1) * cGap;
        childPositions = children.map((child, cIdx) => {
          const px = bx + 320;
          const py = by - cTotal / 2 + cIdx * cGap;
          return { ...child, x: px, y: py, lx: px + 295, ly: py, cAngle: 0 };
        });
      } else if (layoutMode === 'org') {
        // Top -> Down hierarchy
        const colGap = 310;
        const totalW = (count - 1) * colGap;
        bx = CX - totalW / 2 + idx * colGap;
        by = CY - 180 + 240;
        angle = Math.PI / 2;

        const cGap = 255;
        const cTotal = (children.length - 1) * cGap;
        childPositions = children.map((child, cIdx) => {
          const px = bx - cTotal / 2 + cIdx * cGap;
          const py = by + 210;
          return { ...child, x: px, y: py, lx: px, ly: py + 150, cAngle: Math.PI / 2 };
        });
      } else {
        // Radial
        angle = angles[idx];
        bx = CX + Math.cos(angle) * branchRadius;
        by = CY + Math.sin(angle) * branchRadius;
        const sectorLimit = (2 * Math.PI) / count;
        const spread = Math.min(sectorLimit * 0.94, 0.5 * Math.max(1, children.length - 1));

        childPositions = children.map((child, cIdx) => {
          const offset =
            children.length === 1
              ? 0
              : -spread / 2 + (cIdx / (children.length - 1)) * spread;
          const cAngle = angle + offset;
          const r = children.length >= 3 && cIdx % 2 === 1 ? childRadius + 64 : childRadius;
          const px = bx + Math.cos(cAngle) * r;
          const py = by + Math.sin(cAngle) * r;
          const lx = px + Math.cos(cAngle) * leafRadius;
          const ly = py + Math.sin(cAngle) * leafRadius;
          return { ...child, x: px, y: py, lx, ly, cAngle };
        });
      }

      return { branch, bx, by, angle, color, isExpanded, childPositions };
    });

    // Build AABB list: [center, ...branches, ...children, ...leaves]
    const rootX = layoutMode === 'tree' ? CX - 120 : CX;
    const rootY = layoutMode === 'org' ? CY - 180 : CY;
    const boxes = [{ x: rootX, y: rootY, w: 270, h: 86 }];
    rawBranches.forEach((b) => {
      boxes.push({ x: b.bx, y: b.by, w: b.isExpanded ? 285 : 235, h: b.isExpanded ? 128 : 54 });
    });
    const fixedCount = boxes.length;

    const childRefs = [];
    const leafRefs = [];
    rawBranches.forEach((b) => {
      b.childPositions.forEach((cp) => {
        const cBox = { x: cp.x, y: cp.y, w: 225, h: 64 };
        boxes.push(cBox);
        childRefs.push({ cp, box: cBox });
        if (cp.summary) {
          const lBox = { x: cp.lx, y: cp.ly, w: 250, h: 126 };
          boxes.push(lBox);
          leafRefs.push({ cp, box: lBox });
        }
      });
    });

    resolveOverlaps(boxes, fixedCount, 40, 24);

    childRefs.forEach(({ cp, box }) => {
      cp.x = box.x;
      cp.y = box.y;
    });
    leafRefs.forEach(({ cp, box }) => {
      cp.lx = box.x;
      cp.ly = box.y;
    });

    // Apply user drag offsets on top
    rawBranches.forEach((b) => {
      const bOff = nodeOffsets[b.branch.id];
      if (bOff) {
        b.bx += bOff.dx;
        b.by += bOff.dy;
      }
      b.childPositions.forEach((cp) => {
        const cOff = nodeOffsets[cp.id];
        if (cOff) {
          cp.x += cOff.dx;
          cp.y += cOff.dy;
        }
        const lOff = nodeOffsets[`leaf-${cp.id}`];
        if (lOff) {
          cp.lx += lOff.dx;
          cp.ly += lOff.dy;
        }
      });
    });

    return rawBranches;
  }, [map.branches, expandedBranches, layoutMode, nodeOffsets]);

  const nodeCoords = useMemo(() => {
    const coords = {};
    layout.forEach((b) => {
      coords[b.branch.id] = { x: b.bx, y: b.by };
      b.childPositions.forEach((cp) => {
        coords[cp.id] = { x: cp.x, y: cp.y };
      });
    });
    return coords;
  }, [layout]);

  const masteredSet = useMemo(() => new Set(map.masteredNodeIds || []), [map.masteredNodeIds]);
  const reviewSet = useMemo(() => new Set(map.reviewNodeIds || []), [map.reviewNodeIds]);

  const setNodeMastery = (nodeId, status) => {
    const mastered = new Set(map.masteredNodeIds || []);
    const review = new Set(map.reviewNodeIds || []);
    mastered.delete(nodeId);
    review.delete(nodeId);
    if (status === 'mastered') mastered.add(nodeId);
    if (status === 'review') review.add(nodeId);
    onUpdateMap({
      ...map,
      masteredNodeIds: Array.from(mastered),
      reviewNodeIds: Array.from(review),
    });
  };

  const handleNodeInteraction = async (branch, node, isBranch) => {
    if (linkMode) {
      if (!linkSource) {
        setLinkSource(node);
        return;
      }
      if (linkSource.id === node.id) return;
      setLinkLoading(true);
      try {
        const newLink = await synthesizeNodes(map, linkSource, node, settings);
        onUpdateMap({
          ...map,
          crossLinks: [...(map.crossLinks || []), newLink],
        });
        setActiveLink(newLink);
      } catch (err) {
        alert(err.message);
      } finally {
        setLinkLoading(false);
        setLinkMode(false);
        setLinkSource(null);
      }
      return;
    }

    if (recallMode) {
      setRevealedIds((prev) => new Set(prev).add(node.id));
    }
    setSelectedNode({ branch, node, isBranch });
  };

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

  const addNodeInline = (branchId, label = 'New idea') => {
    const newId = `n-${Math.random().toString(36).slice(2, 7)}`;
    const targetBranch = map.branches.find((b) => b.id === branchId) || map.branches[0];
    if (!targetBranch) return;
    const newChild = { id: newId, label, summary: 'Double-click or use Go Deeper to expand.', shape: 'card' };
    const updated = {
      ...map,
      branches: map.branches.map((b) =>
        b.id === targetBranch.id ? { ...b, children: [...(b.children || []), newChild] } : b
      ),
    };
    commitMapUpdate(updated);
    setExpandedBranches((prev) => new Set(prev).add(targetBranch.id));
    setSelectedNode({ branch: targetBranch, node: newChild, isBranch: false });
    setEditingNode({ id: newId, text: label, isBranch: false, branchId: targetBranch.id });
  };

  const deleteNodeById = (nodeId, isBranch) => {
    if (isBranch) {
      if (map.branches.length <= 1) return;
      commitMapUpdate({
        ...map,
        branches: map.branches.filter((b) => b.id !== nodeId),
      });
    } else {
      commitMapUpdate({
        ...map,
        branches: map.branches.map((b) => ({
          ...b,
          children: (b.children || []).filter((c) => c.id !== nodeId),
        })),
      });
    }
    setSelectedNode(null);
  };

  const saveInlineEdit = () => {
    if (!editingNode) return;
    const trimmed = editingNode.text.trim();
    if (trimmed) {
      if (editingNode.id === 'root') {
        commitMapUpdate({ ...map, title: trimmed });
      } else if (editingNode.isBranch) {
        commitMapUpdate({
          ...map,
          branches: map.branches.map((b) => (b.id === editingNode.id ? { ...b, label: trimmed } : b)),
        });
      } else {
        commitMapUpdate({
          ...map,
          branches: map.branches.map((b) => ({
            ...b,
            children: (b.children || []).map((c) => (c.id === editingNode.id ? { ...c, label: trimmed } : c)),
          })),
        });
      }
    }
    setEditingNode(null);
  };

  const setNodeShape = (nodeId, isBranch, shape) => {
    if (isBranch) {
      commitMapUpdate({
        ...map,
        branches: map.branches.map((b) => (b.id === nodeId ? { ...b, shape } : b)),
      });
    } else {
      commitMapUpdate({
        ...map,
        branches: map.branches.map((b) => ({
          ...b,
          children: (b.children || []).map((c) => (c.id === nodeId ? { ...c, shape } : c)),
        })),
      });
    }
    setSelectedNode((prev) => (prev ? { ...prev, node: { ...prev.node, shape } } : null));
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingNode) return;
      const tag = e.target?.tagName || document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (!selectedNode) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        addNodeInline(selectedNode.branch.id, 'New sub-idea');
      } else if (e.key === 'Enter' && !selectedNode.isBranch) {
        e.preventDefault();
        addNodeInline(selectedNode.branch.id, 'Sibling idea');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNodeById(selectedNode.node.id, selectedNode.isBranch);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleAsk = async (e) => {
    e.preventDefault();
    const q = askInput.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskInput('');
    try {
      if (barMode === 'edit') {
        const res = await editMapWithAI(map, q, settings);
        let nextBranches = [...map.branches];
        const newExpanded = new Set(expandedBranches);

        (res.operations || []).forEach((op) => {
          if (op.type === 'addBranch') {
            const bid = `b-${Math.random().toString(36).slice(2, 6)}`;
            nextBranches.push({
              id: bid,
              label: op.label || 'New branch',
              colorIdx: nextBranches.length % 6,
              shape: op.shape || 'card',
              summary: op.summary || '',
              children: (op.children || []).map((c, ci) => ({
                id: `${bid}-${ci + 1}`,
                label: c.label || 'Idea',
                summary: c.summary || '',
                shape: c.shape || 'card',
              })),
            });
            newExpanded.add(bid);
          } else if (op.type === 'addChild') {
            const targetId = op.parentBranchId || nextBranches[0]?.id;
            nextBranches = nextBranches.map((b) =>
              b.id === targetId
                ? {
                    ...b,
                    children: [
                      ...(b.children || []),
                      {
                        id: `${b.id}-${Math.random().toString(36).slice(2, 6)}`,
                        label: op.label || 'New idea',
                        summary: op.summary || '',
                        shape: op.shape || 'card',
                      },
                    ],
                  }
                : b
            );
            newExpanded.add(targetId);
          } else if (op.type === 'renameNode') {
            nextBranches = nextBranches.map((b) =>
              b.id === op.nodeId
                ? { ...b, label: op.label || b.label, summary: op.summary ?? b.summary }
                : {
                    ...b,
                    children: (b.children || []).map((c) =>
                      c.id === op.nodeId ? { ...c, label: op.label || c.label, summary: op.summary ?? c.summary } : c
                    ),
                  }
            );
          } else if (op.type === 'deleteNode') {
            nextBranches = nextBranches
              .filter((b) => b.id !== op.nodeId)
              .map((b) => ({ ...b, children: (b.children || []).filter((c) => c.id !== op.nodeId) }));
          } else if (op.type === 'deleteByLabel') {
            const needle = (op.label || '').toLowerCase();
            nextBranches = nextBranches
              .filter((b) => !b.label.toLowerCase().includes(needle))
              .map((b) => ({
                ...b,
                children: (b.children || []).filter((c) => !c.label.toLowerCase().includes(needle)),
              }));
          }
        });

        commitMapUpdate({ ...map, branches: nextBranches });
        setExpandedBranches(newExpanded);
        setLatestReply({ question: `Edit: ${q}`, answer: res.summary, referencedNodeIds: [], suggestedNodes: [] });
        return;
      }

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

  const rootBaseX = layoutMode === 'tree' ? CX - 120 : CX;
  const rootBaseY = layoutMode === 'org' ? CY - 180 : CY;
  const rootOff = nodeOffsets['root'] || { dx: 0, dy: 0 };
  const rootX = rootBaseX + rootOff.dx;
  const rootY = rootBaseY + rootOff.dy;

  const buildSvgString = () => {
    const pad = 120;
    let minX = rootX - 150, maxX = rootX + 150, minY = rootY - 60, maxY = rootY + 60;
    layout.forEach((b) => {
      minX = Math.min(minX, b.bx - 160); maxX = Math.max(maxX, b.bx + 160);
      minY = Math.min(minY, b.by - 80); maxY = Math.max(maxY, b.by + 80);
      b.childPositions.forEach((cp) => {
        minX = Math.min(minX, cp.x - 130, cp.lx - 130);
        maxX = Math.max(maxX, cp.x + 130, cp.lx + 130);
        minY = Math.min(minY, cp.y - 50, cp.ly - 70);
        maxY = Math.max(maxY, cp.y + 50, cp.ly + 70);
      });
    });
    const w = Math.round(maxX - minX + pad * 2);
    const h = Math.round(maxY - minY + pad * 2);
    const ox = -minX + pad;
    const oy = -minY + pad;
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paths = layout.flatMap((b) => {
      const p1 = `<path d="M ${rootX + ox} ${rootY + oy} L ${b.bx + ox} ${b.by + oy}" stroke="${b.color.line}" stroke-width="2" fill="none" />`;
      const p2 = b.childPositions.flatMap((cp) => [
        `<path d="M ${b.bx + ox} ${b.by + oy} L ${cp.x + ox} ${cp.y + oy}" stroke="${b.color.line}" stroke-width="1.6" fill="none" />`,
        cp.summary ? `<path d="M ${cp.x + ox} ${cp.y + oy} L ${cp.lx + ox} ${cp.ly + oy}" stroke="${b.color.line}" stroke-width="1.2" stroke-dasharray="4 3" fill="none" />` : '',
      ]);
      return [p1, ...p2];
    }).join('\n');
    const nodes = [
      `<rect x="${rootX + ox - 110}" y="${rootY + oy - 24}" width="220" height="48" rx="8" fill="#1B1F28" stroke="#475569" /><text x="${rootX + ox}" y="${rootY + oy + 5}" fill="#F2F4F8" font-family="Inter,sans-serif" font-size="14" font-weight="600" text-anchor="middle">${esc(map.title.slice(0, 32))}</text>`,
      ...layout.flatMap((b) => [
        `<rect x="${b.bx + ox - 105}" y="${b.by + oy - 22}" width="210" height="44" rx="8" fill="#171A21" stroke="${b.color.accent}" /><text x="${b.bx + ox}" y="${b.by + oy + 5}" fill="#F2F4F8" font-family="Inter,sans-serif" font-size="13" font-weight="600" text-anchor="middle">${esc(b.branch.label.slice(0, 28))}</text>`,
        ...b.childPositions.map((cp) => `<rect x="${cp.x + ox - 90}" y="${cp.y + oy - 18}" width="180" height="36" rx="6" fill="#161920" stroke="#334155" /><text x="${cp.x + ox}" y="${cp.y + oy + 4}" fill="#CBD5E1" font-family="Inter,sans-serif" font-size="12" text-anchor="middle">${esc(cp.label.slice(0, 24))}</text>`),
      ]),
    ].join('\n');
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#0F1115"/>${paths}${nodes}</svg>`, w, h };
  };

  const exportSvgDiagram = () => {
    const { svg } = buildSvgString();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const exportPngDiagram = () => {
    const { svg, w, h } = buildSvgString();
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pUrl;
        a.download = `${map.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(pUrl);
      }, 'image/png');
    };
    img.src = url;
    setExportMenuOpen(false);
  };

  const copyMermaid = async () => {
    const lines = [
      'mindmap',
      `  root((${map.title.replace(/[()]/g, '')}))`,
      ...map.branches.flatMap((b) => [
        `    ${b.label.replace(/[()]/g, '')}`,
        ...(b.children || []).map((c) => `      ${c.label.replace(/[()]/g, '')}`),
      ]),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedMermaid(true);
      setTimeout(() => setCopiedMermaid(false), 1800);
    } catch {
      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mmd`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportMenuOpen(false);
  };

  const goToPresentSlide = (idx) => {
    const clamped = Math.max(0, Math.min(map.branches.length - 1, idx));
    setPresentIdx(clamped);
    const item = layout[clamped];
    if (item) {
      setExpandedBranches((prev) => new Set(prev).add(item.branch.id));
      markBranchExplored(item.branch.id);
      setPan({
        x: Math.round((CX - item.bx) * zoom * 0.72),
        y: Math.round((CY - item.by) * zoom * 0.72),
      });
    }
  };

  const startNodeDrag = (e, id) => {
    e.stopPropagation();
    const cur = nodeOffsets[id] || { dx: 0, dy: 0 };
    nodeDragRef.current = {
      active: true,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origDx: cur.dx,
      origDy: cur.dy,
      moved: false,
    };
  };

  const onPointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('[data-node]')) return;
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onPointerMove = (e) => {
    if (nodeDragRef.current.active) {
      const dxScreen = e.clientX - nodeDragRef.current.startX;
      const dyScreen = e.clientY - nodeDragRef.current.startY;
      if (Math.hypot(dxScreen, dyScreen) > 4) nodeDragRef.current.moved = true;
      const id = nodeDragRef.current.id;
      setNodeOffsets((prev) => ({
        ...prev,
        [id]: {
          dx: nodeDragRef.current.origDx + dxScreen / zoom,
          dy: nodeDragRef.current.origDy + dyScreen / zoom,
        },
      }));
      return;
    }
    if (!draggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };
  const onPointerUp = () => {
    draggingRef.current = false;
    if (nodeDragRef.current.active) {
      setTimeout(() => {
        nodeDragRef.current.active = false;
      }, 0);
    }
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
      <header style={{ ...styles.topBar, padding: isMobile ? '10px 12px' : '12px 22px' }} className="no-print">
        <button
          onClick={onBack}
          style={{ ...styles.roundBtn, width: isMobile ? 32 : 38, height: isMobile ? 32 : 38 }}
          title="Back to Home"
        >
          <ArrowLeft size={isMobile ? 17 : 19} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <span style={{ ...styles.mapTitle, fontSize: isMobile ? 14 : 17 }}>{map.title}</span>
            <span style={{ ...styles.progressPill, fontSize: isMobile ? 11 : 12.5 }}>
              {exploredCount}/{map.branches.length} {!isMobile && 'explored'}
            </span>
            {masteredSet.size > 0 && (
              <span style={{ ...styles.masteryPill, fontSize: isMobile ? 10.5 : 12 }}>
                {masteredSet.size} mastered
              </span>
            )}
          </div>
          {!isMobile && (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              Click any branch to expand sub-nodes and notes
            </div>
          )}
        </div>

        {undoStack.length > 0 && (
          <button
            onClick={handleUndo}
            style={{ ...styles.roundBtn, width: isMobile ? 32 : 38, height: isMobile ? 32 : 38 }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={isMobile ? 15 : 17} />
          </button>
        )}

        <button
          onClick={onOpenQuiz}
          style={{
            ...styles.quizBtn,
            height: isMobile ? 32 : 38,
            padding: isMobile ? '0 11px' : '0 15px',
            fontSize: isMobile ? 12 : 13.5,
          }}
        >
          <HelpCircle size={isMobile ? 14 : 16} />
          <span>Quiz</span>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setExportMenuOpen((o) => !o)}
            style={{
              ...styles.quizBtn,
              height: isMobile ? 32 : 38,
              padding: isMobile ? '0 10px' : '0 13px',
              fontSize: isMobile ? 12 : 13.5,
            }}
            title="Export PNG, SVG, Markdown, or Mermaid"
          >
            <Download size={isMobile ? 14 : 16} />
            {!isMobile && <span>{copiedMermaid ? 'Copied!' : 'Export'}</span>}
          </button>

          {exportMenuOpen && (
            <div style={styles.exportDropdown}>
              <button onClick={exportPngDiagram} style={styles.exportItem}>
                <ImageIcon size={14} /> <span>Export PNG (2x)</span>
              </button>
              <button onClick={exportSvgDiagram} style={styles.exportItem}>
                <FileCode2 size={14} /> <span>Export SVG</span>
              </button>
              <button
                onClick={() => {
                  exportMarkdown();
                  setExportMenuOpen(false);
                }}
                style={styles.exportItem}
              >
                <Download size={14} /> <span>Export Markdown</span>
              </button>
              <button onClick={copyMermaid} style={styles.exportItem}>
                <Copy size={14} /> <span>Copy Mermaid</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleTheme}
          style={{ ...styles.roundBtn, width: isMobile ? 32 : 38, height: isMobile ? 32 : 38 }}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={isMobile ? 15 : 17} /> : <Moon size={isMobile ? 15 : 17} />}
        </button>

        <button
          onClick={onOpenSettings}
          style={{ ...styles.roundBtn, width: isMobile ? 32 : 38, height: isMobile ? 32 : 38 }}
          title="AI API Settings"
        >
          <Settings size={isMobile ? 15 : 17} />
        </button>
      </header>

      {/* Synthesis Mode Banner */}
      {linkMode && (
        <div style={styles.linkBanner} className="no-print">
          <Link2 size={14} color="#D49B38" />
          <span>
            {linkLoading
              ? 'Synthesizing connection...'
              : linkSource
              ? `Connect “${linkSource.label}” → click a second node`
              : 'Link Ideas: click any first node'}
          </span>
          <button
            onClick={() => {
              setLinkMode(false);
              setLinkSource(null);
            }}
            style={styles.tinyClose}
          >
            <X size={13} />
          </button>
        </div>
      )}

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
            const midX = (rootX + bx) / 2;
            const midY = (rootY + by) / 2 + (bx > rootX ? -24 : 24);
            const rootPath = `M ${rootX} ${rootY} Q ${midX} ${midY} ${bx} ${by}`;
            return (
              <g key={branch.id}>
                {/* Level 0 -> Level 1 base + animated flowing wire */}
                <path
                  d={rootPath}
                  stroke={color.line}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.32"
                />
                <path
                  d={rootPath}
                  stroke={color.line}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.9"
                  className="wire-flow"
                />
                <circle cx={bx} cy={by} r="3.5" fill={color.line} opacity="0.85" />

                {/* Level 1 -> Level 2 & Level 2 -> Level 3 animated wires */}
                {childPositions.map((cp) => {
                  const cmx = (bx + cp.x) / 2;
                  const cmy = (by + cp.y) / 2 + (cp.x > bx ? -18 : 18);
                  const lmx = (cp.x + cp.lx) / 2 + (cp.x > bx ? 14 : -14);
                  const lmy = (cp.y + cp.ly) / 2;
                  const childPath = `M ${bx} ${by} Q ${cmx} ${cmy} ${cp.x} ${cp.y}`;
                  const leafPath = `M ${cp.x} ${cp.y} Q ${lmx} ${lmy} ${cp.lx} ${cp.ly}`;
                  return (
                    <g key={cp.id}>
                      <path
                        d={childPath}
                        stroke={color.line}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill="none"
                        opacity="0.28"
                      />
                      <path
                        d={childPath}
                        stroke={color.line}
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        opacity="0.85"
                        className="wire-flow"
                      />
                      <circle cx={cp.x} cy={cp.y} r="3" fill={color.line} opacity="0.85" />
                      {cp.summary && (
                        <>
                          <path
                            d={leafPath}
                            stroke={color.line}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.25"
                          />
                          <path
                            d={leafPath}
                            stroke={color.line}
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.78"
                            className="wire-flow-slow"
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Cross-Node Synthesis Arcs */}
          {(map.crossLinks || []).map((link) => {
            const a = nodeCoords[link.fromId];
            const b = nodeCoords[link.toId];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - 48;
            const synPath = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
            return (
              <g key={link.id}>
                <path
                  d={synPath}
                  stroke="#D49B38"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.28"
                />
                <path
                  d={synPath}
                  stroke="#D49B38"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.95"
                  className="wire-flow"
                />
              </g>
            );
          })}
        </svg>

        {/* Central Topic Node */}
        <div
          data-node
          onPointerDown={(e) => startNodeDrag(e, 'root')}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingNode({ id: 'root', text: map.title, isBranch: false, branchId: null });
          }}
          onClick={() => {
            if (!nodeDragRef.current.moved) setSelectedNode(null);
          }}
          style={{
            ...styles.centerNode,
            left: rootX,
            top: rootY,
          }}
        >
          {editingNode?.id === 'root' ? (
            <input
              autoFocus
              value={editingNode.text}
              onChange={(e) => setEditingNode({ ...editingNode, text: e.target.value })}
              onBlur={saveInlineEdit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') saveInlineEdit();
                if (e.key === 'Escape') setEditingNode(null);
              }}
              style={styles.inlineInput}
            />
          ) : (
            map.title
          )}
        </div>

        {/* Level 1 Branch Cards, Level 2 Sub-Branch Pills, Level 3 Leaf Explanations */}
        {layout.map(({ branch, bx, by, color, isExpanded, childPositions }) => {
          const isMatched =
            searchLower && branch.label.toLowerCase().includes(searchLower);
          const isHighlighted = highlightedIds.has(branch.id) || isMatched;
          const isExplored = (map.exploredBranchIds || []).includes(branch.id);
          const bShape = branch.shape || 'card';

          return (
            <React.Fragment key={branch.id}>
              {/* Level 1: Architectural Branch Card with left accent stripe */}
              <div
                data-node
                className="ml-node"
                onPointerDown={(e) => startNodeDrag(e, branch.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingNode({ id: branch.id, text: branch.label, isBranch: true, branchId: branch.id });
                }}
                onClick={() => {
                  if (nodeDragRef.current.moved) return;
                  if (linkMode) {
                    handleNodeInteraction(branch, branch, true);
                  } else {
                    toggleBranch(branch, bx, by);
                  }
                }}
                style={{
                  ...styles.branchNode,
                  left: bx,
                  top: by,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: bShape === 'decision' ? `1.5px dashed ${color.accent}` : '1px solid var(--border)',
                  borderLeft: `4px solid ${color.accent}`,
                  borderRadius: bShape === 'process' ? 3 : bShape === 'store' ? '14px 14px 4px 4px' : 12,
                  maxWidth: isExpanded ? 275 : 230,
                  padding: isExpanded ? '13px 17px' : '11px 18px',
                  boxShadow: isHighlighted
                    ? `0 0 0 2px ${color.accent}, 0 12px 28px var(--shadow)`
                    : '0 8px 22px var(--shadow)',
                }}
              >
                {editingNode?.id === branch.id ? (
                  <input
                    autoFocus
                    value={editingNode.text}
                    onChange={(e) => setEditingNode({ ...editingNode, text: e.target.value })}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') saveInlineEdit();
                      if (e.key === 'Escape') setEditingNode(null);
                    }}
                    style={styles.inlineInput}
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.32, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bShape === 'process' && <Cog size={17} color={color.accent} style={{ flexShrink: 0 }} />}
                    {bShape === 'decision' && <GitFork size={17} color={color.accent} style={{ flexShrink: 0 }} />}
                    {bShape === 'store' && <Database size={17} color={color.accent} style={{ flexShrink: 0 }} />}
                    <span>{branch.label}</span>
                  </div>
                )}
                {isExpanded && branch.summary && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      lineHeight: 1.45,
                      marginTop: 7,
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
                const cHigh = highlightedIds.has(cp.id) || cMatch || linkSource?.id === cp.id;
                const isBlurred = recallMode && !revealedIds.has(cp.id) && !masteredSet.has(cp.id);
                const isMastered = masteredSet.has(cp.id);
                const isReview = reviewSet.has(cp.id);
                return (
                  <React.Fragment key={cp.id}>
                    <div
                      data-node
                      className="ml-node"
                      onPointerDown={(e) => startNodeDrag(e, cp.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingNode({ id: cp.id, text: cp.label, isBranch: false, branchId: branch.id });
                      }}
                      onClick={() => {
                        if (!nodeDragRef.current.moved) handleNodeInteraction(branch, cp, false);
                      }}
                      style={{
                        ...styles.childNode,
                        left: cp.x,
                        top: cp.y,
                        borderRadius: cp.shape === 'process' ? 3 : cp.shape === 'store' ? '12px 12px 4px 4px' : 8,
                        borderStyle: cp.shape === 'decision' ? 'dashed' : 'solid',
                        borderColor: isMastered
                          ? '#52A87A'
                          : isReview
                          ? '#D49B38'
                          : cHigh
                          ? color.accent
                          : 'var(--border)',
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
                          background: isMastered ? '#52A87A' : isReview ? '#D49B38' : color.accent,
                          flexShrink: 0,
                        }}
                      />
                      {cp.shape === 'process' && <Cog size={16} color={color.accent} style={{ flexShrink: 0 }} />}
                      {cp.shape === 'decision' && <GitFork size={16} color={color.accent} style={{ flexShrink: 0 }} />}
                      {cp.shape === 'store' && <Database size={16} color={color.accent} style={{ flexShrink: 0 }} />}
                      {editingNode?.id === cp.id ? (
                        <input
                          autoFocus
                          value={editingNode.text}
                          onChange={(e) => setEditingNode({ ...editingNode, text: e.target.value })}
                          onBlur={saveInlineEdit}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') setEditingNode(null);
                          }}
                          style={styles.inlineInput}
                        />
                      ) : (
                        <span style={{ filter: isBlurred ? 'blur(5px)' : 'none', transition: 'filter 0.2s ease' }}>
                          {cp.label}
                        </span>
                      )}
                    </div>

                    {/* Level 3: Callout explanation card right on the canvas */}
                    {cp.summary && (
                      <div
                        data-node
                        onPointerDown={(e) => startNodeDrag(e, `leaf-${cp.id}`)}
                        onClick={() => {
                          if (!nodeDragRef.current.moved) handleNodeInteraction(branch, cp, false);
                        }}
                        style={{
                          ...styles.leafText,
                          left: cp.lx,
                          top: cp.ly,
                          borderLeft: `2.5px solid ${color.accent}`,
                        }}
                      >
                        <div style={{ filter: isBlurred ? 'blur(5px)' : 'none', transition: 'filter 0.2s ease' }}>
                          {cp.summary}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Cross-Node Synthesis Badges */}
        {(map.crossLinks || []).map((link) => {
          const a = nodeCoords[link.fromId];
          const b = nodeCoords[link.toId];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 24;
          return (
            <button
              key={link.id}
              data-node
              onClick={() => setActiveLink(link)}
              style={{ ...styles.linkBadge, left: mx, top: my }}
              title={`${link.fromLabel} ↔ ${link.toLabel}`}
            >
              <Link2 size={11} />
              <span>Synthesis</span>
            </button>
          );
        })}
      </div>

      {/* Compact Node Action Card (Go Deeper with AI) */}
      {selectedNode && (
        <div
          data-scrollable
          style={isMobile ? styles.inspectorMobile : styles.inspector}
          className="no-print"
        >
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {[
              { id: 'card', label: 'Concept', Icon: Square },
              { id: 'process', label: 'Process', Icon: Cog },
              { id: 'decision', label: 'Decision', Icon: GitFork },
              { id: 'store', label: 'Store', Icon: Database },
            ].map(({ id, label, Icon }) => {
              const active = (selectedNode.node.shape || 'card') === id;
              return (
                <button
                  key={id}
                  onClick={() => setNodeShape(selectedNode.node.id, selectedNode.isBranch, id)}
                  style={{
                    ...styles.shapeChip,
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--text)' : 'var(--text-soft)',
                    background: active ? 'var(--surface-2)' : 'transparent',
                  }}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => addNodeInline(selectedNode.branch.id, 'New sub-idea')}
              style={styles.actionBtn}
              title="Shortcut: Tab"
            >
              <Plus size={14} /> <span>Add child</span>
            </button>
            <button
              onClick={() =>
                setEditingNode({
                  id: selectedNode.node.id,
                  text: selectedNode.node.label,
                  isBranch: selectedNode.isBranch,
                  branchId: selectedNode.branch.id,
                })
              }
              style={styles.actionBtn}
            >
              <Pencil size={13} /> <span>Rename</span>
            </button>
            <button
              onClick={() => deleteNodeById(selectedNode.node.id, selectedNode.isBranch)}
              style={{ ...styles.actionBtn, padding: '6px 10px', color: '#E06C52', borderColor: 'rgba(224, 108, 82, 0.35)' }}
              title="Delete (Shortcut: Delete)"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => setNodeMastery(selectedNode.node.id, masteredSet.has(selectedNode.node.id) ? null : 'mastered')}
              style={{
                ...styles.masteryBtn,
                borderColor: masteredSet.has(selectedNode.node.id) ? '#52A87A' : 'var(--border)',
                color: masteredSet.has(selectedNode.node.id) ? '#52A87A' : 'var(--text-soft)',
              }}
            >
              <Check size={13} /> Mastered
            </button>
            <button
              onClick={() => setNodeMastery(selectedNode.node.id, reviewSet.has(selectedNode.node.id) ? null : 'review')}
              style={{
                ...styles.masteryBtn,
                borderColor: reviewSet.has(selectedNode.node.id) ? '#D49B38' : 'var(--border)',
                color: reviewSet.has(selectedNode.node.id) ? '#D49B38' : 'var(--text-soft)',
              }}
            >
              <RotateCcw size={12} /> Review
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleGoDeeper} disabled={deepLoading} style={styles.goDeeperBtn}>
              {deepLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{deepLoading ? 'Expanding...' : 'Go Deeper with AI (+sub-nodes)'}</span>
            </button>
            <button
              onClick={() => {
                setLinkSource(selectedNode.node);
                setLinkMode(true);
                setSelectedNode(null);
              }}
              style={styles.connectBtn}
            >
              <Link2 size={13} />
              <span>Synthesize with another node</span>
            </button>
          </div>
        </div>
      )}

      {/* Cross-Link Synthesis Insight Card */}
      {activeLink && (
        <div data-scrollable style={styles.replyCard} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#D49B38', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link2 size={13} /> {activeLink.fromLabel} ↔ {activeLink.toLabel}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  onUpdateMap({
                    ...map,
                    crossLinks: (map.crossLinks || []).filter((l) => l.id !== activeLink.id),
                  });
                  setActiveLink(null);
                }}
                style={{ ...styles.tinyClose, width: 'auto', padding: '0 8px', fontSize: 11 }}
              >
                Remove
              </button>
              <button onClick={() => setActiveLink(null)} style={styles.tinyClose}>
                <X size={14} />
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {activeLink.insight}
          </p>
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

      {/* Presentation / Step-Through Card */}
      {presentIdx !== null && map.branches[presentIdx] && (
        <div style={styles.presentBar} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              SLIDE {presentIdx + 1} / {map.branches.length}
            </span>
            <button onClick={() => setPresentIdx(null)} style={styles.tinyClose} title="Exit Presentation">
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {map.branches[presentIdx].label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.45, marginBottom: 10 }}>
            {map.branches[presentIdx].summary}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={() => goToPresentSlide(presentIdx - 1)}
              disabled={presentIdx === 0}
              style={{ ...styles.actionBtn, opacity: presentIdx === 0 ? 0.45 : 1 }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => goToPresentSlide(presentIdx + 1)}
              disabled={presentIdx >= map.branches.length - 1}
              style={{ ...styles.actionBtn, opacity: presentIdx >= map.branches.length - 1 ? 0.45 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls + Ask About This Map */}
      <div style={styles.bottomDock} className="no-print">
        <div style={styles.toolbarRow}>
          <div style={styles.toolGroup}>
            <button onClick={() => setZoom((z) => Math.max(0.38, +(z - 0.12).toFixed(2)))} style={styles.toolBtn} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(defaultZoom); }} style={styles.toolBtn} title="Fit to screen">
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
                setRecallMode((r) => !r);
                setRevealedIds(new Set());
              }}
              style={{
                ...styles.toolBtn,
                width: 'auto',
                padding: '0 9px',
                fontSize: 12,
                color: recallMode ? '#52A87A' : 'var(--text-soft)',
              }}
              title="Blur nodes to test your memory"
            >
              {recallMode ? <Eye size={14} style={{ marginRight: 5 }} /> : <EyeOff size={14} style={{ marginRight: 5 }} />}
              Recall
            </button>
            <button
              onClick={() => {
                setLinkMode((l) => !l);
                setLinkSource(null);
              }}
              style={{
                ...styles.toolBtn,
                width: 'auto',
                padding: '0 9px',
                fontSize: 12,
                color: linkMode ? '#D49B38' : 'var(--text-soft)',
              }}
              title="Synthesize a connection between any 2 nodes"
            >
              <Link2 size={14} style={{ marginRight: 5 }} />
              Link
            </button>
            <button
              onClick={() => {
                const next = layoutMode === 'radial' ? 'tree' : layoutMode === 'tree' ? 'org' : 'radial';
                setLayoutMode(next);
                setNodeOffsets({});
                setPan({ x: 0, y: 0 });
              }}
              style={{ ...styles.toolBtn, width: 'auto', padding: '0 9px', fontSize: 12 }}
              title="Switch layout: Radial / Tree / Org"
            >
              <LayoutGrid size={14} style={{ marginRight: 5 }} />
              {layoutMode === 'radial' ? 'Radial' : layoutMode === 'tree' ? 'Tree' : 'Org'}
            </button>
            <button
              onClick={() => {
                if (presentIdx !== null) setPresentIdx(null);
                else goToPresentSlide(0);
              }}
              style={{
                ...styles.toolBtn,
                width: 'auto',
                padding: '0 9px',
                fontSize: 12,
                color: presentIdx !== null ? '#52A87A' : 'var(--text-soft)',
              }}
              title="Step-through presentation mode"
            >
              <Play size={13} style={{ marginRight: 5 }} />
              Present
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
              {expandedBranches.size === map.branches.length ? 'Collapse' : 'Expand all'}
            </button>
          </div>
        </div>

        <form onSubmit={handleAsk} className="ml-input-box" style={styles.askBar}>
          <div style={styles.modeToggle}>
            <button
              type="button"
              onClick={() => setBarMode('ask')}
              style={{
                ...styles.modeBtn,
                background: barMode === 'ask' ? 'var(--surface-2)' : 'transparent',
                color: barMode === 'ask' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              Ask
            </button>
            <button
              type="button"
              onClick={() => setBarMode('edit')}
              style={{
                ...styles.modeBtn,
                background: barMode === 'edit' ? 'var(--surface-2)' : 'transparent',
                color: barMode === 'edit' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              Edit Map
            </button>
          </div>
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            placeholder={
              barMode === 'edit'
                ? 'e.g. "Add a branch about security" or "Remove X"...'
                : 'Query this map or propose new nodes...'
            }
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
    touchAction: 'none',
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
  masteryPill: {
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 4,
    background: 'rgba(82, 168, 122, 0.14)',
    border: '1px solid rgba(82, 168, 122, 0.35)',
    color: '#52A87A',
    flexShrink: 0,
  },
  linkBanner: {
    position: 'fixed',
    top: 66,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 26,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid rgba(212, 155, 56, 0.45)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12.5,
    color: 'var(--text)',
    boxShadow: '0 8px 24px var(--shadow)',
  },
  linkBadge: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: 'var(--surface)',
    border: '1px solid #D49B38',
    color: '#D49B38',
    borderRadius: 999,
    padding: '3px 9px',
    fontSize: 11,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    boxShadow: '0 4px 12px var(--shadow)',
  },
  actionBtn: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text)',
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  masteryBtn: {
    flex: 1,
    background: 'var(--surface-2)',
    border: '1px solid',
    borderRadius: 7,
    padding: '7px 8px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  connectBtn: {
    width: '100%',
    background: 'rgba(212, 155, 56, 0.12)',
    border: '1px solid rgba(212, 155, 56, 0.35)',
    color: '#D49B38',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
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
  exportDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 175,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    boxShadow: '0 14px 36px var(--shadow)',
    zIndex: 40,
  },
  exportItem: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    cursor: 'pointer',
  },
  presentBar: {
    position: 'fixed',
    bottom: 118,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    width: 'min(440px, 92vw)',
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border-strong)',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 16px 40px var(--shadow)',
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
    borderRadius: 10,
    padding: '16px 24px',
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 17,
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
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 5,
    border: '1px solid',
  },
  childNode: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: 'var(--child-bg)',
    border: '1px solid',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    maxWidth: 215,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    cursor: 'pointer',
  },
  leafText: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: 240,
    fontSize: 13.5,
    lineHeight: 1.48,
    color: 'var(--text-soft)',
    textAlign: 'left',
    background: 'var(--leaf-bg)',
    border: '1px solid var(--border)',
    padding: '9px 12px',
    borderRadius: 8,
    boxShadow: '0 2px 8px var(--shadow)',
    cursor: 'pointer',
  },
  inspector: {
    position: 'fixed',
    top: 72,
    right: 16,
    zIndex: 25,
    width: 'min(290px, 85vw)',
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 13,
    boxShadow: '0 14px 34px var(--shadow)',
  },
  inspectorMobile: {
    position: 'fixed',
    bottom: 112,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    width: 'min(360px, 92vw)',
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '10px 12px',
    boxShadow: '0 10px 28px var(--shadow)',
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
  inlineInput: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 5,
    padding: '3px 6px',
    color: 'var(--text)',
    fontSize: 13.5,
    outline: 'none',
  },
  shapeChip: {
    border: '1px solid',
    borderRadius: 7,
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  modeToggle: {
    display: 'flex',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: 2,
    flexShrink: 0,
  },
  modeBtn: {
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  askBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '5px 5px 5px 8px',
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
