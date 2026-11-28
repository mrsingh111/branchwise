// Centralized Branchwise Export Branding Configuration & Helpers

export const BRAND_INFO = {
  product: 'Branchwise',
  version: '2.0.0',
  website: 'https://mrsingh111.github.io/branchwise/',
  attribution: 'Created with Branchwise',
};

export const BRANDING_MODES = ['standard', 'minimal', 'none'];
const BRANDING_PREF_KEY = 'branchwise_export_branding_v1';

export function normalizeBrandingMode(mode) {
  return BRANDING_MODES.includes(mode) ? mode : 'standard';
}

export function loadExportBranding() {
  try {
    if (typeof localStorage === 'undefined') return 'standard';
    return normalizeBrandingMode(localStorage.getItem(BRANDING_PREF_KEY));
  } catch {
    return 'standard';
  }
}

export function saveExportBranding(mode) {
  const normalized = normalizeBrandingMode(mode);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BRANDING_PREF_KEY, normalized);
    }
  } catch {
    // ignore storage restriction
  }
  return normalized;
}

export function getVisualFooterSpec(mode = 'standard') {
  const m = normalizeBrandingMode(mode);
  if (m === 'none') {
    return { mode: m, height: 0, fontSize: 0, text: '', showDivider: false };
  }
  if (m === 'minimal') {
    return {
      mode: m,
      height: 24,
      fontSize: 10,
      text: BRAND_INFO.attribution,
      showDivider: false,
    };
  }
  return {
    mode: 'standard',
    height: 28,
    fontSize: 11,
    text: BRAND_INFO.attribution,
    showDivider: true,
  };
}

export function formatMermaidWithBranding(mermaidSource, mode = 'standard') {
  const m = normalizeBrandingMode(mode);
  const base = String(mermaidSource || '').trimEnd();
  if (m === 'none') return base;
  if (m === 'minimal') {
    return `${base}\n%% ${BRAND_INFO.attribution}`;
  }
  return `${base}\n%% ${BRAND_INFO.attribution} — ${BRAND_INFO.website}`;
}

export function formatJsonWithBranding(data, mode = 'standard') {
  const m = normalizeBrandingMode(mode);
  const cloned = JSON.parse(JSON.stringify(data || {}));
  delete cloned.exportMetadata;
  if (m === 'none') {
    return cloned;
  }
  cloned.exportMetadata = {
    application: BRAND_INFO.product,
    version: BRAND_INFO.version,
    exportedAt: new Date().toISOString(),
    ...(m === 'standard' ? { website: BRAND_INFO.website } : {}),
  };
  return cloned;
}

export function formatCsvClean(nodes = [], edges = []) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const escCsv = (val) => {
    const s = String(val ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = ['source,target,label,source_shape,target_shape'];
  for (const e of edges) {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (!s || !t) continue;
    rows.push(
      [s.label || s.id, t.label || t.id, e.label || '', s.shape || 'rect', t.shape || 'rect']
        .map(escCsv)
        .join(',')
    );
  }
  return rows.join('\n');
}
