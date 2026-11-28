import { describe, it, expect } from 'vitest';
import {
  getNodePorts,
  buildEdgePath,
  alignSelectedNodes,
  distributeSelectedNodes,
  applyGridAutoLayout,
} from '../studio/shapeCatalog.js';
import { generateDiagramSVG } from '../studio/exportEngine.js';
import { sanitizeExternalUrl, validateAndNormalizeDiagramJson } from '../studio/importValidation.js';
import { parseCsvToDiagram } from '../mermaid/csvImport.js';

describe('Canvas Geometry, Import Validation, URL Sanitization & SVG Export', () => {
  it('computes ports, edge paths, alignment, and distribution accurately', () => {
    const a = { id: 'a', x: 0, y: 0, w: 100, h: 60 };
    const b = { id: 'b', x: 250, y: 120, w: 100, h: 60 };
    const c = { id: 'c', x: 500, y: 40, w: 100, h: 60 };

    expect(getNodePorts(a).right).toEqual({ x: 100, y: 30 });
    expect(buildEdgePath(a, b, 'straight').d).toContain('M 100 30 L 250 150');
    expect(buildEdgePath(a, b, 'orthogonal').d).toContain('L 175 30');
    expect(buildEdgePath(a, b, 'curved').d).toContain('C ');

    const aligned = alignSelectedNodes([a, b], ['a', 'b'], 'top');
    expect(aligned[1].y).toBe(0);

    const distributed = distributeSelectedNodes([a, b, c], ['a', 'b', 'c'], 'horizontal');
    expect(distributed[1].x).toBe(250);
  });

  it('sanitizes external hyperlinks and blocks unsafe schemes', () => {
    expect(sanitizeExternalUrl('https://example.com/docs')).toBe('https://example.com/docs');
    expect(sanitizeExternalUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(sanitizeExternalUrl('mailto:dev@example.com')).toBe('mailto:dev@example.com');
    expect(sanitizeExternalUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeExternalUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('validates JSON imports, normalizes missing fields, and strips dangling edges', () => {
    const valid = validateAndNormalizeDiagramJson(
      JSON.stringify({
        nodes: [{ id: 'n1', label: 'API' }, { id: 'n2', label: 'DB', x: 300, y: 100 }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e_bad', source: 'n1', target: 'missing_node' },
        ],
      })
    );
    expect(valid.nodes).toHaveLength(2);
    expect(valid.nodes[0].w).toBe(160);
    expect(valid.edges).toHaveLength(1);

    expect(() => validateAndNormalizeDiagramJson('not-json')).toThrow('Invalid JSON syntax.');
    expect(() => validateAndNormalizeDiagramJson('{"foo":"bar"}')).toThrow('JSON file must contain');
  });

  it('parses CSV edge lists and rejects invalid CSV', () => {
    const { nodes, edges } = parseCsvToDiagram('source,target,label\nClient,Gateway,HTTPS\nGateway,Auth,JWT');
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(() => parseCsvToDiagram('only_header')).toThrow();
  });

  it('exports valid escaped SVG preserving dimensions, labels, and styling', () => {
    const svg = generateDiagramSVG(
      [{ id: 'n1', label: 'A & B <v2>', shape: 'rect', x: 50, y: 50, w: 160, h: 64, stroke: '#38bdf8' }],
      [{ id: 'e1', source: 'n1', target: 'n1', label: 'self & loop', routing: 'curved' }],
      { theme: 'dark', transparent: true, title: 'Audit' }
    );
    expect(svg).toContain('A &amp; B &lt;v2&gt;');
    expect(svg).toContain('self &amp; loop');
    expect(svg).toContain('#38bdf8');
  });

  it('lays out 500 nodes deterministically without overlaps and exports valid SVG (unit-level, non-DOM)', () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `n_${i}`,
      label: `Node ${i}`,
      shape: i % 5 === 0 ? 'diamond' : 'rect',
      x: 0,
      y: 0,
      w: 150,
      h: 60,
    }));
    const edges = Array.from({ length: 499 }, (_, i) => ({
      id: `e_${i}`,
      source: `n_${i}`,
      target: `n_${i + 1}`,
      label: '',
      routing: 'orthogonal',
    }));

    const laid = applyGridAutoLayout(nodes);
    expect(laid).toHaveLength(500);
    const coords = new Set(laid.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(500);

    const svg = generateDiagramSVG(laid, edges, { theme: 'dark' });
    const pathMatches = svg.match(/<path\b/g) || [];
    expect(pathMatches.length).toBeGreaterThanOrEqual(499);
  });
});
