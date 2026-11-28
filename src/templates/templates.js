// Original built-in templates for Branchwise 2.0 across all 12 technical categories

export const TEMPLATE_CATEGORIES = [
  'All',
  'Flowcharts',
  'Software Architecture',
  'System Design',
  'UML',
  'ER Diagrams',
  'Sequence Diagrams',
  'Network Diagrams',
  'Business Processes',
  'Mind Maps',
  'Project Workflows',
  'API Architecture',
  'Cloud Infrastructure',
];

function n(id, label, shape, x, y, extra = {}) {
  return {
    id,
    label,
    shape,
    x,
    y,
    w: extra.w || (shape === 'diamond' ? 150 : shape === 'circle' ? 96 : shape === 'database' ? 145 : shape === 'er_table' || shape === 'class' ? 195 : 165),
    h: extra.h || (shape === 'diamond' ? 92 : shape === 'circle' ? 96 : shape === 'database' ? 88 : shape === 'er_table' || shape === 'class' ? 132 : 64),
    fill: extra.fill || '',
    stroke: extra.stroke || '',
    textColor: '',
    fontSize: 13,
    layerId: 'layer_default',
    locked: false,
    groupId: extra.groupId || null,
    metadata: extra.metadata || {},
  };
}

function e(id, source, target, label = '', opts = {}) {
  return {
    id,
    source,
    target,
    label,
    routing: opts.routing || 'orthogonal',
    lineStyle: opts.lineStyle || 'solid',
    arrowEnd: opts.arrowEnd || 'arrow',
    arrowStart: opts.arrowStart || 'none',
    stroke: opts.stroke || '',
    strokeWidth: 2,
    layerId: 'layer_default',
  };
}

export const BUILTIN_TEMPLATES = [
  {
    id: 'tpl_auth_flowchart',
    title: 'Auth & Session Flowchart',
    category: 'Flowcharts',
    description: 'User login validation, MFA decision branch, token issuance, and error recovery.',
    diagramType: 'flowchart',
    mermaidSource: `flowchart TD
  start(["User Submits Login"])
  validate["Validate Credentials"]
  mfa{"MFA Enabled?"}
  verify["Verify OTP Code"]
  issue(["Issue JWT & Session"])
  deny["Return 401 Error"]
  start --> validate
  validate --> mfa
  mfa -->|Yes| verify
  mfa -->|No| issue
  verify --> issue
  verify -.->|Invalid| deny`,
    nodes: [
      n('start', 'User Submits Login', 'start', 260, 60),
      n('validate', 'Validate Credentials', 'rect', 248, 165),
      n('mfa', 'MFA Enabled?', 'diamond', 255, 275),
      n('verify', 'Verify OTP Code', 'rect', 100, 415),
      n('issue', 'Issue JWT & Session', 'end', 395, 420),
      n('deny', 'Return 401 Error', 'rounded', 100, 535),
    ],
    edges: [
      e('e1', 'start', 'validate'),
      e('e2', 'validate', 'mfa'),
      e('e3', 'mfa', 'verify', 'Yes'),
      e('e4', 'mfa', 'issue', 'No'),
      e('e5', 'verify', 'issue'),
      e('e6', 'verify', 'deny', 'Invalid', { lineStyle: 'dashed' }),
    ],
  },
  {
    id: 'tpl_microservices',
    title: 'Event-Driven Microservices',
    category: 'Software Architecture',
    description: 'API Gateway routing to domain services, async message queue, and dedicated data stores.',
    diagramType: 'flowchart',
    mermaidSource: `flowchart LR
  client(["Web / Mobile Client"])
  gw["API Gateway"]
  auth["Auth Service"]
  orders["Order Service"]
  mq["Message Queue"]
  worker["Billing Worker"]
  db[("Postgres DB")]
  client --> gw
  gw --> auth
  gw --> orders
  orders --> mq
  orders --> db
  mq -.-> worker`,
    nodes: [
      n('client', 'Web / Mobile Client', 'start', 60, 210),
      n('gw', 'API Gateway', 'service', 265, 205),
      n('auth', 'Auth Service', 'service', 490, 95),
      n('orders', 'Order Service', 'service', 490, 265),
      n('mq', 'Message Queue', 'queue', 720, 195),
      n('worker', 'Billing Worker', 'service', 945, 195),
      n('db', 'Postgres DB', 'database', 725, 330),
    ],
    edges: [
      e('e1', 'client', 'gw', 'HTTPS'),
      e('e2', 'gw', 'auth', 'JWT'),
      e('e3', 'gw', 'orders', 'REST'),
      e('e4', 'orders', 'mq', 'OrderCreated'),
      e('e5', 'orders', 'db', 'SQL'),
      e('e6', 'mq', 'worker', 'Async', { lineStyle: 'dashed' }),
    ],
  },
  {
    id: 'tpl_rate_limiter',
    title: 'Distributed Rate Limiter',
    category: 'System Design',
    description: 'High-throughput edge load balancer, Redis token-bucket store, and upstream cluster.',
    diagramType: 'flowchart',
    nodes: [
      n('edge', 'Edge CDN / WAF', 'cloud', 80, 190),
      n('lb', 'Load Balancer', 'service', 290, 190),
      n('check', 'Quota Remaining?', 'diamond', 500, 175),
      n('redis', 'Redis Token Bucket', 'database', 502, 40),
      n('api', 'Upstream API Pool', 'service', 730, 190),
      n('rej', '429 Too Many Requests', 'rounded', 500, 340),
    ],
    edges: [
      e('e1', 'edge', 'lb'),
      e('e2', 'lb', 'check'),
      e('e3', 'check', 'redis', 'INCR/TTL', { lineStyle: 'dashed' }),
      e('e4', 'check', 'api', 'Allow'),
      e('e5', 'check', 'rej', 'Exceeded'),
    ],
  },
  {
    id: 'tpl_uml_class',
    title: 'Domain Model Class Diagram',
    category: 'UML',
    description: 'Object-oriented class hierarchy for Account, Order, and PaymentProcessor.',
    diagramType: 'classDiagram',
    mermaidSource: `classDiagram
  class Account {
    +id: UUID
    +email: string
    +authenticate()
  }
  class Order {
    +id: UUID
    +total: number
    +submit()
  }
  class PaymentProcessor {
    +charge(amount)
    +refund(txId)
  }
  Account --> Order : places
  Order --> PaymentProcessor : uses`,
    nodes: [
      n('Account', 'Account', 'class', 120, 140, { metadata: { members: ['+id: UUID', '+email: string', '+authenticate()'] } }),
      n('Order', 'Order', 'class', 410, 140, { metadata: { members: ['+id: UUID', '+total: number', '+submit()'] } }),
      n('PaymentProcessor', 'PaymentProcessor', 'class', 700, 140, { metadata: { members: ['+charge(amount)', '+refund(txId)'] } }),
    ],
    edges: [
      e('e1', 'Account', 'Order', 'places (1..*)'),
      e('e2', 'Order', 'PaymentProcessor', 'uses'),
    ],
  },
  {
    id: 'tpl_er_saas',
    title: 'SaaS Multi-Tenant ER Schema',
    category: 'ER Diagrams',
    description: 'Relational database tables with primary keys, foreign keys, and cardinality labels.',
    diagramType: 'erDiagram',
    mermaidSource: `erDiagram
  ORG {
    uuid id PK
    string slug
  }
  USER {
    uuid id PK
    uuid org_id FK
    string role
  }
  DOCUMENT {
    uuid id PK
    uuid owner_id FK
    string title
  }
  ORG ||--o{ USER : "has members"
  USER ||--o{ DOCUMENT : "authors"`,
    nodes: [
      n('ORG', 'ORG', 'er_table', 90, 160, { metadata: { columns: ['PK uuid id', 'string slug', 'timestamp created_at'] } }),
      n('USER', 'USER', 'er_table', 380, 160, { metadata: { columns: ['PK uuid id', 'FK uuid org_id', 'string role'] } }),
      n('DOCUMENT', 'DOCUMENT', 'er_table', 670, 160, { metadata: { columns: ['PK uuid id', 'FK uuid owner_id', 'string title'] } }),
    ],
    edges: [
      e('e1', 'ORG', 'USER', '1 : N'),
      e('e2', 'USER', 'DOCUMENT', '1 : N'),
    ],
  },
  {
    id: 'tpl_oauth_sequence',
    title: 'OAuth 2.0 PKCE Sequence',
    category: 'Sequence Diagrams',
    description: 'Client, Authorization Server, and Resource API token exchange flow.',
    diagramType: 'sequenceDiagram',
    mermaidSource: `sequenceDiagram
  actor Client
  participant AuthServer as Auth Server
  participant ResourceAPI as Resource API
  Client->>AuthServer: 1. Auth Code + PKCE Challenge
  AuthServer-->>Client: 2. Authorization Code
  Client->>AuthServer: 3. Exchange Code + Verifier
  AuthServer-->>Client: 4. Access Token (JWT)
  Client->>ResourceAPI: 5. GET /data (Bearer JWT)`,
    nodes: [
      n('Client', 'Client App', 'circle', 110, 110, { w: 110, h: 110 }),
      n('AuthServer', 'Auth Server', 'service', 390, 130),
      n('ResourceAPI', 'Resource API', 'service', 680, 130),
    ],
    edges: [
      e('e1', 'Client', 'AuthServer', '1. Auth + PKCE', { routing: 'curved' }),
      e('e2', 'AuthServer', 'Client', '2. Auth Code', { routing: 'curved', lineStyle: 'dashed' }),
      e('e3', 'Client', 'ResourceAPI', '3. Bearer JWT', { routing: 'curved' }),
    ],
  },
  {
    id: 'tpl_network_dmz',
    title: 'Enterprise DMZ Topology',
    category: 'Network Diagrams',
    description: 'Perimeter firewall, core switch, DMZ web tier, and isolated internal database VLAN.',
    diagramType: 'flowchart',
    nodes: [
      n('wan', 'Internet / WAN', 'cloud', 80, 190),
      n('fw', 'Perimeter Firewall', 'firewall', 300, 190),
      n('sw', 'Core L3 Switch', 'switch', 520, 190),
      n('web', 'DMZ Web Cluster', 'server', 740, 100),
      n('db', 'Internal DB VLAN', 'database', 745, 280),
    ],
    edges: [
      e('e1', 'wan', 'fw', '443/TCP'),
      e('e2', 'fw', 'sw', 'Inspected'),
      e('e3', 'sw', 'web', 'VLAN 10'),
      e('e4', 'sw', 'db', 'VLAN 20', { lineStyle: 'dashed' }),
    ],
  },
  {
    id: 'tpl_incident_sop',
    title: 'Incident Triage Process',
    category: 'Business Processes',
    description: 'Operational escalation workflow from alert trigger to post-mortem documentation.',
    diagramType: 'flowchart',
    nodes: [
      n('alert', 'Pager Alert Triggered', 'start', 100, 170),
      n('sev', 'Severity >= P1?', 'diamond', 320, 155),
      n('war', 'Open War Room', 'rect', 540, 85),
      n('queue', 'Assign Sprint Triage', 'rect', 540, 245),
      n('post', 'Publish Post-Mortem', 'document', 770, 165),
    ],
    edges: [
      e('e1', 'alert', 'sev'),
      e('e2', 'sev', 'war', 'Yes (P0/P1)'),
      e('e3', 'sev', 'queue', 'No (P2/P3)'),
      e('e4', 'war', 'post'),
      e('e5', 'queue', 'post'),
    ],
  },
  {
    id: 'tpl_product_mindmap',
    title: 'Product Discovery Map',
    category: 'Mind Maps',
    description: 'Central product thesis branching into user pain points, moat, and distribution.',
    diagramType: 'flowchart',
    nodes: [
      n('core', 'Product Strategy', 'circle', 380, 200, { w: 130, h: 130 }),
      n('pain', 'User Pain Points', 'sticky', 130, 90),
      n('moat', 'Technical Moat', 'sticky', 630, 90),
      n('dist', 'Distribution Channels', 'sticky', 130, 320),
      n('metrics', 'North Star Metrics', 'sticky', 630, 320),
    ],
    edges: [
      e('e1', 'core', 'pain', '', { routing: 'curved', arrowEnd: 'none' }),
      e('e2', 'core', 'moat', '', { routing: 'curved', arrowEnd: 'none' }),
      e('e3', 'core', 'dist', '', { routing: 'curved', arrowEnd: 'none' }),
      e('e4', 'core', 'metrics', '', { routing: 'curved', arrowEnd: 'none' }),
    ],
  },
  {
    id: 'tpl_cicd_workflow',
    title: 'CI/CD Release Pipeline',
    category: 'Project Workflows',
    description: 'Pull request checks, unit tests, container build, staging soak, and production deploy.',
    diagramType: 'stateDiagram-v2',
    mermaidSource: `stateDiagram-v2
  [*] --> Build
  Build --> Test : Run Suite
  Test --> Staging : Green
  Staging --> Production : Approve`,
    nodes: [
      n('pr', 'PR Opened', 'start', 70, 190),
      n('build', 'Build & Lint', 'rounded', 255, 185),
      n('test', 'Integration Tests', 'rounded', 465, 185),
      n('stage', 'Staging Canary', 'rounded', 675, 185),
      n('prod', 'Prod Rollout', 'end', 885, 190),
    ],
    edges: [
      e('e1', 'pr', 'build'),
      e('e2', 'build', 'test', 'Pass'),
      e('e3', 'test', 'stage', 'Pass'),
      e('e4', 'stage', 'prod', 'Approve'),
    ],
  },
  {
    id: 'tpl_api_bff',
    title: 'Backend-for-Frontend API',
    category: 'API Architecture',
    description: 'GraphQL/REST BFF aggregating Catalog, Pricing, and Inventory downstream APIs.',
    diagramType: 'flowchart',
    nodes: [
      n('app', 'Client SPA', 'rect', 80, 190),
      n('bff', 'BFF Aggregator', 'api', 310, 190),
      n('cat', 'Catalog API', 'api', 560, 75),
      n('prc', 'Pricing Engine', 'api', 560, 190),
      n('inv', 'Inventory API', 'api', 560, 305),
    ],
    edges: [
      e('e1', 'app', 'bff', 'GraphQL'),
      e('e2', 'bff', 'cat', 'gRPC'),
      e('e3', 'bff', 'prc', 'REST'),
      e('e4', 'bff', 'inv', 'gRPC'),
    ],
  },
  {
    id: 'tpl_cloud_vpc',
    title: 'Multi-AZ Cloud VPC',
    category: 'Cloud Infrastructure',
    description: 'Public subnet ingress, private Kubernetes app nodes, and managed primary/replica DB.',
    diagramType: 'flowchart',
    nodes: [
      n('vpc', 'Production VPC (10.0.0.0/16)', 'container', 260, 50, { w: 620, h: 360 }),
      n('ingress', 'ALB / Ingress', 'cloud', 60, 195),
      n('k8s1', 'App Pod AZ-a', 'server', 310, 110, { groupId: 'vpc' }),
      n('k8s2', 'App Pod AZ-b', 'server', 310, 260, { groupId: 'vpc' }),
      n('rds', 'Managed Primary DB', 'database', 620, 185, { groupId: 'vpc' }),
    ],
    edges: [
      e('e1', 'ingress', 'k8s1', 'HTTPS'),
      e('e2', 'ingress', 'k8s2', 'HTTPS'),
      e('e3', 'k8s1', 'rds', 'TLS Pool'),
      e('e4', 'k8s2', 'rds', 'TLS Pool'),
    ],
  },
];
