import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BRAND_INFO,
  loadExportBranding,
  saveExportBranding,
  formatMermaidWithBranding,
  formatJsonWithBranding,
  formatCsvClean,
} from '../studio/exportBranding.js';
import {
  computeDiagramBounds,
  generateDiagramSVG,
  buildDiagramPDFHtml,
} from '../studio/exportEngine.js';
import { parseMermaid } from '../mermaid/mermaidEngine.js';
import { validateAndNormalizeDiagramJson } from '../studio/importValidation.js';

const sampleNodes = [
  { id: 'n1', label: 'Client', shape: 'start', x: 100, y: 100, w: 145, h: 52 },
  { id: 'n2', label: 'API Gateway', shape: 'service', x: 320, y: 92, w: 170, h: 68 },
];
const sampleEdges = [
  { id: 'e1', source: 'n1', target: 'n2', label: 'HTTPS', routing: 'orthogonal' },
];

describe('Export Branding across PNG, SVG, PDF, Mermaid, JSON, CSV', () => {
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

  it('persists and loads user branding preference (defaulting to standard)', () => {
    const store = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      },
      configurable: true,
    });

    expect(loadExportBranding()).toBe('standard');
    saveExportBranding('minimal');
    expect(loadExportBranding()).toBe('minimal');
    saveExportBranding('none');
    expect(loadExportBranding()).toBe('none');
  });

  it('includes non-overlapping footer in SVG/PNG bounds for standard & minimal, and removes all branding for none', () => {
    const boundsNone = computeDiagramBounds(sampleNodes, 48, 'none');
    const boundsMinimal = computeDiagramBounds(sampleNodes, 48, 'minimal');
    const boundsStandard = computeDiagramBounds(sampleNodes, 48, 'standard');

    expect(boundsMinimal.height).toBeGreaterThan(boundsNone.height);
    expect(boundsStandard.height).toBeGreaterThan(boundsMinimal.height);

    const svgStd = generateDiagramSVG(sampleNodes, sampleEdges, { branding: 'standard' });
    expect(svgStd).toContain('<metadata>');
    expect(svgStd).toContain(BRAND_INFO.attribution);
    expect(svgStd).not.toContain(BRAND_INFO.website);
    expect(svgStd).toContain('data-branchwise-footer="standard"');

    const svgMin = generateDiagramSVG(sampleNodes, sampleEdges, { branding: 'minimal' });
    expect(svgMin).toContain('<metadata>');
    expect(svgMin).toContain(BRAND_INFO.attribution);
    expect(svgMin).not.toContain(BRAND_INFO.website);

    const svgNone = generateDiagramSVG(sampleNodes, sampleEdges, { branding: 'none' });
    expect(svgNone).not.toContain('<metadata>');
    expect(svgNone).not.toContain(BRAND_INFO.attribution);
    expect(svgNone).not.toContain('data-branchwise-footer');
  });

  it('places branding in dedicated PDF page footer only when enabled', () => {
    const pdfStd = buildDiagramPDFHtml(sampleNodes, sampleEdges, { branding: 'standard' });
    expect(pdfStd).toContain('class="bw-pdf-footer"');
    expect(pdfStd).toContain(BRAND_INFO.attribution);

    const pdfNone = buildDiagramPDFHtml(sampleNodes, sampleEdges, { branding: 'none' });
    expect(pdfNone).not.toContain('class="bw-pdf-footer"');
    expect(pdfNone).not.toContain(BRAND_INFO.attribution);
  });

  it('appends Mermaid attribution comment without breaking parseMermaid', () => {
    const raw = 'flowchart TD\n  A["Client"] -->|HTTPS| B["API"]';
    const std = formatMermaidWithBranding(raw, 'standard');
    const min = formatMermaidWithBranding(raw, 'minimal');
    const none = formatMermaidWithBranding(raw, 'none');

    expect(std).toContain(`%% ${BRAND_INFO.attribution}`);
    expect(std).not.toContain(BRAND_INFO.website);
    expect(min).toContain(`%% ${BRAND_INFO.attribution}`);
    expect(none).toBe(raw);

    const parsedStd = parseMermaid(std);
    expect(parsedStd.valid).toBe(true);
    expect(parsedStd.nodes).toHaveLength(2);
    expect(parsedStd.edges).toHaveLength(1);
  });

  it('adds Branchwise metadata to JSON exports while preserving backward-compatible imports, and keeps CSV raw', () => {
    const doc = { title: 'Test', nodes: sampleNodes, edges: sampleEdges };
    const jsonStd = formatJsonWithBranding(doc, 'standard');
    expect(jsonStd.exportMetadata.application).toBe(BRAND_INFO.product);
    expect(jsonStd.exportMetadata.version).toBe(BRAND_INFO.version);
    expect(jsonStd.exportMetadata.website).toBeUndefined();
    expect(jsonStd.exportMetadata.exportedAt).toBeTruthy();

    const imported = validateAndNormalizeDiagramJson(JSON.stringify(jsonStd));
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);

    const jsonNone = formatJsonWithBranding(jsonStd, 'none');
    expect(jsonNone.exportMetadata).toBeUndefined();

    const csv = formatCsvClean(sampleNodes, sampleEdges);
    expect(csv).not.toContain('Branchwise');
    expect(csv).toBe('source,target,label,source_shape,target_shape\nClient,API Gateway,HTTPS,start,service');
  });
});
