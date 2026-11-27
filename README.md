# MindLattice

An open-source, bring-your-own-key (BYOK) **visual AI thinking workspace** for turning any topic into an interactive 3-level knowledge lattice, exploring ideas in chat, and testing retention with quizzes.

Made freely for everyone by **[Sewak Singh](https://github.com/mrsingh111)**.

[![Buy Me a Coffee](https://img.shields.io/badge/Support-Buy%20Me%20a%20Coffee-orange?style=flat-square)](https://buymeacoffee.com/sewak_singh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

## Screenshots & How It Works

### 1. Editorial Workspace & Active Lattice
Type any topic or question, pick from curated starters, or jump back into your active lattice with a live mini-graph preview.

![MindLattice Home Workspace](docs/screenshots/home-workspace.png)

### 2. Interactive 3-Level Mind Map (Dark & Light)
Click any branch to expand its sub-nodes and on-canvas explanation callouts, use **Go Deeper with AI**, or query the lattice directly.

![MindLattice 3-Level Mind Map](docs/screenshots/mindmap-dark.png)

### 3. Mobile-Ready Canvas & Bring Your Own AI Key
Works cleanly on phone screens (`390×844`) and supports 11 developer AI providers (including free-tier **OpenRouter** and **Groq**).

| Mobile View (`390×844`) | AI API Configuration |
| :---: | :---: |
| ![Mobile Canvas](docs/screenshots/mobile-canvas.png) | ![AI API Configuration](docs/screenshots/api-config.png) |

## Features

- **3-Level Interactive Mind Maps:** Central topic → color-coded branch cards → sub-node pills → on-canvas explanation callouts, with automatic collision-free spacing.
- **Go Deeper with AI:** Expand any branch or sub-node dynamically with new AI-generated child nodes.
- **Map-Aware Q&A:** Query any lattice — answers point back to existing nodes and let you add new suggested nodes with one click.
- **Reasoning Chat:** Think through messy ideas conversationally and convert any thread into a visual lattice.
- **Retention Quiz:** Generate 3, 5, or 10 multiple-choice questions from any map.
- **Dark & Light Themes:** Crisp blueprint-grid canvas in both dark and light modes, plus Markdown export.
- **100% Client-Side & Private:** Maps, theme, and API keys are stored only in your browser's `localStorage`.

## Supported AI Providers (BYOK)

Click the API status pill in the top-right to configure any OpenAI-compatible endpoint:

> **Free API Tip:** **OpenRouter** (free-tier models) and **Groq** both offer free limited API usage so you can try MindLattice without paying.

- **OpenRouter** (Free tier available)
- **Groq** (Free tier available)
- **OpenAI**
- **OpenCode Zen**
- **DeepSeek**
- **Together AI**
- **Mistral**
- **xAI Grok**
- **Google Gemini** (OpenAI-compatible endpoint)
- **Ollama** (Local, no key needed)
- **LM Studio** (Local, no key needed)

You can also use **Demo AI** mode without a key, or enable **"Require API key for AI thinking"** in Settings.

## Quick Start

```bash
git clone https://github.com/mrsingh111/mindlattice.git
cd mindlattice
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Production Build

```bash
npm run build
```

## Support

If MindLattice helps you learn or think faster, consider supporting my work:

👉 **[buymeacoffee.com/sewak_singh](https://buymeacoffee.com/sewak_singh)**

## License

[MIT](LICENSE) © 2026 Sewak Singh
