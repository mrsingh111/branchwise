// Offline-first IndexedDB persistence, schema migration, and local branching/versioning for Branchwise 2.0

const DB_NAME = 'branchwise_db';
const DB_VERSION = 1;
const DOC_STORE = 'documents';
const META_STORE = 'meta';
const LEGACY_MAPS_KEY = 'branchwise_saved_maps_v1';
const RECENT_TEMPLATES_KEY = 'branchwise_recent_templates_v1';

export const CURRENT_SCHEMA_VERSION = 2;

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export function normalizeDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.docType === 'diagram') {
    const branches = Array.isArray(doc.branches) && doc.branches.length > 0
      ? doc.branches
      : [createDefaultBranch('main')];
    return {
      ...doc,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      docType: 'diagram',
      title: doc.title || 'Untitled Diagram',
      updatedAt: doc.updatedAt || Date.now(),
      activeBranchId: doc.activeBranchId || branches[0].id,
      branches: branches.map((b) => ({
        id: b.id || makeId('br'),
        name: b.name || 'main',
        createdAt: b.createdAt || Date.now(),
        updatedAt: b.updatedAt || Date.now(),
        nodes: Array.isArray(b.nodes) ? b.nodes : [],
        edges: Array.isArray(b.edges) ? b.edges : [],
        layers: Array.isArray(b.layers) && b.layers.length > 0
          ? b.layers
          : [{ id: 'layer_default', name: 'Default Layer', visible: true, locked: false }],
        viewport: b.viewport || { x: 0, y: 0, zoom: 1 },
        mermaidSource: typeof b.mermaidSource === 'string' ? b.mermaidSource : '',
        metadata: b.metadata || { description: '', author: '', tags: [] },
        versions: Array.isArray(b.versions) ? b.versions : [],
      })),
    };
  }
  // Mindmap (Branchwise 1.0 compatible)
  return {
    ...doc,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    docType: 'mindmap',
    updatedAt: doc.updatedAt || Date.now(),
  };
}

export function createDefaultBranch(name = 'main', initialData = {}) {
  const now = Date.now();
  return {
    id: makeId('br'),
    name,
    createdAt: now,
    updatedAt: now,
    nodes: initialData.nodes || [],
    edges: initialData.edges || [],
    layers: initialData.layers || [{ id: 'layer_default', name: 'Default Layer', visible: true, locked: false }],
    viewport: initialData.viewport || { x: 80, y: 80, zoom: 1 },
    mermaidSource: initialData.mermaidSource || '',
    metadata: initialData.metadata || { description: '', author: '', tags: [] },
    versions: initialData.versions || [],
  };
}

export function createDiagramDocument(title = 'Untitled Diagram', initialData = {}) {
  const mainBranch = createDefaultBranch('main', initialData);
  const now = Date.now();
  return {
    id: makeId('diag'),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    docType: 'diagram',
    title,
    createdAt: new Date(now).toLocaleDateString(),
    updatedAt: now,
    activeBranchId: mainBranch.id,
    branches: [mainBranch],
  };
}

export function getActiveBranch(doc) {
  if (!doc || doc.docType !== 'diagram') return null;
  return doc.branches.find((b) => b.id === doc.activeBranchId) || doc.branches[0];
}

export function updateActiveBranch(doc, updater) {
  const branch = getActiveBranch(doc);
  if (!branch) return doc;
  const nextBranch = typeof updater === 'function' ? updater(branch) : { ...branch, ...updater };
  return {
    ...doc,
    updatedAt: Date.now(),
    branches: doc.branches.map((b) => (b.id === branch.id ? { ...nextBranch, updatedAt: Date.now() } : b)),
  };
}

export function createBranchSnapshot(doc, label = '', isAuto = false) {
  const branch = getActiveBranch(doc);
  if (!branch) return doc;
  const snap = {
    id: makeId('ver'),
    label: label.trim() || (isAuto ? `Autosave ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Snapshot ${(branch.versions?.length || 0) + 1}`),
    createdAt: Date.now(),
    auto: isAuto,
    snapshot: {
      nodes: JSON.parse(JSON.stringify(branch.nodes || [])),
      edges: JSON.parse(JSON.stringify(branch.edges || [])),
      layers: JSON.parse(JSON.stringify(branch.layers || [])),
      mermaidSource: branch.mermaidSource || '',
    },
  };
  const prevVersions = branch.versions || [];
  // Keep at most 40 versions (keep all manual snapshots + recent auto snapshots)
  const manual = prevVersions.filter((v) => !v.auto);
  const autos = prevVersions.filter((v) => v.auto).slice(0, 19);
  const nextVersions = [snap, ...manual, ...autos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
  return updateActiveBranch(doc, { versions: nextVersions });
}

export function restoreBranchSnapshot(doc, versionId) {
  const branch = getActiveBranch(doc);
  if (!branch) return doc;
  const ver = (branch.versions || []).find((v) => v.id === versionId);
  if (!ver?.snapshot) return doc;
  // Auto-save current state before restoring so no work is lost
  const withSafetySnap = createBranchSnapshot(doc, 'Before restore', true);
  return updateActiveBranch(withSafetySnap, {
    nodes: JSON.parse(JSON.stringify(ver.snapshot.nodes || [])),
    edges: JSON.parse(JSON.stringify(ver.snapshot.edges || [])),
    layers: JSON.parse(JSON.stringify(ver.snapshot.layers || [{ id: 'layer_default', name: 'Default Layer', visible: true, locked: false }])),
    mermaidSource: ver.snapshot.mermaidSource || '',
  });
}

export function createDuplicateBranch(doc, newName) {
  const current = getActiveBranch(doc);
  if (!current) return doc;
  const cleanName = (newName || '').trim() || `branch-${doc.branches.length + 1}`;
  const cloned = {
    ...JSON.parse(JSON.stringify(current)),
    id: makeId('br'),
    name: cleanName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [
      {
        id: makeId('ver'),
        label: `Branched from ${current.name}`,
        createdAt: Date.now(),
        auto: false,
        snapshot: {
          nodes: JSON.parse(JSON.stringify(current.nodes || [])),
          edges: JSON.parse(JSON.stringify(current.edges || [])),
          layers: JSON.parse(JSON.stringify(current.layers || [])),
          mermaidSource: current.mermaidSource || '',
        },
      },
    ],
  };
  return {
    ...doc,
    updatedAt: Date.now(),
    activeBranchId: cloned.id,
    branches: [...doc.branches, cloned],
  };
}

export function renameBranchById(doc, branchId, newName) {
  const clean = (newName || '').trim();
  if (!clean) return doc;
  return {
    ...doc,
    updatedAt: Date.now(),
    branches: doc.branches.map((b) => (b.id === branchId ? { ...b, name: clean, updatedAt: Date.now() } : b)),
  };
}

export function switchActiveBranch(doc, branchId) {
  if (!doc.branches.some((b) => b.id === branchId)) return doc;
  return {
    ...doc,
    activeBranchId: branchId,
  };
}

export function compareBranchVersions(verA, verB) {
  const aNodes = new Map((verA?.snapshot?.nodes || []).map((n) => [n.id, n]));
  const bNodes = new Map((verB?.snapshot?.nodes || []).map((n) => [n.id, n]));
  const aEdges = new Map((verA?.snapshot?.edges || []).map((e) => [e.id, e]));
  const bEdges = new Map((verB?.snapshot?.edges || []).map((e) => [e.id, e]));

  const addedNodes = [];
  const removedNodes = [];
  const modifiedNodes = [];

  for (const [id, node] of bNodes) {
    if (!aNodes.has(id)) {
      addedNodes.push(node);
    } else {
      const prev = aNodes.get(id);
      if (
        prev.label !== node.label ||
        prev.shape !== node.shape ||
        Math.round(prev.x) !== Math.round(node.x) ||
        Math.round(prev.y) !== Math.round(node.y) ||
        prev.fill !== node.fill
      ) {
        modifiedNodes.push({ before: prev, after: node });
      }
    }
  }
  for (const [id, node] of aNodes) {
    if (!bNodes.has(id)) removedNodes.push(node);
  }

  const addedEdges = [];
  const removedEdges = [];
  for (const [id, edge] of bEdges) {
    if (!aEdges.has(id)) addedEdges.push(edge);
  }
  for (const [id, edge] of aEdges) {
    if (!bEdges.has(id)) removedEdges.push(edge);
  }

  return { addedNodes, removedNodes, modifiedNodes, addedEdges, removedEdges };
}

export async function loadDocumentsFromDB(fallbackDocs = []) {
  try {
    const db = await openDatabase();
    const docs = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readonly');
      const store = tx.objectStore(DOC_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (docs.length > 0) {
      db.close();
      return docs.map(normalizeDocument).filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    // Migrate from localStorage if IDB is empty
    let legacy = [];
    try {
      const raw = localStorage.getItem(LEGACY_MAPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) legacy = parsed;
      }
    } catch {
      // ignore
    }

    const seed = (legacy.length > 0 ? legacy : fallbackDocs).map(normalizeDocument).filter(Boolean);
    if (seed.length > 0) {
      await saveAllDocumentsToDB(seed);
    }
    db.close();
    return seed;
  } catch {
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(LEGACY_MAPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeDocument).filter(Boolean);
        }
      }
    } catch {
      // ignore
    }
    return fallbackDocs.map(normalizeDocument).filter(Boolean);
  }
}

export async function saveDocumentToDB(doc) {
  const normalized = normalizeDocument(doc);
  if (!normalized) return { ok: false, error: 'Invalid document' };
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'IndexedDB write failed' };
  }
}

export async function deleteDocumentFromDB(id) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'IndexedDB delete failed' };
  }
}

export async function saveAllDocumentsToDB(docs) {
  const normalized = docs.map(normalizeDocument).filter(Boolean);
  let localSaved = false;
  let idbSaved = false;
  const errors = [];

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEGACY_MAPS_KEY, JSON.stringify(normalized));
      localSaved = true;
    }
  } catch (err) {
    errors.push(err?.message || 'localStorage write failed');
  }

  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      const store = tx.objectStore(DOC_STORE);
      store.clear();
      for (const d of normalized) {
        store.put(d);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    idbSaved = true;
  } catch (err) {
    errors.push(err?.message || 'IndexedDB write failed');
  }

  return {
    ok: idbSaved || localSaved,
    idbSaved,
    localSaved,
    error: idbSaved || localSaved ? null : errors.join('; ') || 'No persistent storage available',
  };
}

export function getRecentTemplateIds() {
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentTemplateId(templateId) {
  try {
    const prev = getRecentTemplateIds().filter((id) => id !== templateId);
    const next = [templateId, ...prev].slice(0, 6);
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function exportDocumentsBackupJSON(docs) {
  return JSON.stringify(
    {
      app: 'Branchwise',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      documents: docs,
    },
    null,
    2
  );
}

export function parseBackupJSON(rawText) {
  const parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeDocument).filter(Boolean);
  }
  if (parsed && Array.isArray(parsed.documents)) {
    return parsed.documents.map(normalizeDocument).filter(Boolean);
  }
  if (parsed && parsed.docType) {
    return [normalizeDocument(parsed)].filter(Boolean);
  }
  throw new Error('Unrecognized Branchwise JSON format.');
}
