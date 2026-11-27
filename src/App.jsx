import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { SAMPLE_MIND_MAP } from './data/presets';
import { generateMindMap, loadSettings, saveSettings } from './services/aiProvider';
import HomeView from './components/HomeView';
import MindMapView from './components/MindMapView';
import ThinkChatView from './components/ThinkChatView';
import QuizModal from './components/QuizModal';
import SettingsModal from './components/SettingsModal';

const MAPS_KEY = 'mindlattice_saved_maps_v1';
const THEME_KEY = 'mindlattice_theme_v1';

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

  useEffect(() => {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
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

  const handleUpdateMap = (updated) => {
    setMaps((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleDeleteMap = (id) => {
    setMaps((prev) => prev.filter((m) => m.id !== id));
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
          onOpenMap={(m) => {
            setActiveMapId(m.id);
            setView('map');
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
