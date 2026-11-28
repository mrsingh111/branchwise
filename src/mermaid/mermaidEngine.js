// Modular Mermaid Parser, Validator, Auto-Layout, and Serializer for Branchwise 2.0
// Explicitly supports: flowchart/graph, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram

function sanitizeId(raw, fallback = 'node') {
  const clean = String(raw || fallback).replace(/[^a-zA-Z0-9_]/g, '_');
  return clean || fallback;
}

function defaultSizeForShape(shape, label = '') {
  const len = String(label).length;
  const minW = Math.max(130, Math.min(240, 70 + len * 6));
  switch (shape) {
    case 'diamond':
    case 'decision':
      return { w: Math.max(140, minW), h: 92 };
    case 'circle':
      return { w: 108, h: 108 };
    case 'database':
      return { w: 150, h: 92 };
    case 'class':
    case 'er_table':
      return { w: 200, h: 136 };
    case 'start':
    case 'end':
      return { w: 140, h: 54 };
    case 'container':
      return { w: 360, h: 240 };
    default:
      return { w: minW, h: 66 };
  }
}

function makeNode(id, label, shape = 'rect', extra = {}) {
  const sz = defaultSizeForShape(shape, label);
  return {
    id,
    label: label || id,
    shape,
    x: 100,
    y: 100,
    w: extra.w || sz.w,
    h: extra.h || sz.h,
    fill: extra.fill || '',
    stroke: extra.stroke || '',
    textColor: extra.textColor || '',
    fontSize: extra.fontSize || 13,
    layerId: 'layer_default',
    locked: false,
    groupId: extra.groupId || null,
    metadata: extra.metadata || {},
    ...extra,
  };
}

function makeEdge(id, source, target, opts = {}) {
  return {
    id,
    source,
    target,
    label: opts.label || '',
    routing: opts.routing || 'orthogonal',
    lineStyle: opts.lineStyle || 'solid',
    arrowEnd: opts.arrowEnd !== undefined ? opts.arrowEnd : 'arrow',
    arrowStart: opts.arrowStart || 'none',
    stroke: opts.stroke || '',
    strokeWidth: opts.strokeWidth || 2,
    layerId: 'layer_default',
  };
}

function parseNodeToken(rawToken) {
  const token = rawToken.trim();
  // Match ID + bracketed shape
  const patterns = [
    { re: /^([a-zA-Z0-9_-]+)\(\(\((.+?)\)\)\)$/, shape: 'circle' },
    { re: /^([a-zA-Z0-9_-]+)\(\((.+?)\)\)$/, shape: 'circle' },
    { re: /^([a-zA-Z0-9_-]+)\(\[(.+?)\]\)$/, shape: 'start' },
    { re: /^([a-zA-Z0-9_-]+)\[\((.+?)\)\]$/, shape: 'database' },
    { re: /^([a-zA-Z0-9_-]+)\[\[(.+?)\]\]$/, shape: 'rect' },
    { re: /^([a-zA-Z0-9_-]+)\{\{(.+?)\}\}$/, shape: 'diamond' },
    { re: /^([a-zA-Z0-9_-]+)\{(.+?)\}$/, shape: 'diamond' },
    { re: /^([a-zA-Z0-9_-]+)\[\/(.+?)\/\]$/, shape: 'document' },
    { re: /^([a-zA-Z0-9_-]+)\[(.+?)\]$/, shape: 'rect' },
    { re: /^([a-zA-Z0-9_-]+)\((.+?)\)$/, shape: 'rounded' },
  ];
  for (const p of patterns) {
    const m = token.match(p.re);
    if (m) {
      return {
        id: m[1].trim(),
        label: m[2].replace(/^["']|["']$/g, '').trim(),
        shape: p.shape,
        explicit: true,
      };
    }
  }
  const bare = token.match(/^([a-zA-Z0-9_-]+)$/);
  if (bare) {
    return { id: bare[1], label: bare[1], shape: 'rect', explicit: false };
  }
  return null;
}

export function detectMermaidType(code) {
  const lines = String(code || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));
  if (!lines.length) return 'unknown';
  const head = lines[0].toLowerCase();
  if (head.startsWith('flowchart') || head.startsWith('graph')) return 'flowchart';
  if (head.startsWith('sequencediagram')) return 'sequenceDiagram';
  if (head.startsWith('classdiagram')) return 'classDiagram';
  if (head.startsWith('statediagram')) return 'stateDiagram-v2';
  if (head.startsWith('erdiagram')) return 'erDiagram';
  if (head.startsWith('mindmap')) return 'mindmap';
  return 'unknown';
}

export function validateMermaid(code) {
  const raw = String(code || '');
  const lines = raw.split(/\r?\n/);
  const errors = [];
  const warnings = [];

  const nonEmpty = lines
    .map((text, idx) => ({ text: text.trim(), line: idx + 1 }))
    .filter((l) => l.text && !l.text.startsWith('%%'));

  if (!nonEmpty.length) {
    return {
      valid: false,
      diagramType: 'unknown',
      errors: [{ line: 1, message: 'Mermaid source is empty.' }],
      warnings: [],
    };
  }

  const diagramType = detectMermaidType(raw);
  if (diagramType === 'unknown') {
    errors.push({
      line: nonEmpty[0].line,
      message: `Unsupported or missing diagram header "${nonEmpty[0].text}". Supported: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram.`,
    });
    return { valid: false, diagramType, errors, warnings };
  }

  // Check balanced braces and subgraphs
  let braceDepth = 0;
  let subgraphDepth = 0;
  for (const item of nonEmpty.slice(1)) {
    const t = item.text;
    if (/^subgraph\b/i.test(t)) subgraphDepth++;
    if (t === 'end') {
      if (subgraphDepth > 0) subgraphDepth--;
      else warnings.push({ line: item.line, message: 'Unexpected "end" without matching subgraph.' });
    }
    if (t.endsWith('{')) braceDepth++;
    if (t === '}') {
      braceDepth--;
      if (braceDepth < 0) {
        errors.push({ line: item.line, message: 'Unexpected closing brace "}".' });
        braceDepth = 0;
      }
    }
  }
  if (braceDepth > 0) {
    errors.push({ line: nonEmpty[nonEmpty.length - 1].line, message: 'Unclosed "{" block.' });
  }
  if (subgraphDepth > 0) {
    errors.push({ line: nonEmpty[nonEmpty.length - 1].line, message: 'Unclosed "subgraph" block (missing "end").' });
  }

  return {
    valid: errors.length === 0,
    diagramType,
    errors,
    warnings,
  };
}

export function autoLayoutNodes(nodes, edges, direction = 'TD') {
  const containers = nodes.filter((n) => n.shape === 'container');
  const regular = nodes.filter((n) => n.shape !== 'container');
  if (!regular.length) return nodes;

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const adj = new Map(regular.map((n) => [n.id, []]));
  const inDeg = new Map(regular.map((n) => [n.id, 0]));

  for (const e of edges) {
    if (adj.has(e.source) && inDeg.has(e.target) && e.source !== e.target) {
      adj.get(e.source).push(e.target);
      inDeg.set(e.target, inDeg.get(e.target) + 1);
    }
  }

  // BFS topological layering
  const level = new Map();
  const queue = [];
  for (const n of regular) {
    if ((inDeg.get(n.id) || 0) === 0) {
      level.set(n.id, 0);
      queue.push(n.id);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curLvl = level.get(cur) || 0;
    for (const nxt of adj.get(cur) || []) {
      if (!level.has(nxt)) {
        level.set(nxt, curLvl + 1);
        queue.push(nxt);
      }
    }
  }
  for (const n of regular) {
    if (!level.has(n.id)) level.set(n.id, 0);
  }

  const layers = new Map();
  for (const n of regular) {
    const l = level.get(n.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l).push(n);
  }

  const gapX = isHorizontal ? 250 : 210;
  const gapY = isHorizontal ? 130 : 145;
  const startX = 120;
  const startY = 100;

  const positioned = new Map();
  const sortedLevels = Array.from(layers.keys()).sort((a, b) => a - b);
  for (const lvl of sortedLevels) {
    const group = layers.get(lvl);
    group.forEach((n, idx) => {
      const x = isHorizontal ? startX + lvl * gapX : startX + idx * gapX;
      const y = isHorizontal ? startY + idx * gapY : startY + lvl * gapY;
      positioned.set(n.id, { ...n, x, y });
    });
  }

  // Resize containers to wrap their member nodes
  const nextContainers = containers.map((c) => {
    const members = Array.from(positioned.values()).filter((n) => n.groupId === c.id);
    if (!members.length) return c;
    const minX = Math.min(...members.map((m) => m.x)) - 28;
    const minY = Math.min(...members.map((m) => m.y)) - 42;
    const maxX = Math.max(...members.map((m) => m.x + m.w)) + 28;
    const maxY = Math.max(...members.map((m) => m.y + m.h)) + 28;
    return { ...c, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  });

  return [...nextContainers, ...Array.from(positioned.values())];
}

function parseFlowchart(lines) {
  const header = lines[0].trim();
  const dirMatch = header.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
  const direction = dirMatch ? dirMatch[1].toUpperCase() : 'TD';

  const nodeMap = new Map();
  const edges = [];
  const errors = [];
  const containers = [];
  let activeSubgraph = null;

  const upsertNode = (tok) => {
    if (!tok) return null;
    const existing = nodeMap.get(tok.id);
    if (!existing) {
      const created = makeNode(tok.id, tok.label, tok.shape, {
        groupId: activeSubgraph ? activeSubgraph.id : null,
      });
      nodeMap.set(tok.id, created);
      return created;
    }
    if (tok.explicit) {
      const sz = defaultSizeForShape(tok.shape, tok.label);
      existing.label = tok.label;
      existing.shape = tok.shape;
      existing.w = sz.w;
      existing.h = sz.h;
    }
    if (activeSubgraph && !existing.groupId) {
      existing.groupId = activeSubgraph.id;
    }
    return existing;
  };

  const edgeRegex = /^(.+?)\s*(-->|---|-\.->|==>|--\s+[^-][^>]*\s+-->|-->\|[^|]+\||-\.\s+[^.]+\s+\.->|==\s+[^=]+\s+==>)\s*(.+)$/;

  lines.slice(1).forEach((rawLine, i) => {
    const lineNum = i + 2;
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || line.startsWith('classDef') || line.startsWith('style')) return;

    const subMatch = line.match(/^subgraph\s+(.+)$/i);
    if (subMatch) {
      const title = subMatch[1].replace(/^["']|["']$/g, '').trim();
      const cid = sanitizeId(`sub_${title}`, `sub_${containers.length + 1}`);
      activeSubgraph = makeNode(cid, title, 'container');
      containers.push(activeSubgraph);
      return;
    }
    if (line === 'end') {
      activeSubgraph = null;
      return;
    }

    const em = line.match(edgeRegex);
    if (em) {
      const leftTok = parseNodeToken(em[1]);
      const op = em[2].trim();
      const rightPart = em[3].trim();
      // Handle pipe label after --> e.g. -->|Yes| B
      let label = '';
      let rightRaw = rightPart;
      const pipeMatch = op.match(/\|([^|]+)\|$/);
      if (pipeMatch) label = pipeMatch[1].trim();
      const midMatch = op.match(/^--\s+(.+?)\s+-->$/);
      if (midMatch) label = midMatch[1].trim();
      const dotMatch = op.match(/^-\.\s+(.+?)\s+\.->$/);
      if (dotMatch) label = dotMatch[1].trim();
      const eqMatch = op.match(/^==\s+(.+?)\s+==>$/);
      if (eqMatch) label = eqMatch[1].trim();

      const rightPipe = rightPart.match(/^\|([^|]+)\|\s*(.+)$/);
      if (rightPipe) {
        label = rightPipe[1].trim();
        rightRaw = rightPipe[2].trim();
      }

      const rightTok = parseNodeToken(rightRaw);
      if (!leftTok || !rightTok) {
        errors.push({ line: lineNum, message: `Could not parse edge endpoints in "${line}"` });
        return;
      }
      upsertNode(leftTok);
      upsertNode(rightTok);
      const lineStyle = op.includes('-.') ? 'dashed' : op.includes('==') ? 'thick' : 'solid';
      const arrowEnd = op === '---' ? 'none' : 'arrow';
      edges.push(
        makeEdge(`e_${edges.length + 1}`, leftTok.id, rightTok.id, {
          label,
          lineStyle,
          arrowEnd,
          strokeWidth: op.includes('==') ? 3 : 2,
        })
      );
      return;
    }

    const singleTok = parseNodeToken(line);
    if (singleTok) {
      upsertNode(singleTok);
    } else {
      errors.push({ line: lineNum, message: `Unrecognized flowchart syntax: "${line}"` });
    }
  });

  const allNodes = autoLayoutNodes([...containers, ...Array.from(nodeMap.values())], edges, direction);
  return { diagramType: 'flowchart', direction, nodes: allNodes, edges, errors };
}

function parseSequence(lines) {
  const participants = new Map();
  const edges = [];
  const errors = [];

  const ensureParticipant = (id, label, shape = 'rect') => {
    const cleanId = sanitizeId(id);
    if (!participants.has(cleanId)) {
      const idx = participants.size;
      participants.set(
        cleanId,
        makeNode(cleanId, label || id, shape, {
          x: 100 + idx * 230,
          y: 90,
          w: 150,
          h: 60,
          metadata: { role: 'participant' },
        })
      );
    }
    return participants.get(cleanId);
  };

  lines.slice(1).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) return;
    const partMatch = line.match(/^(participant|actor)\s+([a-zA-Z0-9_-]+)(?:\s+as\s+(.+))?$/i);
    if (partMatch) {
      ensureParticipant(partMatch[2], partMatch[3] || partMatch[2], partMatch[1].toLowerCase() === 'actor' ? 'circle' : 'rect');
      return;
    }
    const msgMatch = line.match(/^([a-zA-Z0-9_-]+)\s*(-->>|->>|-->|->)\s*([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (msgMatch) {
      const from = ensureParticipant(msgMatch[1]);
      const to = ensureParticipant(msgMatch[3]);
      const arrow = msgMatch[2];
      edges.push(
        makeEdge(`seq_${edges.length + 1}`, from.id, to.id, {
          label: `${edges.length + 1}. ${msgMatch[4].trim()}`,
          lineStyle: arrow.startsWith('--') ? 'dashed' : 'solid',
          arrowEnd: arrow.includes('>') ? 'arrow' : 'none',
          routing: 'curved',
        })
      );
      return;
    }
    if (!/^(Note|loop|alt|else|opt|end|activate|deactivate|autonumber)\b/i.test(line)) {
      errors.push({ line: i + 2, message: `Unrecognized sequence line: "${line}"` });
    }
  });

  return {
    diagramType: 'sequenceDiagram',
    direction: 'LR',
    nodes: Array.from(participants.values()),
    edges,
    errors,
  };
}

function parseClassDiagram(lines) {
  const classes = new Map();
  const edges = [];
  const errors = [];
  let currentClass = null;

  const ensureClass = (name) => {
    const id = sanitizeId(name);
    if (!classes.has(id)) {
      classes.set(id, makeNode(id, name, 'class', { metadata: { members: [] } }));
    }
    return classes.get(id);
  };

  lines.slice(1).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) return;
    if (currentClass) {
      if (line === '}') {
        const memberCount = currentClass.metadata.members.length;
        currentClass.h = Math.max(100, 56 + memberCount * 20);
        currentClass = null;
        return;
      }
      currentClass.metadata.members.push(line);
      return;
    }
    const classStart = line.match(/^class\s+([a-zA-Z0-9_]+)\s*\{?$/);
    if (classStart) {
      const cls = ensureClass(classStart[1]);
      if (line.endsWith('{')) currentClass = cls;
      return;
    }
    const rel = line.match(/^([a-zA-Z0-9_]+)\s*(<\|--|--\|>|\*--|o--|-->|\.\.>|--)\s*([a-zA-Z0-9_]+)(?:\s*:\s*(.+))?$/);
    if (rel) {
      const a = ensureClass(rel[1]);
      const b = ensureClass(rel[3]);
      edges.push(
        makeEdge(`cls_${edges.length + 1}`, a.id, b.id, {
          label: rel[4] ? rel[4].trim() : '',
          lineStyle: rel[2].includes('..') ? 'dashed' : 'solid',
          arrowEnd: rel[2].includes('>') || rel[2].includes('|>') ? 'arrow' : 'none',
          arrowStart: rel[2].includes('<|') ? 'arrow' : 'none',
        })
      );
      return;
    }
    const memberLine = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
    if (memberLine) {
      const cls = ensureClass(memberLine[1]);
      cls.metadata.members.push(memberLine[2].trim());
      cls.h = Math.max(100, 56 + cls.metadata.members.length * 20);
      return;
    }
    errors.push({ line: i + 2, message: `Unrecognized classDiagram syntax: "${line}"` });
  });

  const nodes = autoLayoutNodes(Array.from(classes.values()), edges, 'TD');
  return { diagramType: 'classDiagram', direction: 'TD', nodes, edges, errors };
}

function parseStateDiagram(lines) {
  const states = new Map();
  const edges = [];
  const errors = [];
  let startCount = 0;

  const ensureState = (raw, label) => {
    if (raw === '[*]') {
      startCount++;
      const id = startCount === 1 ? 'state_start' : 'state_end';
      if (!states.has(id)) {
        states.set(id, makeNode(id, startCount === 1 ? 'Start' : 'End', startCount === 1 ? 'start' : 'end'));
      }
      return states.get(id);
    }
    const id = sanitizeId(raw);
    if (!states.has(id)) {
      states.set(id, makeNode(id, label || raw, 'rounded'));
    } else if (label) {
      states.get(id).label = label;
    }
    return states.get(id);
  };

  lines.slice(1).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) return;
    const alias = line.match(/^state\s+"([^"]+)"\s+as\s+([a-zA-Z0-9_]+)$/i);
    if (alias) {
      ensureState(alias[2], alias[1]);
      return;
    }
    const trans = line.match(/^(\[\*\]|[a-zA-Z0-9_]+)\s*-->\s*(\[\*\]|[a-zA-Z0-9_]+)(?:\s*:\s*(.+))?$/);
    if (trans) {
      const from = ensureState(trans[1]);
      const to = ensureState(trans[2]);
      edges.push(
        makeEdge(`st_${edges.length + 1}`, from.id, to.id, {
          label: trans[3] ? trans[3].trim() : '',
        })
      );
      return;
    }
    errors.push({ line: i + 2, message: `Unrecognized stateDiagram line: "${line}"` });
  });

  const nodes = autoLayoutNodes(Array.from(states.values()), edges, 'TD');
  return { diagramType: 'stateDiagram-v2', direction: 'TD', nodes, edges, errors };
}

function parseERDiagram(lines) {
  const tables = new Map();
  const edges = [];
  const errors = [];
  let activeTable = null;

  const ensureTable = (name) => {
    const id = sanitizeId(name);
    if (!tables.has(id)) {
      tables.set(id, makeNode(id, name, 'er_table', { metadata: { columns: [] } }));
    }
    return tables.get(id);
  };

  lines.slice(1).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) return;
    if (activeTable) {
      if (line === '}') {
        activeTable.h = Math.max(100, 54 + activeTable.metadata.columns.length * 20);
        activeTable = null;
        return;
      }
      activeTable.metadata.columns.push(line);
      return;
    }
    const tblStart = line.match(/^([a-zA-Z0-9_-]+)\s*\{$/);
    if (tblStart) {
      activeTable = ensureTable(tblStart[1]);
      return;
    }
    const rel = line.match(/^([a-zA-Z0-9_-]+)\s+([|o}{]+--[|o}{]+)\s+([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (rel) {
      const a = ensureTable(rel[1]);
      const b = ensureTable(rel[3]);
      edges.push(
        makeEdge(`er_${edges.length + 1}`, a.id, b.id, {
          label: `${rel[4].replace(/^["']|["']$/g, '').trim()} (${rel[2]})`,
          lineStyle: rel[2].includes('..') ? 'dashed' : 'solid',
        })
      );
      return;
    }
    errors.push({ line: i + 2, message: `Unrecognized erDiagram line: "${line}"` });
  });

  const nodes = autoLayoutNodes(Array.from(tables.values()), edges, 'LR');
  return { diagramType: 'erDiagram', direction: 'LR', nodes, edges, errors };
}

export function parseMermaid(code) {
  const validation = validateMermaid(code);
  const lines = String(code || '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('%%'));

  if (!lines.length || validation.diagramType === 'unknown') {
    return {
      ...validation,
      nodes: [],
      edges: [],
    };
  }

  let parsed;
  switch (validation.diagramType) {
    case 'flowchart':
      parsed = parseFlowchart(lines);
      break;
    case 'sequenceDiagram':
      parsed = parseSequence(lines);
      break;
    case 'classDiagram':
      parsed = parseClassDiagram(lines);
      break;
    case 'stateDiagram-v2':
      parsed = parseStateDiagram(lines);
      break;
    case 'erDiagram':
      parsed = parseERDiagram(lines);
      break;
    default:
      return {
        valid: false,
        diagramType: validation.diagramType,
        errors: [{ line: 1, message: `Diagram type "${validation.diagramType}" is not supported in Studio split-editor.` }],
        warnings: [],
        nodes: [],
        edges: [],
      };
  }

  const allErrors = [...validation.errors, ...(parsed.errors || [])];
  return {
    valid: allErrors.length === 0,
    diagramType: parsed.diagramType,
    direction: parsed.direction,
    errors: allErrors,
    warnings: validation.warnings,
    nodes: parsed.nodes,
    edges: parsed.edges,
  };
}

function wrapFlowchartShape(id, label, shape) {
  const safe = String(label || id).replace(/"/g, "'");
  switch (shape) {
    case 'diamond':
    case 'decision':
      return `${id}{"${safe}"}`;
    case 'circle':
      return `${id}(("${safe}"))`;
    case 'database':
      return `${id}[("${safe}")]`;
    case 'start':
    case 'end':
      return `${id}(["${safe}"])`;
    case 'rounded':
      return `${id}("${safe}")`;
    case 'document':
      return `${id}[/"${safe}"/]`;
    default:
      return `${id}["${safe}"]`;
  }
}

export function serializeToMermaid(nodes = [], edges = [], diagramType = 'flowchart', direction = 'TD') {
  const nonContainers = nodes.filter((n) => n.shape !== 'container');
  const containers = nodes.filter((n) => n.shape === 'container');
  const idMap = new Map();
  nonContainers.forEach((n, idx) => {
    idMap.set(n.id, sanitizeId(n.id, `N${idx + 1}`));
  });

  if (diagramType === 'sequenceDiagram') {
    const out = ['sequenceDiagram'];
    for (const n of nonContainers) {
      const sid = idMap.get(n.id);
      const kind = n.shape === 'circle' ? 'actor' : 'participant';
      out.push(`  ${kind} ${sid} as ${n.label}`);
    }
    for (const e of edges) {
      const s = idMap.get(e.source);
      const t = idMap.get(e.target);
      if (!s || !t) continue;
      const arrow = e.lineStyle === 'dashed' ? '-->>' : '->>';
      out.push(`  ${s}${arrow}${t}: ${e.label || 'message'}`);
    }
    return out.join('\n');
  }

  if (diagramType === 'classDiagram') {
    const out = ['classDiagram'];
    for (const n of nonContainers) {
      const sid = idMap.get(n.id);
      const members = n.metadata?.members || [];
      if (members.length) {
        out.push(`  class ${sid} {`);
        for (const m of members) out.push(`    ${m}`);
        out.push('  }');
      } else {
        out.push(`  class ${sid}`);
      }
    }
    for (const e of edges) {
      const s = idMap.get(e.source);
      const t = idMap.get(e.target);
      if (!s || !t) continue;
      const op = e.lineStyle === 'dashed' ? '..>' : '-->';
      out.push(`  ${s} ${op} ${t}${e.label ? ` : ${e.label}` : ''}`);
    }
    return out.join('\n');
  }

  if (diagramType === 'erDiagram') {
    const out = ['erDiagram'];
    for (const n of nonContainers) {
      const sid = idMap.get(n.id);
      const cols = n.metadata?.columns || [];
      out.push(`  ${sid} {`);
      for (const c of cols) out.push(`    ${c}`);
      out.push('  }');
    }
    for (const e of edges) {
      const s = idMap.get(e.source);
      const t = idMap.get(e.target);
      if (!s || !t) continue;
      out.push(`  ${s} ||--o{ ${t} : "${e.label || 'relates'}"`);
    }
    return out.join('\n');
  }

  if (diagramType === 'stateDiagram-v2') {
    const out = ['stateDiagram-v2'];
    for (const n of nonContainers) {
      const sid = idMap.get(n.id);
      if (n.shape !== 'start' && n.shape !== 'end') {
        out.push(`  state "${n.label}" as ${sid}`);
      }
    }
    for (const e of edges) {
      const srcNode = nonContainers.find((n) => n.id === e.source);
      const tgtNode = nonContainers.find((n) => n.id === e.target);
      const s = srcNode?.shape === 'start' ? '[*]' : idMap.get(e.source);
      const t = tgtNode?.shape === 'end' ? '[*]' : idMap.get(e.target);
      if (!s || !t) continue;
      out.push(`  ${s} --> ${t}${e.label ? ` : ${e.label}` : ''}`);
    }
    return out.join('\n');
  }

  // Default: flowchart
  const out = [`flowchart ${direction || 'TD'}`];
  const grouped = new Set();
  for (const c of containers) {
    const members = nonContainers.filter((n) => n.groupId === c.id);
    if (!members.length) continue;
    out.push(`  subgraph ${c.label || c.id}`);
    for (const m of members) {
      grouped.add(m.id);
      out.push(`    ${wrapFlowchartShape(idMap.get(m.id), m.label, m.shape)}`);
    }
    out.push('  end');
  }
  for (const n of nonContainers) {
    if (!grouped.has(n.id)) {
      out.push(`  ${wrapFlowchartShape(idMap.get(n.id), n.label, n.shape)}`);
    }
  }
  for (const e of edges) {
    const s = idMap.get(e.source);
    const t = idMap.get(e.target);
    if (!s || !t) continue;
    let op = '-->';
    if (e.arrowEnd === 'none') op = '---';
    else if (e.lineStyle === 'dashed') op = '-.->';
    else if (e.lineStyle === 'thick') op = '==>';
    const lbl = e.label ? `|${e.label.replace(/\|/g, '/')}|` : '';
    out.push(`  ${s} ${op}${lbl} ${t}`);
  }
  return out.join('\n');
}
