const STORAGE_KEY = 'branchwise_ai_settings_v1';

export const DEFAULT_SETTINGS = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  customSystemPrompt:
    'You are Branchwise, an AI visual thinking partner. Break complex topics into clear, memorable, non-overlapping mental models, concise branch labels (2-5 words), and practical summaries.',
  useDemoIfNoKey: true,
};

export const PROVIDER_PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter (Free tier)', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'groq', label: 'Groq (Free tier)', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'opencode', label: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', model: 'big-pickle' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { id: 'xai', label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { id: 'ollama', label: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  { id: 'lmstudio', label: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isLiveApiConfigured(settings) {
  const isLocal = settings.baseUrl?.includes('localhost') || settings.baseUrl?.includes('127.0.0.1');
  return Boolean(settings.apiKey?.trim() || isLocal);
}

function assertApiOrDemo(settings) {
  if (isLiveApiConfigured(settings)) return 'live';
  if (settings.useDemoIfNoKey) return 'demo';
  throw new Error('API key required: Please add your AI API key in Settings to use AI thinking.');
}

function extractJson(text) {
  const cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : cleaned;
  const firstBrace = candidate.indexOf('{');
  const firstBracket = candidate.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) start = firstBrace;
  else if (firstBracket !== -1) start = firstBracket;
  if (start === -1) throw new Error('Model did not return valid JSON.');
  return JSON.parse(candidate.slice(start));
}

async function callChatCompletion(messages, settings, jsonMode = false) {
  const base = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  const body = {
    model: settings.model || 'gpt-4o-mini',
    messages,
    temperature: 0.7,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Some OpenAI-compatible endpoints reject response_format: json_object
  if (!res.ok && jsonMode) {
    delete body.response_format;
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API error (${res.status}): ${errText.slice(0, 220) || res.statusText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI API.');
  return content;
}

function uid(prefix = 'n') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Demo fallback generators so the app works immediately without an API key ---
function buildDemoMindMap(topic, sourceText = '') {
  const t = topic.trim() || 'Source Notes';
  if (sourceText.trim()) {
    const lines = sourceText
      .split(/\n+/)
      .map((l) => l.replace(/^[-*#\d.]+\s*/, '').trim())
      .filter((l) => l.length > 8);
    const chunks = lines.length >= 6 ? lines.slice(0, 6) : [
      ...lines,
      'Core thesis & main argument',
      'Key mechanisms & evidence',
      'Practical implications',
      'Hidden assumptions & edge cases',
      'Open questions to verify',
      'Actionable next steps',
    ].slice(0, 6);

    return {
      id: uid('map'),
      title: t,
      createdAt: 'today',
      isDemo: true,
      fromSource: true,
      exploredBranchIds: [],
      masteredNodeIds: [],
      reviewNodeIds: [],
      crossLinks: [],
      branches: chunks.map((chunk, idx) => {
        const shortLabel = chunk.split(/\s+/).slice(0, 4).join(' ');
        return {
          id: `b${idx + 1}`,
          label: shortLabel.length > 28 ? shortLabel.slice(0, 26) + '…' : shortLabel,
          colorIdx: idx % 6,
          summary: `Extracted from your source: "${chunk.slice(0, 110)}${chunk.length > 110 ? '…' : ''}"`,
          children: [
            {
              id: `b${idx + 1}-1`,
              label: 'Source takeaway',
              summary: `Key point grounded in your pasted material around "${shortLabel}".`,
            },
            {
              id: `b${idx + 1}-2`,
              label: 'Why it matters',
              summary: `How "${shortLabel}" connects to the broader argument in ${t}.`,
            },
            {
              id: `b${idx + 1}-3`,
              label: 'Check understanding',
              summary: `Test yourself: can you explain "${shortLabel}" without looking?`,
            },
          ],
        };
      }),
    };
  }

  const lenses = [
    { label: 'Core fundamentals', focus: 'the foundational principles and first-principles mechanics' },
    { label: 'How it works', focus: 'the step-by-step process, workflow, or feedback loop' },
    { label: 'Key leverage points', focus: 'high-impact tactics that produce disproportionate results' },
    { label: 'Common pitfalls', focus: 'frequent mistakes, blind spots, and misconceptions to avoid' },
    { label: 'Practical playbook', focus: 'actionable steps you can apply immediately' },
    { label: 'Mental models', focus: 'frameworks for thinking clearly about long-term trade-offs' },
  ];

  return {
    id: uid('map'),
    title: t,
    createdAt: 'today',
    isDemo: true,
    exploredBranchIds: [],
    masteredNodeIds: [],
    reviewNodeIds: [],
    crossLinks: [],
    branches: lenses.map((lens, idx) => ({
      id: `b${idx + 1}`,
      label: lens.label,
      colorIdx: idx % 6,
      summary: `${lens.label} of "${t}": explores ${lens.focus}.`,
      children: [
        {
          id: `b${idx + 1}-1`,
          label: `Key principle #${idx + 1}`,
          summary: `Core idea explaining ${lens.focus} in the context of ${t}.`,
        },
        {
          id: `b${idx + 1}-2`,
          label: `Real-world pattern`,
          summary: `How ${lens.label.toLowerCase()} shows up in practice when working with ${t}.`,
        },
        {
          id: `b${idx + 1}-3`,
          label: `Actionable takeaway`,
          summary: `One concrete way to apply ${lens.label.toLowerCase()} to ${t} today.`,
        },
      ],
    })),
  };
}

export async function generateMindMap(topic, settings, sourceText = '') {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 650));
    return buildDemoMindMap(topic, sourceText);
  }

  const systemPrompt = `${settings.customSystemPrompt}
Return ONLY valid JSON with this exact schema:
{
  "title": "concise topic title",
  "branches": [
    {
      "label": "2-4 word branch title",
      "summary": "1-2 sentence clear explanation",
      "shape": "card | process | decision | store",
      "children": [
        { "label": "2-4 word sub-idea", "summary": "1-2 sentence explanation", "shape": "card | process | decision | store" }
      ]
    }
  ]
}
Create 6 distinct, logical branches with 3 children each. Use "card" for general concepts, or "process"/"decision"/"store" when mapping workflows, code, or system architecture.`;

  const userPrompt = sourceText.trim()
    ? `Extract a Branchwise knowledge map grounded strictly in this source material (title: "${topic || 'Source Notes'}"):\n\n${sourceText.slice(0, 12000)}`
    : `Create a Branchwise knowledge map for: "${topic}"`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  const branches = (parsed.branches || []).slice(0, 6).map((b, idx) => ({
    id: `b${idx + 1}`,
    label: b.label || `Branch ${idx + 1}`,
    colorIdx: idx % 6,
    shape: b.shape || 'card',
    summary: b.summary || '',
    children: (b.children || []).map((c, cIdx) => ({
      id: `b${idx + 1}-${cIdx + 1}`,
      label: c.label || `Idea ${cIdx + 1}`,
      shape: c.shape || 'card',
      summary: c.summary || '',
    })),
  }));

  return {
    id: uid('map'),
    title: parsed.title || topic || 'Source Notes',
    createdAt: 'today',
    isDemo: false,
    fromSource: Boolean(sourceText.trim()),
    exploredBranchIds: [],
    masteredNodeIds: [],
    reviewNodeIds: [],
    crossLinks: [],
    branches,
  };
}

export async function synthesizeNodes(map, nodeA, nodeB, settings) {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 400));
    return {
      id: uid('link'),
      fromId: nodeA.id,
      toId: nodeB.id,
      fromLabel: nodeA.label,
      toLabel: nodeB.label,
      insight: `"${nodeA.label}" and "${nodeB.label}" reinforce each other inside ${map.title}: mastering the first makes the second easier to apply without blind spots.`,
    };
  }

  const systemPrompt = `${settings.customSystemPrompt}
Compare two concepts from a knowledge map and explain their non-obvious connection, tension, or dependency in 1-2 crisp sentences.
Return ONLY valid JSON: { "insight": "1-2 sentence synthesis" }`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Topic: "${map.title}"\nConcept A: "${nodeA.label}" (${nodeA.summary || ''})\nConcept B: "${nodeB.label}" (${nodeB.summary || ''})\nHow do these two ideas interact, reinforce, or contradict each other?`,
      },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  return {
    id: uid('link'),
    fromId: nodeA.id,
    toId: nodeB.id,
    fromLabel: nodeA.label,
    toLabel: nodeB.label,
    insight: parsed.insight || `${nodeA.label} ↔ ${nodeB.label}`,
  };
}

export async function editMapWithAI(map, instruction, settings) {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 450));
    const lower = instruction.toLowerCase();
    const cleanText = instruction.replace(/^(add|create|make)\s+(a\s+)?(branch|node|topic)?\s*(about|for|on)?\s*/i, '').trim();
    if (lower.startsWith('remove ') || lower.startsWith('delete ')) {
      const target = instruction.replace(/^(remove|delete)\s+/i, '').trim().toLowerCase();
      return {
        summary: `Removed matching item for "${target}".`,
        operations: [{ type: 'deleteByLabel', label: target }],
      };
    }
    const label = (cleanText || instruction).split(/\s+/).slice(0, 4).join(' ');
    return {
      summary: `Added new branch "${label}" to "${map.title}".`,
      operations: [
        {
          type: 'addBranch',
          label: label.slice(0, 32),
          summary: `Added via Edit Map: ${instruction}`,
          shape: lower.includes('db') || lower.includes('store') ? 'store' : lower.includes('decision') || lower.includes('if') ? 'decision' : lower.includes('step') || lower.includes('process') ? 'process' : 'card',
          children: [
            { label: 'Core mechanism', summary: `How ${label} operates in ${map.title}.` },
            { label: 'Key trade-off', summary: `Main advantage and constraint of ${label}.` },
          ],
        },
      ],
    };
  }

  const mapContext = map.branches
    .map(
      (b) =>
        `Branch [${b.id}] "${b.label}" (${b.shape || 'card'}): ${b.summary}\n` +
        b.children.map((c) => `  - Node [${c.id}] "${c.label}" (${c.shape || 'card'}): ${c.summary}`).join('\n')
    )
    .join('\n');

  const systemPrompt = `${settings.customSystemPrompt}
You are editing an existing Branchwise diagram based on the user's command.
Return ONLY valid JSON with this schema:
{
  "summary": "1 sentence describing what changed",
  "operations": [
    { "type": "addBranch", "label": "2-4 words", "summary": "1-2 sentences", "shape": "card|process|decision|store", "children": [{ "label": "2-4 words", "summary": "1 sentence" }] },
    { "type": "addChild", "parentBranchId": "b1", "label": "2-4 words", "summary": "1 sentence", "shape": "card|process|decision|store" },
    { "type": "renameNode", "nodeId": "b1-1", "label": "new label", "summary": "optional new summary" },
    { "type": "deleteNode", "nodeId": "b1-1" }
  ]
}
Include only the operations needed to fulfill the request.`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Current map "${map.title}":\n${mapContext}\n\nEdit command: ${instruction}` },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  return {
    summary: parsed.summary || 'Updated map.',
    operations: Array.isArray(parsed.operations) ? parsed.operations : [],
  };
}

export async function expandNodeWithAI(map, branch, targetNode, settings) {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 450));
    return [
      { id: uid('sub'), label: `Deep dive: ${targetNode.label}`, summary: `Detailed breakdown of how ${targetNode.label} works inside ${map.title}.` },
      { id: uid('sub'), label: `Edge case & nuance`, summary: `When ${targetNode.label} behaves unexpectedly and how to handle it.` },
      { id: uid('sub'), label: `Next step`, summary: `Practical exercise to master ${targetNode.label}.` },
    ];
  }

  const systemPrompt = `${settings.customSystemPrompt}
Return ONLY valid JSON: { "children": [ { "label": "2-4 word sub-idea", "summary": "1-2 sentence explanation" } ] } with exactly 3 deeper sub-ideas.`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Mind map topic: "${map.title}"\nBranch: "${branch.label}"\nGo deeper on node: "${targetNode.label}" (${targetNode.summary}). Generate 3 sharper, deeper sub-nodes.`,
      },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  return (parsed.children || []).slice(0, 4).map((c) => ({
    id: uid('sub'),
    label: c.label || 'Deeper idea',
    summary: c.summary || '',
  }));
}

export async function askAboutMap(map, question, history, settings) {
  const mapContext = map.branches
    .map(
      (b) =>
        `Branch [${b.id}] "${b.label}": ${b.summary}\n` +
        b.children.map((c) => `  - Node [${c.id}] "${c.label}": ${c.summary}`).join('\n')
    )
    .join('\n');

  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 500));
    const firstBranch = map.branches[0];
    const secondBranch = map.branches[1] || firstBranch;
    return {
      answer: `Looking at "${map.title}", your question connects directly to **${firstBranch?.label}** and **${secondBranch?.label}**. Click the referenced nodes below to jump to them, or add the suggested new idea to your map.`,
      referencedNodeIds: [firstBranch?.id, secondBranch?.id].filter(Boolean),
      suggestedNodes: [
        {
          parentBranchId: firstBranch?.id || 'b1',
          label: question.slice(0, 28) + (question.length > 28 ? '…' : ''),
          summary: `AI-added insight addressing: "${question}"`,
        },
      ],
    };
  }

  const systemPrompt = `${settings.customSystemPrompt}
You are answering a question about an existing mind map.
Your answer should point back to relevant ideas in the map (by their exact IDs) AND optionally propose 1-2 new child nodes to add to the map if the question introduces a useful new angle.
Return ONLY valid JSON:
{
  "answer": "clear, concise answer (2-4 sentences)",
  "referencedNodeIds": ["b1", "b2-1"],
  "suggestedNodes": [
    { "parentBranchId": "b1", "label": "2-4 word node label", "summary": "1-2 sentence explanation" }
  ]
}`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Mind Map "${map.title}":\n${mapContext}\n\nRecent chat:\n${history.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n')}\n\nUser question: ${question}` },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  return {
    answer: parsed.answer || 'Here is how that connects to your map.',
    referencedNodeIds: Array.isArray(parsed.referencedNodeIds) ? parsed.referencedNodeIds : [],
    suggestedNodes: Array.isArray(parsed.suggestedNodes) ? parsed.suggestedNodes : [],
  };
}

export async function generateQuiz(map, count, settings) {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 500));
    const pool = map.branches.flatMap((b) =>
      b.children.map((c) => ({
        branchLabel: b.label,
        question: `In "${map.title}", what best describes "${c.label}" (under ${b.label})?`,
        options: [
          c.summary,
          `An unrelated concept outside ${b.label.toLowerCase()}`,
          `A common myth that contradicts ${map.title}`,
          `None of the above`,
        ],
        correctIndex: 0,
        explanation: `${c.label}: ${c.summary}`,
      }))
    );
    return pool.slice(0, count);
  }

  const mapContext = map.branches
    .map((b) => `${b.label}: ${b.summary} | ${b.children.map((c) => `${c.label} (${c.summary})`).join('; ')}`)
    .join('\n');

  const systemPrompt = `${settings.customSystemPrompt}
Generate a ${count}-question multiple-choice quiz based strictly on the mind map below to test retention.
Return ONLY valid JSON:
{
  "questions": [
    {
      "branchLabel": "branch name",
      "question": "clear question",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "brief explanation of why"
    }
  ]
}`;

  const content = await callChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Topic: ${map.title}\n\n${mapContext}\n\nGenerate exactly ${count} questions.` },
    ],
    settings,
    true
  );

  const parsed = extractJson(content);
  return (parsed.questions || []).slice(0, count);
}

export async function thinkItThroughChat(messages, settings) {
  if (assertApiOrDemo(settings) === 'demo') {
    await new Promise((r) => setTimeout(r, 450));
    const last = messages[messages.length - 1]?.content || '';
    return `Let's think through **"${last.slice(0, 60)}"** step by step:\n\n1. **Core tension:** What outcome are you actually optimizing for?\n2. **Key variables:** Usually 2–3 levers drive 80% of the result.\n3. **Next move:** Click **"Convert to Mind Map"** above anytime to turn this thread into a visual map.\n\n*(Connect your AI API key in Settings ⚙️ for live responses from your chosen model.)*`;
  }

  return await callChatCompletion(
    [
      {
        role: 'system',
        content: `${settings.customSystemPrompt}\nYou are in Reasoning Chat mode: help the user reason clearly, ask sharp clarifying questions, and structure messy thoughts into clear pillars.`,
      },
      ...messages,
    ],
    settings,
    false
  );
}
