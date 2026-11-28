import { describe, it, expect } from 'vitest';
import {
  parseMermaid,
  validateMermaid,
  serializeToMermaid,
  detectMermaidType,
} from '../mermaid/mermaidEngine.js';

describe('Mermaid Parser, Validator & Serializer', () => {
  it('parses and roundtrips flowcharts with subgraphs, shapes, and edge labels', () => {
    const src = `flowchart TD
  subgraph Core
    A["User & Admin (v2)"] -->|HTTP/2| B{"Auth OK?"}
  end
  B -.->|No| C[("Audit DB")]`;
    const parsed = parseMermaid(src);
    expect(parsed.valid).toBe(true);
    expect(parsed.diagramType).toBe('flowchart');
    expect(parsed.nodes.some((n) => n.shape === 'container' && n.label === 'Core')).toBe(true);
    expect(parsed.nodes.some((n) => n.label === 'User & Admin (v2)')).toBe(true);
    expect(parsed.nodes.some((n) => n.shape === 'diamond')).toBe(true);
    expect(parsed.nodes.some((n) => n.shape === 'database')).toBe(true);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges[1].lineStyle).toBe('dashed');

    const serialized = serializeToMermaid(parsed.nodes, parsed.edges, 'flowchart', 'TD');
    const reparsed = parseMermaid(serialized);
    expect(reparsed.valid).toBe(true);
    expect(reparsed.edges).toHaveLength(2);
  });

  it('parses sequenceDiagram, classDiagram, stateDiagram-v2, and erDiagram', () => {
    const seq = parseMermaid('sequenceDiagram\n  participant A as Client\n  A->>B: Login\n  B-->>A: JWT');
    expect(seq.valid).toBe(true);
    expect(seq.nodes).toHaveLength(2);
    expect(seq.edges).toHaveLength(2);

    const cls = parseMermaid('classDiagram\n  class User {\n    +id: string\n  }\n  User --> Order : places');
    expect(cls.valid).toBe(true);
    expect(cls.nodes.find((n) => n.id === 'User')?.metadata?.members).toContain('+id: string');

    const st = parseMermaid('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : start');
    expect(st.valid).toBe(true);
    expect(st.nodes).toHaveLength(3);

    const er = parseMermaid('erDiagram\n  USER {\n    uuid id PK\n  }\n  USER ||--o{ ORDER : "places"');
    expect(er.valid).toBe(true);
    expect(er.nodes).toHaveLength(2);
    expect(er.edges[0].label).toContain('places');
  });

  it('reports line-numbered errors for malformed syntax and unsupported headers', () => {
    const trailing = parseMermaid('flowchart TD\n  A[Start] -->');
    expect(trailing.valid).toBe(false);
    expect(trailing.errors[0].line).toBe(2);

    const gantt = validateMermaid('gantt\n  title Schedule');
    expect(gantt.valid).toBe(false);
    expect(gantt.diagramType).toBe('unknown');
    expect(gantt.errors[0].message).toContain('Unsupported');
  });

  it('warns on duplicate node IDs and unparsed styling directives without failing silently', () => {
    const dup = parseMermaid('flowchart TD\n  A[First] --> B[Next]\n  A[Second] --> B\n  classDef hot fill:#f00');
    expect(dup.valid).toBe(true);
    expect(dup.warnings.some((w) => w.message.includes('Duplicate node ID "A"'))).toBe(true);
    expect(dup.warnings.some((w) => w.message.includes('classDef'))).toBe(true);
    expect(detectMermaidType('mindmap\n  root((Test))')).toBe('mindmap');
  });
});
