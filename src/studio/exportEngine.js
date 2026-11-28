// True Vector SVG, High-DPI PNG, PDF Print-Sheet, and JSON/Mermaid Export Engine

import { buildEdgePath } from './shapeCatalog';

function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computeDiagramBounds(nodes, pad = 48) {
  if (!nodes.length) {
    return { minX: 0, minY: 0, width: 800, height: 500 };
  }
  const minX = Math.min(...nodes.map((n) => n.x)) - pad;
  const minY = Math.min(...nodes.map((n) => n.y)) - pad;
  const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + pad;
  const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + pad;
  return {
    minX,
    minY,
    width: Math.max(240, maxX - minX),
    height: Math.max(180, maxY - minY),
  };
}

function renderNodeToSvg(node, palette) {
  const { x, y, w, h, shape, label, fill, stroke, textColor, fontSize = 13, metadata } = node;
  const bg = fill || (shape === 'container' ? 'rgba(110,138,230,0.05)' : shape === 'sticky' ? 'rgba(250,204,21,0.22)' : palette.surface);
  const border = stroke || (shape === 'container' ? palette.borderStrong : '#6E8AE6');
  const fg = textColor || palette.text;
  const cx = x + w / 2;
  const cy = y + h / 2;

  let shapeSvg = '';
  if (shape === 'diamond' || shape === 'decision') {
    const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
    shapeSvg = `<polygon points="${pts}" fill="${bg}" stroke="${border}" stroke-width="2" />`;
  } else if (shape === 'circle') {
    const rx = w / 2;
    const ry = h / 2;
    shapeSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bg}" stroke="${border}" stroke-width="2" />`;
  } else if (shape === 'database') {
    const ry = 12;
    shapeSvg = `
      <path d="M ${x} ${y + ry} L ${x} ${y + h - ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z" fill="${bg}" stroke="${border}" stroke-width="2" />
      <ellipse cx="${cx}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${bg}" stroke="${border}" stroke-width="2" />
    `;
  } else if (shape === 'document') {
    shapeSvg = `<path d="M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - 10} Q ${x + w * 0.75} ${y + h + 4} ${cx} ${y + h - 8} T ${x} ${y + h - 8} Z" fill="${bg}" stroke="${border}" stroke-width="2" />`;
  } else if (shape === 'container') {
    shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${bg}" stroke="${border}" stroke-width="2" stroke-dasharray="7 5" />`;
  } else if (shape === 'text') {
    shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="transparent" stroke="transparent" />`;
  } else {
    const rx = shape === 'start' || shape === 'end' ? h / 2 : shape === 'rounded' ? 14 : 8;
    shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="2" />`;
  }

  let extraText = '';
  if ((shape === 'class' || shape === 'er_table') && Array.isArray(metadata?.members || metadata?.columns)) {
    const rows = metadata.members || metadata.columns || [];
    extraText += `<line x1="${x}" y1="${y + 34}" x2="${x + w}" y2="${y + 34}" stroke="${border}" stroke-width="1.5" />`;
    extraText += `<text x="${cx}" y="${y + 22}" text-anchor="middle" fill="${fg}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="700">${escXml(label)}</text>`;
    rows.slice(0, 6).forEach((row, idx) => {
      extraText += `<text x="${x + 10}" y="${y + 54 + idx * 18}" fill="${palette.textSoft}" font-family="JetBrains Mono, monospace" font-size="11">${escXml(row)}</text>`;
    });
  } else if (shape === 'container') {
    extraText = `<text x="${x + 14}" y="${y + 22}" fill="${palette.textSoft}" font-family="Inter, sans-serif" font-size="12" font-weight="700">${escXml(label)}</text>`;
  } else {
    extraText = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${fg}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="600">${escXml(label)}</text>`;
  }

  return `<g>${shapeSvg}${extraText}</g>`;
}

export function generateDiagramSVG(nodes, edges, options = {}) {
  const { theme = 'dark', transparent = false, title = 'Branchwise Diagram' } = options;
  const palette =
    theme === 'light'
      ? { bg: '#F6F7F9', surface: '#FFFFFF', text: '#14171F', textSoft: '#475063', borderStrong: '#94A3B8', edge: '#475063' }
      : { bg: '#0F1115', surface: '#171A21', text: '#F2F4F8', textSoft: '#B6BCC8', borderStrong: '#4B5563', edge: '#94A3B8' };

  const bounds = computeDiagramBounds(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const containers = nodes.filter((n) => n.shape === 'container');
  const regular = nodes.filter((n) => n.shape !== 'container');

  const edgeSvgs = edges
    .map((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return '';
      const { d, labelX, labelY } = buildEdgePath(s, t, e.routing || 'orthogonal');
      const dash = e.lineStyle === 'dashed' ? 'stroke-dasharray="7 5"' : '';
      const stroke = e.stroke || palette.edge;
      const markerEnd = e.arrowEnd !== 'none' ? 'marker-end="url(#bw-arrow)"' : '';
      const markerStart = e.arrowStart === 'arrow' ? 'marker-start="url(#bw-arrow-start)"' : '';
      const lbl = e.label
        ? `<g><rect x="${labelX - e.label.length * 3.6 - 6}" y="${labelY - 10}" width="${e.label.length * 7.2 + 12}" height="20" rx="5" fill="${palette.surface}" stroke="${palette.borderStrong}" stroke-width="1" /><text x="${labelX}" y="${labelY + 4}" text-anchor="middle" fill="${palette.text}" font-family="Inter, sans-serif" font-size="11">${escXml(e.label)}</text></g>`
        : '';
      return `<g><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${e.strokeWidth || 2}" ${dash} ${markerEnd} ${markerStart} />${lbl}</g>`;
    })
    .join('\n');

  const bgRect = transparent
    ? ''
    : `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${palette.bg}" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bounds.width)}" height="${Math.round(bounds.height)}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}">
  <title>${escXml(title)}</title>
  <defs>
    <marker id="bw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="${palette.edge}" />
    </marker>
    <marker id="bw-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 10 1 L 0 5 L 10 9 z" fill="${palette.edge}" />
    </marker>
  </defs>
  ${bgRect}
  ${containers.map((n) => renderNodeToSvg(n, palette)).join('\n')}
  ${edgeSvgs}
  ${regular.map((n) => renderNodeToSvg(n, palette)).join('\n')}
</svg>`;
}

export function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportDiagramPNG(nodes, edges, options = {}) {
  const { scale = 2, transparent = false, theme = 'dark', filename = 'branchwise-diagram.png' } = options;
  const svgStr = generateDiagramSVG(nodes, edges, { theme, transparent });
  const bounds = computeDiagramBounds(nodes);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Failed to encode PNG'));
          return;
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export function exportDiagramPDF(nodes, edges, options = {}) {
  const { theme = 'light', title = 'Branchwise Diagram' } = options;
  const svgStr = generateDiagramSVG(nodes, edges, { theme, transparent: false, title });
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) {
    throw new Error('Popup blocked — please allow popups to print/save PDF.');
  }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escXml(title)}</title>
  <style>
    @page { size: auto; margin: 12mm; }
    body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, sans-serif; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${svgStr}
  <script>window.onload = () => { setTimeout(() => { window.print(); }, 250); };</script>
</body>
</html>`);
  win.document.close();
}
