// Validation and sanitization helpers for diagram imports and external node hyperlinks

import { makeId } from '../storage/db.js';

export function sanitizeExternalUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : '';
}

export function validateAndNormalizeDiagramJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON syntax.');
  }

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
  const safeEdges = rawEdges.filter(
    (ed) => ed && nodeIds.has(String(ed.source)) && nodeIds.has(String(ed.target))
  );

  return { nodes: safeNodes, edges: safeEdges };
}
