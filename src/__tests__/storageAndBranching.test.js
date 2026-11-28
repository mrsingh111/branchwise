import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDiagramDocument,
  createDuplicateBranch,
  createBranchSnapshot,
  restoreBranchSnapshot,
  renameBranchById,
  switchActiveBranch,
  updateActiveBranch,
  compareBranchVersions,
  getActiveBranch,
  exportDocumentsBackupJSON,
  parseBackupJSON,
  loadDocumentsFromDB,
  saveAllDocumentsToDB,
  saveDocumentToDB,
  deleteDocumentFromDB,
} from '../storage/db.js';

describe('Document Schema, Branching, Snapshots & Storage Fallback', () => {
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  it('isolates branches so editing, renaming, or snapping one branch never overwrites another', () => {
    let doc = createDiagramDocument('System Arch', {
      nodes: [{ id: 'n1', label: 'API', shape: 'rect', x: 100, y: 100, w: 150, h: 60 }],
      edges: [],
    });
    const mainId = doc.activeBranchId;
    doc = createDuplicateBranch(doc, 'v2-cache');
    const expId = doc.activeBranchId;

    expect(expId).not.toBe(mainId);
    doc = updateActiveBranch(doc, (b) => ({
      ...b,
      nodes: [...b.nodes, { id: 'n2', label: 'Redis', shape: 'database', x: 340, y: 100, w: 145, h: 90 }],
    }));

    expect(getActiveBranch(doc).nodes).toHaveLength(2);
    doc = switchActiveBranch(doc, mainId);
    expect(getActiveBranch(doc).nodes).toHaveLength(1);
    expect(getActiveBranch(doc).nodes[0].label).toBe('API');

    doc = renameBranchById(doc, mainId, 'production');
    expect(getActiveBranch(doc).name).toBe('production');
  });

  it('creates, compares, and restores snapshots with automatic safety backup', () => {
    let doc = createDiagramDocument('Snap Test', {
      nodes: [{ id: 'n1', label: 'Start', shape: 'start', x: 50, y: 50, w: 140, h: 52 }],
      edges: [],
    });
    doc = createBranchSnapshot(doc, 'Baseline', false);
    doc = updateActiveBranch(doc, (b) => ({
      ...b,
      nodes: [
        { ...b.nodes[0], label: 'Start v2' },
        { id: 'n2', label: 'Worker', shape: 'service', x: 250, y: 50, w: 170, h: 68 },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'dispatch' }],
    }));
    doc = createBranchSnapshot(doc, 'With Worker', false);

    const branch = getActiveBranch(doc);
    const diff = compareBranchVersions(branch.versions[1], branch.versions[0]);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.modifiedNodes).toHaveLength(1);
    expect(diff.addedEdges).toHaveLength(1);

    doc = restoreBranchSnapshot(doc, branch.versions[1].id);
    expect(getActiveBranch(doc).nodes).toHaveLength(1);
    expect(getActiveBranch(doc).nodes[0].label).toBe('Start');
    expect(getActiveBranch(doc).versions.some((v) => v.label === 'Before restore')).toBe(true);
  });

  it('exports and validates workspace JSON backups and rejects malformed JSON', () => {
    const doc = createDiagramDocument('Backup Doc');
    const json = exportDocumentsBackupJSON([doc]);
    const parsed = parseBackupJSON(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Backup Doc');
    expect(parsed[0].schemaVersion).toBe(2);

    expect(() => parseBackupJSON('{"invalid": true}')).toThrow();
    expect(() => parseBackupJSON('not-json')).toThrow();
  });

  it('persists and recovers via localStorage fallback and reports storage failure when unavailable', async () => {
    const store = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      },
      configurable: true,
    });

    const doc = createDiagramDocument('Local Fallback Doc');
    const saveRes = await saveAllDocumentsToDB([doc]);
    expect(saveRes.ok).toBe(true);
    expect(saveRes.localSaved).toBe(true);

    const loaded = await loadDocumentsFromDB([]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('Local Fallback Doc');

    // Simulate quota error in localStorage with no IndexedDB
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
      configurable: true,
    });
    const failRes = await saveAllDocumentsToDB([doc]);
    expect(failRes.ok).toBe(false);
    expect(failRes.error).toContain('QuotaExceededError');
  });

  it('saveDocumentToDB falls back to localStorage preserving other docs, handles malformed data and dual failure', async () => {
    const store = new Map();
    const docA = createDiagramDocument('Doc A');
    const docB = createDiagramDocument('Doc B');
    store.set('branchwise_saved_maps_v1', JSON.stringify([docA]));

    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      },
      configurable: true,
    });

    const resB = await saveDocumentToDB(docB);
    expect(resB.ok).toBe(true);
    expect(resB.idbSaved).toBe(false);
    expect(resB.localSaved).toBe(true);

    const storedAfterB = JSON.parse(store.get('branchwise_saved_maps_v1'));
    expect(storedAfterB).toHaveLength(2);
    expect(storedAfterB.some((d) => d.id === docA.id)).toBe(true);
    expect(storedAfterB.some((d) => d.id === docB.id)).toBe(true);

    // Malformed legacy data in localStorage should recover safely instead of crashing
    store.set('branchwise_saved_maps_v1', '{corrupted-json');
    const resRecover = await saveDocumentToDB(docA);
    expect(resRecover.ok).toBe(true);
    expect(JSON.parse(store.get('branchwise_saved_maps_v1'))).toHaveLength(1);

    // Both IndexedDB unavailable and localStorage quota failure -> ok: false
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
      configurable: true,
    });
    const dualFail = await saveDocumentToDB(docA);
    expect(dualFail.ok).toBe(false);
    expect(dualFail.idbSaved).toBe(false);
    expect(dualFail.localSaved).toBe(false);
    expect(dualFail.error).toContain('QuotaExceededError');
  });

  it('deleteDocumentFromDB preserves other documents and reports failure if doc remains in storage', async () => {
    const store = new Map();
    const docA = createDiagramDocument('Keep A');
    const docB = createDiagramDocument('Delete B');
    store.set('branchwise_saved_maps_v1', JSON.stringify([docA, docB]));

    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      },
      configurable: true,
    });

    const delOk = await deleteDocumentFromDB(docB.id);
    expect(delOk.ok).toBe(true);
    const remaining = JSON.parse(store.get('branchwise_saved_maps_v1'));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(docA.id);

    // If localStorage.setItem fails while docA is still in it, delete must return ok: false
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: () => {
          throw new Error('StorageReadOnlyError');
        },
      },
      configurable: true,
    });
    const delFail = await deleteDocumentFromDB(docA.id);
    expect(delFail.ok).toBe(false);
    expect(delFail.error).toContain('StorageReadOnlyError');
  });
});
