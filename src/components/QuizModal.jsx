import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Loader2, Award, RotateCcw } from 'lucide-react';
import { generateQuiz } from '../services/aiProvider';

export default function QuizModal({ map, settings, onClose }) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const startQuiz = async (n) => {
    setCount(n);
    setLoading(true);
    setError('');
    try {
      const qs = await generateQuiz(map, n, settings);
      setQuestions(qs);
      setCurrentIdx(0);
      setSelectedOpt(null);
      setScore(0);
      setFinished(false);
    } catch (err) {
      setError(err.message || 'Failed to generate quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (optIdx) => {
    if (selectedOpt !== null) return;
    setSelectedOpt(optIdx);
    if (optIdx === questions[currentIdx].correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOpt(null);
    }
  };

  const currentQ = questions[currentIdx];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.6 }}>
              RETENTION CHECK
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600 }}>{map.title}</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {!count && (
          <div style={{ padding: '16px 0 6px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#B0B0BE' }}>
              Choose how many questions to test your retention:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[3, 5, 10].map((n) => (
                <button key={n} onClick={() => startQuiz(n)} style={styles.countCard}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#B9A7FF' }}>{n}</span>
                  <span style={{ fontSize: 12, color: '#C8C8D4' }}>questions</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={styles.centerBox}>
            <Loader2 size={28} color="#B9A7FF" className="spin" />
            <p style={{ margin: '10px 0 0', fontSize: 14, color: '#B0B0BE' }}>
              Crafting {count} questions from your mind map...
            </p>
          </div>
        )}

        {error && (
          <div style={styles.centerBox}>
            <p style={{ color: '#F49D97', fontSize: 13 }}>{error}</p>
            <button onClick={() => setCount(null)} style={styles.primaryBtn}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && currentQ && !finished && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.progressMeta}>
              <span>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span style={{ color: '#B9A7FF' }}>{currentQ.branchLabel}</span>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((currentIdx + 1) / questions.length) * 100}%`,
                }}
              />
            </div>

            <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, margin: '14px 0' }}>
              {currentQ.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOpt === idx;
                const isCorrect = idx === currentQ.correctIndex;
                let border = 'var(--border)';
                let bg = 'var(--surface-2)';
                if (selectedOpt !== null) {
                  if (isCorrect) {
                    border = '#95E8A8';
                    bg = 'rgba(149,232,168,0.12)';
                  } else if (isSelected) {
                    border = '#F49D97';
                    bg = 'rgba(244,157,151,0.12)';
                  }
                }
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    style={{ ...styles.optionBtn, borderColor: border, background: bg }}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>{opt}</span>
                    {selectedOpt !== null && isCorrect && <CheckCircle2 size={17} color="#95E8A8" />}
                    {selectedOpt !== null && isSelected && !isCorrect && <XCircle size={17} color="#F49D97" />}
                  </button>
                );
              })}
            </div>

            {selectedOpt !== null && (
              <div style={styles.explanationBox}>
                <p style={{ margin: 0, fontSize: 13, color: '#D2D2DC', lineHeight: 1.45 }}>
                  {currentQ.explanation}
                </p>
                <button onClick={handleNext} style={{ ...styles.primaryBtn, marginTop: 10 }}>
                  {currentIdx + 1 >= questions.length ? 'See Results' : 'Next Question'}
                </button>
              </div>
            )}
          </div>
        )}

        {finished && (
          <div style={styles.centerBox}>
            <Award size={40} color="#F7DF7B" />
            <h3 style={{ margin: '10px 0 4px', fontSize: 20 }}>
              {score} / {questions.length} Correct
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#9898A6' }}>
              {score === questions.length
                ? 'Perfect recall! You mastered this map.'
                : 'Review any missed branches to lock in retention.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCount(null)} style={styles.secondaryBtn}>
                <RotateCcw size={14} /> Quiz Again
              </button>
              <button onClick={onClose} style={styles.primaryBtn}>
                Back to Map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 95,
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 22,
    color: 'var(--text)',
    boxShadow: '0 24px 60px var(--shadow)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  closeBtn: {
    background: 'var(--surface-2)',
    border: 'none',
    color: 'var(--text-soft)',
    width: 32,
    height: 32,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  countCard: {
    background: 'rgba(124,108,255,0.12)',
    border: '1px solid rgba(185,167,255,0.3)',
    borderRadius: 16,
    padding: '18px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  centerBox: {
    padding: '28px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#9898A6',
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#7C6CFF',
    transition: 'width 0.25s ease',
  },
  optionBtn: {
    border: '1px solid',
    borderRadius: 12,
    padding: '11px 14px',
    color: 'var(--text)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  explanationBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: 'rgba(124,108,255,0.1)',
    border: '1px solid rgba(185,167,255,0.2)',
  },
  primaryBtn: {
    background: '#7C6CFF',
    border: 'none',
    color: '#FFF',
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: '#E0E0EA',
    padding: '9px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};
