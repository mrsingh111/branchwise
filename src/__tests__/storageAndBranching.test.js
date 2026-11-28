import { describe, it, expect } from 'vitest';
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
} from '../storage/db.js';

describe('Document Schema, Branching, Snapshots & Backup Validation', () => {
  it('isolates branches so editing one branch never overwrites another', () => {
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
    doc = renameBranchById(doc, mainId, 'production');
    expect(getActiveBranch(doc).name).toBe('production');
  });

  it('creates, compares, and restores snapshots safely', () => {
    let doc = createDiagramDocument('Snap Test', {
      nodes: [{ id: 'n1', label: 'Start', shape: 'start', x: 50, y: 50, w: 140, h: 52 }],
      edges: [],
    });
    doc = createBranchSnapshot(doc, 'Baseline', false);
    doc = updateActiveBranch(doc, (b) => ({
      ...b,
      nodes: [
        ...b.nodes,
        { id: 'n2', label: 'Worker', shape: 'service', x: 250, y: 50, w: 170, h: 68 },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'dispatch' }],
    }));
    doc = createBranchSnapshot(doc, 'With Worker', false);

    const branch = getActiveBranch(doc);
    const diff = compareBranchVersions(branch.versions[1], branch.versions[0]);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.addedEdges).toHaveLength(1);

    doc = restoreBranchSnapshot(doc, branch.versions[1].id);
    expect(getActiveBranch(doc).nodes).toHaveLength(1);
    // Safety snapshot "Before restore" was automatically recorded
    expect(getActiveBranch(doc).versions.some((v) => v.label === 'Before restore')).toBe(true);
  });

  it('exports and validates workspace JSON backups and rejects malformed JSON', () => {
    const doc = createDiagramDocument('Backup Doc');
    const json = exportDocumentsBackupJSON([doc]);
    const parsed = parseBackupJSON(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Backup Doc');

    expect(() => parseBackupJSON('{"invalid": true}')).toThrow();
    expect(() => parseBackupJSON('not-json')).toThrow();
  });

  it('falls back gracefully when IndexedDB is unavailable', async () => {
    const docs = await loadDocumentsFromDB([createDiagramDocument('Fallback Doc')]);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('Fallback Doc');
  });
});
