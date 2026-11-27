export const BRANCH_COLORS = [
  { id: 'ochre', accent: '#D49B38', line: '#D49B38' },
  { id: 'cobalt', accent: '#4D88E5', line: '#4D88E5' },
  { id: 'plum', accent: '#9B6DD6', line: '#9B6DD6' },
  { id: 'sage', accent: '#52A87A', line: '#52A87A' },
  { id: 'terracotta', accent: '#E06C52', line: '#E06C52' },
  { id: 'teal', accent: '#3CA3A3', line: '#3CA3A3' },
];

export const TRENDING_TOPICS = [
  { emoji: '🧠', title: 'Cognitive biases that shape daily decisions', category: 'Decision Science' },
  { emoji: '⚡', title: 'First-principles thinking for complex problems', category: 'Mental Models' },
  { emoji: '🏗️', title: 'How modern web apps scale to millions', category: 'System Design' },
  { emoji: '🎯', title: 'Deep work habits in a distracted world', category: 'Focus & Craft' },
  { emoji: '♟️', title: 'Game theory in business and negotiation', category: 'Strategy' },
  { emoji: '📈', title: 'Compounding skills for career leverage', category: 'Career Strategy' },
  { emoji: '🔬', title: 'How neural networks actually learn patterns', category: 'AI Engineering' },
  { emoji: '🌊', title: 'Second-order thinking before big choices', category: 'Mental Models' },
  { emoji: '⏳', title: 'Spaced repetition for long-term mastery', category: 'Learning Science' },
  { emoji: '🛡️', title: 'Building resilient personal finances', category: 'Wealth Systems' },
  { emoji: '🧭', title: 'Storytelling frameworks for clear writing', category: 'Communication' },
  { emoji: '🔄', title: 'Feedback loops in habits and systems', category: 'Systems Thinking' },
];

export const SAMPLE_MIND_MAP = {
  id: 'sample-first-principles',
  title: 'First-principles problem solving',
  createdAt: 'Nov 15',
  exploredBranchIds: ['b1', 'b2'],
  branches: [
    {
      id: 'b1',
      label: 'Deconstruct assumptions',
      colorIdx: 0,
      summary: 'Strip away inherited conventions until only verified constraints and physical or logical truths remain.',
      children: [
        { id: 'b1-1', label: 'Question "best practices"', summary: 'Separate what is truly required from habits copied out of convenience.' },
        { id: 'b1-2', label: 'Find hard constraints', summary: 'Identify immutable limits (cost, physics, time, regulation) versus negotiable rules.' },
        { id: 'b1-3', label: 'Name hidden premises', summary: 'Write down every implicit belief your current approach relies on.' },
      ],
    },
    {
      id: 'b2',
      label: 'Root-cause framing',
      colorIdx: 1,
      summary: 'Define the problem in terms of the desired outcome rather than patching a broken existing solution.',
      children: [
        { id: 'b2-1', label: 'Five whys', summary: 'Ask why a bottleneck exists repeatedly until you reach the structural cause.' },
        { id: 'b2-2', label: 'Outcome vs. method', summary: 'Keep the goal fixed while staying ruthless about replacing the method.' },
        { id: 'b2-3', label: 'Invert the problem', summary: 'Ask what guarantees failure, then systematically eliminate those paths.' },
      ],
    },
    {
      id: 'b3',
      label: 'Reconstruct from base',
      colorIdx: 2,
      summary: 'Assemble a new solution directly from fundamental building blocks instead of incremental tweaks.',
      children: [
        { id: 'b3-1', label: 'Clean-sheet design', summary: 'Design how you would solve the problem today if no legacy system existed.' },
        { id: 'b3-2', label: 'Component cost check', summary: 'Price each raw input independently to spot 10x efficiency gaps.' },
        { id: 'b3-3', label: 'Minimal viable loop', summary: 'Test the simplest working prototype that proves the core mechanism.' },
      ],
    },
    {
      id: 'b4',
      label: 'Test & falsify',
      colorIdx: 3,
      summary: 'Treat every reconstructed idea as a hypothesis to be stressed by real-world feedback.',
      children: [
        { id: 'b4-1', label: 'Seek disconfirming data', summary: 'Look for the fastest experiment that could prove your model wrong.' },
        { id: 'b4-2', label: 'Measure bottlenecks', summary: 'Track actual cycle time and failure points rather than relying on intuition.' },
        { id: 'b4-3', label: 'Tighten feedback', summary: 'Shorten the delay between changing a variable and observing its effect.' },
      ],
    },
    {
      id: 'b5',
      label: 'Analogy traps',
      colorIdx: 4,
      summary: 'Reasoning by analogy saves energy but traps you inside the ceiling of existing solutions.',
      children: [
        { id: 'b5-1', label: 'Local optima', summary: 'Polishing a familiar approach can blind you to a completely different architecture.' },
        { id: 'b5-2', label: 'Cargo-cult copying', summary: 'Borrowing surface features from leaders without understanding their constraints.' },
        { id: 'b5-3', label: 'Context drift', summary: 'Old solutions often survive long after the conditions that justified them vanished.' },
      ],
    },
    {
      id: 'b6',
      label: 'When to use it',
      colorIdx: 5,
      summary: 'First-principles thinking is expensive—save it for high-leverage or stuck problems.',
      children: [
        { id: 'b6-1', label: 'High-cost bottlenecks', summary: 'Worthwhile when incremental 10% gains no longer move the needle.' },
        { id: 'b6-2', label: 'Shifting technology', summary: 'Essential when new tools make previously impossible architectures cheap.' },
        { id: 'b6-3', label: 'Routine decisions', summary: 'Use proven heuristics for low-stakes tasks so you preserve deep focus.' },
      ],
    },
  ],
};
