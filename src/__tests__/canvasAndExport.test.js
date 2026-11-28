import { describe, it, expect } from 'vitest';
import {
  getNodePorts,
  buildEdgePath,
  alignSelectedNodes,
  distributeSelectedNodes,
  applyGridAutoLayout,
} from '../studio/shapeCatalog.js';
import { generateDiagramSVG } from '../studio/exportEngine.js';
import { parseCsvToDiagram } from '../mermaid/csvImport.js';

describe('Canvas Geometry, CSV Import, SVG Export & 500-Node Performance', () => {
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

  it('handles 500-node auto-layout and SVG export within 250ms', () => {
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

    const t0 = performance.now();
    const laid = applyGridAutoLayout(nodes);
    const svg = generateDiagramSVG(laid, edges, { theme: 'dark' });
    const elapsed = performance.now() - t0;

    expect(laid).toHaveLength(500);
    expect(svg.length).toBeGreaterThan(10000);
    expect(elapsed).toBeLessThan(250);
  });
});
