import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { SAMPLE_MIND_MAP } from './data/presets';
import { generateMindMap, loadSettings, saveSettings } from './services/aiProvider';
import HomeView from './components/HomeView';
import MindMapView from './components/MindMapView';
import ThinkChatView from './components/ThinkChatView';
import QuizModal from './components/QuizModal';
import SettingsModal from './components/SettingsModal';
import StudioEditor from './studio/StudioEditor';
import TemplateGalleryModal from './templates/TemplateGalleryModal';
import {
  createDiagramDocument,
  deleteDocumentFromDB,
  exportDocumentsBackupJSON,
  loadDocumentsFromDB,
  parseBackupJSON,
  saveAllDocumentsToDB,
  saveDocumentToDB,
} from './storage/db';
import { downloadTextFile } from './studio/exportEngine';

const MAPS_KEY = 'branchwise_saved_maps_v1';
const THEME_KEY = 'branchwise_theme_v1';

function loadMaps() {
  try {
    const raw = localStorage.getItem(MAPS_KEY);
    if (!raw) return [SAMPLE_MIND_MAP];
    const parsed = JSON.parse(raw);
    return parsed.length ? parsed : [SAMPLE_MIND_MAP];
  } catch {
    return [SAMPLE_MIND_MAP];
  }
}

export default function App() {
  const [maps, setMaps] = useState(loadMaps);
  const [settings, setSettings] = useState(loadSettings);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [view, setView] = useState('home'); // 'home' | 'map' | 'chat'
  const [activeMapId, setActiveMapId] = useState(null);
  const [chatSeed, setChatSeed] = useState('');
  const [generatingTopic, setGeneratingTopic] = useState('');
  const [quizMap, setQuizMap] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Hydrate from IndexedDB (with automatic localStorage migration) on mount
  useEffect(() => {
    let mounted = true;
    loadDocumentsFromDB([SAMPLE_MIND_MAP]).then((loaded) => {
      if (mounted && loaded.length > 0) {
        setMaps(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSaveStatus('saving');
    try {
      localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
    } catch {
      // ignore localStorage quota overflow for large diagrams
    }
    const timer = setTimeout(() => {
      saveAllDocumentsToDB(maps).then(() => setSaveStatus('saved'));
    }, 180);
    return () => clearTimeout(timer);
  }, [maps]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const activeMap = maps.find((m) => m.id === activeMapId) || null;

  const handleCreateMap = async (topic, sourceText = '') => {
    setGeneratingTopic(topic || 'Source Notes');
    try {
      const newMap = await generateMindMap(topic, settings, sourceText);
      setMaps((prev) => [newMap, ...prev]);
      setActiveMapId(newMap.id);
      setView('map');
    } catch (err) {
      setSettingsNotice(err.message);
      setSettingsOpen(true);
    } finally {
      setGeneratingTopic('');
    }
  };

  const handleUpdateMap = (updatedOrFn) => {
    setMaps((prev) =>
      prev.map((m) => {
        if (m.id !== (typeof updatedOrFn === 'function' ? activeMapId : updatedOrFn.id)) return m;
        const next = typeof updatedOrFn === 'function' ? updatedOrFn(m) : updatedOrFn;
        saveDocumentToDB(next);
        return next;
      })
    );
  };

  const handleCreateDiagram = (title = 'Untitled Diagram', initialData = {}) => {
    const newDoc = createDiagramDocument(title, initialData);
    setMaps((prev) => [newDoc, ...prev]);
    saveDocumentToDB(newDoc);
    setActiveMapId(newDoc.id);
    setView('studio');
  };

  const handleSelectTemplate = (tpl) => {
    handleCreateDiagram(tpl.title, {
      nodes: JSON.parse(JSON.stringify(tpl.nodes || [])),
      edges: JSON.parse(JSON.stringify(tpl.edges || [])),
      mermaidSource: tpl.mermaidSource || '',
    });
  };

  const handleExportBackup = () => {
    const json = exportDocumentsBackupJSON(maps);
    downloadTextFile(`branchwise-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
  };

  const handleImportBackup = async (file) => {
    try {
      const text = await file.text();
      const imported = parseBackupJSON(text);
      if (imported.length > 0) {
        setMaps((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const merged = [...imported.filter((d) => !existingIds.has(d.id)), ...prev];
          return merged;
        });
      }
    } catch (err) {
      alert(`Backup import failed: ${err.message}`);
    }
  };

  const handleDeleteMap = (id) => {
    setMaps((prev) => prev.filter((m) => m.id !== id));
    deleteDocumentFromDB(id);
    if (activeMapId === id) {
      setView('home');
      setActiveMapId(null);
    }
  };

  const handleSaveSettings = (next) => {
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--bg)', color: 'var(--text)' }}>
      {view === 'home' && (
        <HomeView
          maps={maps}
          settings={settings}
          theme={theme}
          onToggleTheme={toggleTheme}
          onCreateMap={handleCreateMap}
          onCreateDiagram={handleCreateDiagram}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onOpenMap={(m) => {
            setActiveMapId(m.id);
            setView(m.docType === 'diagram' ? 'studio' : 'map');
          }}
          onDeleteMap={handleDeleteMap}
          onOpenQuiz={(m) => setQuizMap(m)}
          onOpenChat={(seed) => {
            setChatSeed(seed);
            setView('chat');
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {view === 'map' && activeMap && (
        <MindMapView
          map={activeMap}
          settings={settings}
          theme={theme}
          onToggleTheme={toggleTheme}
          onUpdateMap={handleUpdateMap}
          onBack={() => setView('home')}
          onOpenQuiz={() => setQuizMap(activeMap)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {view === 'studio' && activeMap && activeMap.docType === 'diagram' && (
        <StudioEditor
          doc={activeMap}
          theme={theme}
          saveStatus={saveStatus}
          onToggleTheme={toggleTheme}
          onUpdateDoc={handleUpdateMap}
          onBack={() => setView('home')}
          onOpenTemplates={() => setTemplatesOpen(true)}
        />
      )}

      {view === 'chat' && (
        <ThinkChatView
          initialPrompt={chatSeed}
          settings={settings}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => setView('home')}
          onConvertToMap={handleCreateMap}
        />
      )}

      {generatingTopic && (
        <div style={loadingOverlay}>
          <div style={loadingCard}>
            <Loader2 size={22} color="var(--text)" className="spin" />
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>
              Mapping “{generatingTopic}”...
            </div>
          </div>
        </div>
      )}

      {quizMap && (
        <QuizModal
          map={quizMap}
          settings={settings}
          onClose={() => setQuizMap(null)}
        />
      )}

      <TemplateGalleryModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          notice={settingsNotice}
          onSave={(next) => {
            setSettingsNotice('');
            handleSaveSettings(next);
          }}
          onClose={() => {
            setSettingsNotice('');
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

const loadingOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 120,
};

const loadingCard = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '24px 28px',
  width: 'min(320px, 86vw)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  boxShadow: '0 8px 24px var(--shadow)',
};
