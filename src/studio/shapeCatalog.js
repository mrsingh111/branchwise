// Shape Catalog, Connector Geometry, and Alignment Utilities for Branchwise Studio

export const SHAPE_GROUPS = [
  {
    name: 'Flowchart & Core',
    items: [
      { shape: 'rect', label: 'Process', w: 165, h: 64 },
      { shape: 'rounded', label: 'Rounded Step', w: 165, h: 64 },
      { shape: 'diamond', label: 'Decision', w: 150, h: 92 },
      { shape: 'start', label: 'Start / End', w: 145, h: 52 },
      { shape: 'circle', label: 'Circle / Node', w: 98, h: 98 },
      { shape: 'document', label: 'Document', w: 165, h: 72 },
      { shape: 'sticky', label: 'Sticky Note', w: 165, h: 110 },
      { shape: 'text', label: 'Text Block', w: 150, h: 48 },
      { shape: 'container', label: 'Container', w: 340, h: 220 },
    ],
  },
  {
    name: 'Architecture & Cloud',
    items: [
      { shape: 'service', label: 'Service', w: 170, h: 68 },
      { shape: 'api', label: 'API Endpoint', w: 170, h: 68 },
      { shape: 'database', label: 'Database', w: 145, h: 90 },
      { shape: 'queue', label: 'Message Queue', w: 175, h: 64 },
      { shape: 'cloud', label: 'Cloud / External', w: 175, h: 74 },
    ],
  },
  {
    name: 'Networking',
    items: [
      { shape: 'server', label: 'Server', w: 165, h: 70 },
      { shape: 'firewall', label: 'Firewall', w: 165, h: 68 },
      { shape: 'switch', label: 'Switch / Router', w: 165, h: 68 },
    ],
  },
  {
    name: 'UML & Database',
    items: [
      { shape: 'class', label: 'UML Class', w: 195, h: 128 },
      { shape: 'er_table', label: 'ER Table', w: 195, h: 128 },
    ],
  },
];

export const COLOR_SWATCHES = [
  { name: 'Default', fill: '', stroke: '' },
  { name: 'Indigo', fill: 'rgba(110, 138, 230, 0.16)', stroke: '#6E8AE6' },
  { name: 'Emerald', fill: 'rgba(82, 168, 122, 0.16)', stroke: '#52A87A' },
  { name: 'Amber', fill: 'rgba(212, 155, 56, 0.18)', stroke: '#D49B38' },
  { name: 'Rose', fill: 'rgba(224, 108, 117, 0.16)', stroke: '#E06C75' },
  { name: 'Cyan', fill: 'rgba(72, 178, 198, 0.16)', stroke: '#48B2C6' },
  { name: 'Violet', fill: 'rgba(167, 139, 250, 0.16)', stroke: '#A78BFA' },
  { name: 'Sticky Yellow', fill: 'rgba(250, 204, 21, 0.22)', stroke: '#EAB308' },
];

export function getNodePorts(node) {
  const { x, y, w, h } = node;
  return {
    top: { x: x + w / 2, y },
    right: { x: x + w, y: y + h / 2 },
    bottom: { x: x + w / 2, y: y + h },
    left: { x, y: y + h / 2 },
  };
}

export function getBestPortPair(sourceNode, targetNode) {
  const sPorts = getNodePorts(sourceNode);
  const tPorts = getNodePorts(targetNode);
  const sCx = sourceNode.x + sourceNode.w / 2;
  const sCy = sourceNode.y + sourceNode.h / 2;
  const tCx = targetNode.x + targetNode.w / 2;
  const tCy = targetNode.y + targetNode.h / 2;
  const dx = tCx - sCx;
  const dy = tCy - sCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { start: sPorts.right, end: tPorts.left, sDir: 'right', tDir: 'left' }
      : { start: sPorts.left, end: tPorts.right, sDir: 'left', tDir: 'right' };
  }
  return dy >= 0
    ? { start: sPorts.bottom, end: tPorts.top, sDir: 'bottom', tDir: 'top' }
    : { start: sPorts.top, end: tPorts.bottom, sDir: 'top', tDir: 'bottom' };
}

export function buildEdgePath(sourceNode, targetNode, routing = 'orthogonal') {
  const { start, end, sDir } = getBestPortPair(sourceNode, targetNode);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  if (routing === 'straight') {
    return {
      d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      labelX: midX,
      labelY: midY,
    };
  }

  if (routing === 'curved') {
    const isHoriz = sDir === 'left' || sDir === 'right';
    const offset = Math.max(40, Math.min(140, (isHoriz ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)) * 0.5));
    const c1x = isHoriz ? start.x + (sDir === 'right' ? offset : -offset) : start.x;
    const c1y = isHoriz ? start.y : start.y + (sDir === 'bottom' ? offset : -offset);
    const c2x = isHoriz ? end.x + (sDir === 'right' ? -offset : offset) : end.x;
    const c2y = isHoriz ? end.y : end.y + (sDir === 'bottom' ? -offset : offset);
    return {
      d: `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`,
      labelX: 0.125 * start.x + 0.375 * c1x + 0.375 * c2x + 0.125 * end.x,
      labelY: 0.125 * start.y + 0.375 * c1y + 0.375 * c2y + 0.125 * end.y,
    };
  }

  // Orthogonal
  const isHoriz = sDir === 'left' || sDir === 'right';
  if (isHoriz) {
    return {
      d: `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`,
      labelX: midX,
      labelY: midY,
    };
  }
  return {
    d: `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`,
    labelX: midX,
    labelY: midY,
  };
}

export function alignSelectedNodes(nodes, selectedIds, mode) {
  const selected = nodes.filter((n) => selectedIds.includes(n.id) && !n.locked);
  if (selected.length < 2) return nodes;

  const minX = Math.min(...selected.map((n) => n.x));
  const maxX = Math.max(...selected.map((n) => n.x + n.w));
  const minY = Math.min(...selected.map((n) => n.y));
  const maxY = Math.max(...selected.map((n) => n.y + n.h));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const map = new Map();
  for (const n of selected) {
    let next = { ...n };
    if (mode === 'left') next.x = minX;
    if (mode === 'center') next.x = centerX - n.w / 2;
    if (mode === 'right') next.x = maxX - n.w;
    if (mode === 'top') next.y = minY;
    if (mode === 'middle') next.y = centerY - n.h / 2;
    if (mode === 'bottom') next.y = maxY - n.h;
    map.set(n.id, next);
  }

  return nodes.map((n) => map.get(n.id) || n);
}

export function distributeSelectedNodes(nodes, selectedIds, axis = 'horizontal') {
  const selected = nodes.filter((n) => selectedIds.includes(n.id) && !n.locked);
  if (selected.length < 3) return nodes;

  const sorted = [...selected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const map = new Map();

  if (axis === 'horizontal') {
    const totalSpan = last.x + last.w - first.x;
    const sumW = sorted.reduce((acc, n) => acc + n.w, 0);
    const gap = (totalSpan - sumW) / (sorted.length - 1);
    let cursor = first.x;
    for (const n of sorted) {
      map.set(n.id, { ...n, x: cursor });
      cursor += n.w + gap;
    }
  } else {
    const totalSpan = last.y + last.h - first.y;
    const sumH = sorted.reduce((acc, n) => acc + n.h, 0);
    const gap = (totalSpan - sumH) / (sorted.length - 1);
    let cursor = first.y;
    for (const n of sorted) {
      map.set(n.id, { ...n, y: cursor });
      cursor += n.h + gap;
    }
  }

  return nodes.map((n) => map.get(n.id) || n);
}

export function applyGridAutoLayout(nodes) {
  const containers = nodes.filter((n) => n.shape === 'container');
  const regular = nodes.filter((n) => n.shape !== 'container');
  const cols = Math.max(1, Math.ceil(Math.sqrt(regular.length)));
  const laid = regular.map((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return { ...n, x: 100 + col * 230, y: 100 + row * 150 };
  });
  return [...containers, ...laid];
}
