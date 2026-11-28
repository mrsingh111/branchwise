// CSV Dataset Importer for Branchwise 2.0
// Supports two formats:
// 1. Edge list: source,target,label (or from,to,label)
// 2. Node table: id,label,shape,parent (or category)

import { autoLayoutNodes } from './mermaidEngine.js';

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result.map((c) => c.replace(/^"|"$/g, '').trim());
}

export function parseCsvToDiagram(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitCsvLine);

  const srcIdx = headers.findIndex((h) => ['source', 'from', 'src', 'parent'].includes(h));
  const tgtIdx = headers.findIndex((h) => ['target', 'to', 'dst', 'child'].includes(h));
  const lblIdx = headers.findIndex((h) => ['label', 'name', 'title', 'relation'].includes(h));
  const shapeIdx = headers.findIndex((h) => ['shape', 'type', 'kind'].includes(h));

  const nodeMap = new Map();
  const edges = [];

  const ensureNode = (id, label, shape = 'rect') => {
    const cleanId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_') || `n_${nodeMap.size + 1}`;
    if (!nodeMap.has(cleanId)) {
      nodeMap.set(cleanId, {
        id: cleanId,
        label: label || id || cleanId,
        shape: shape || 'rect',
        x: 100,
        y: 100,
        w: 165,
        h: 66,
        fill: '',
        stroke: '',
        textColor: '',
        fontSize: 13,
        layerId: 'layer_default',
        locked: false,
        metadata: {},
      });
    }
    return nodeMap.get(cleanId);
  };

  if (srcIdx !== -1 && tgtIdx !== -1) {
    // Edge-list CSV
    rows.forEach((cols, i) => {
      const s = cols[srcIdx];
      const t = cols[tgtIdx];
      if (!s || !t) return;
      const srcNode = ensureNode(s, s);
      const tgtNode = ensureNode(t, t, shapeIdx !== -1 ? cols[shapeIdx] : 'rect');
      edges.push({
        id: `csv_e_${i + 1}`,
        source: srcNode.id,
        target: tgtNode.id,
        label: lblIdx !== -1 ? cols[lblIdx] || '' : '',
        routing: 'orthogonal',
        lineStyle: 'solid',
        arrowEnd: 'arrow',
        arrowStart: 'none',
        stroke: '',
        strokeWidth: 2,
        layerId: 'layer_default',
      });
    });
  } else {
    // Generic table CSV -> create root + row nodes
    const idIdx = headers.indexOf('id');
    const nameIdx = lblIdx !== -1 ? lblIdx : 0;
    const root = ensureNode('csv_root', 'Dataset', 'start');
    rows.forEach((cols, i) => {
      const label = cols[nameIdx] || `Row ${i + 1}`;
      const id = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `row_${i + 1}`;
      const shape = shapeIdx !== -1 && cols[shapeIdx] ? cols[shapeIdx] : 'rect';
      const node = ensureNode(id, label, shape);
      edges.push({
        id: `csv_e_${i + 1}`,
        source: root.id,
        target: node.id,
        label: '',
        routing: 'orthogonal',
        lineStyle: 'solid',
        arrowEnd: 'arrow',
        arrowStart: 'none',
        stroke: '',
        strokeWidth: 2,
        layerId: 'layer_default',
      });
    });
  }

  const nodes = autoLayoutNodes(Array.from(nodeMap.values()), edges, 'TD');
  return { nodes, edges };
}
