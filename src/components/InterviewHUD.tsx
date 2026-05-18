/**
 * InterviewHUD.tsx — Interview copilot HUD panel
 *
 * Mounts as a sibling of NativelyInterface inside the overlay early-return
 * branch of App.tsx. Toggled by Ctrl+Shift+H.
 *
 * Architecture (Rev 7):
 *   - Uses useOrchestrator for all session state and agent dispatch.
 *   - Uses useInterviewGate to debounce transcript submissions.
 *   - Listens to window.electronAPI.onNativeAudioTranscript for live audio.
 *   - Two-brain policy: this component uses SessionState only.
 *     GlobalChatOverlay uses SessionTracker independently.
 *   - Preflight context: reads from localStorage key 'alpha_jd_context'
 *     (set by the job description input in the setup panel).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrchestrator } from '../hooks/useOrchestrator';
import { useInterviewGate } from '../hooks/useInterviewGate';
import HUDResponse from './hud/HUDResponse';
import type { AgentType } from '../hooks/useOrchestrator';

// ── Constants ─────────────────────────────────────────────────────────────────
const JD_STORAGE_KEY = 'alpha_jd_context';

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}
      />
      <span className="text-xs text-zinc-400 font-mono">{label}</span>
    </div>
  );
}

function AgentPill({ agentType }: { agentType: AgentType }) {
  if (!agentType) return null;
  const styles: Record<string, string> = {
    answer: 'bg-green-900/40 text-green-400 border-green-800',
    code:   'bg-cyan-900/40 text-cyan-400 border-cyan-800',
    rescue: 'bg-red-900/40 text-red-400 border-red-800',
  };
  const style = styles[agentType] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700';
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${style}`}>
      {agentType}
    </span>
  );
}

// ── Setup panel (shown before session starts) ─────────────────────────────────

function SetupPanel({
  onStart,
  isLoading,
  error,
}: {
  onStart: (context: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [context, setContext] = useState(() => {
    try { return localStorage.getItem(JD_STORAGE_KEY) ?? ''; } catch { return ''; }
  });

  const handleStart = () => {
    try { localStorage.setItem(JD_STORAGE_KEY, context); } catch {}
    onStart(context);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Job Description / Role Context
        </p>
        <textarea
          className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
          placeholder="Paste the job description or role context here. The preflight agent will generate 12 predicted questions and a phase plan."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-900 rounded px-2 py-1 bg-red-950/30">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={isLoading || !context.trim()}
        className="w-full py-2 rounded bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-sm font-semibold text-white transition-colors"
      >
        {isLoading ? 'Running preflight...' : 'Start Interview Session'}
      </button>

      <p className="text-xs text-zinc-600 text-center">
        Ctrl+Shift+H to toggle this panel
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InterviewHUD() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);

  const {
    hudRaw,
    isStreaming,
    agentType,
    sessionReady,
    activeQuestion,
    error,
    startSession,
    submitUtterance,
    resetSession,
  } = useOrchestrator();

  const { submit: gatedSubmit, isPending } = useInterviewGate({
    onSubmit: submitUtterance,
    isStreaming,
    debounceMs: 400,
    minLength: 3,
  });

  // ── Keyboard shortcut: Ctrl+Shift+H ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setIsVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Live audio transcript listener ────────────────────────────────────────
  // Listens to interviewer speech from the existing STT pipeline.
  useEffect(() => {
    if (!sessionReady) return;

    const api = (window as any).electronAPI;
    if (!api?.onNativeAudioTranscript) return;

    const off = api.onNativeAudioTranscript(
      (transcript: { speaker: string; text: string; final: boolean }) => {
        // Only process final interviewer utterances
        if (transcript.final && transcript.speaker === 'interviewer') {
          gatedSubmit(transcript.text);
        }
      }
    );

    return off;
  }, [sessionReady, gatedSubmit]);

  // ── Start session handler ─────────────────────────────────────────────────
  const handleStart = useCallback(async (context: string) => {
    setIsPreflightLoading(true);
    await startSession(context);
    setIsPreflightLoading(false);
  }, [startSession]);

  // ── Manual utterance input (for testing without live audio) ───────────────
  const [manualInput, setManualInput] = useState('');

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    gatedSubmit(manualInput.trim());
    setManualInput('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isVisible) return null;

  return (
    <div
      className="fixed right-4 top-4 w-80 max-h-[85vh] flex flex-col bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-200 tracking-wider uppercase">
            Interview HUD
          </span>
          {sessionReady && <AgentPill agentType={agentType} />}
        </div>
        <div className="flex items-center gap-3">
          <StatusDot active={sessionReady} label={sessionReady ? 'live' : 'setup'} />
          {sessionReady && (
            <button
              onClick={resetSession}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Reset session"
            >
              ↺
            </button>
          )}
          <button
            onClick={() => setIsVisible(false)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Close (Ctrl+Shift+H)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!sessionReady ? (
          <SetupPanel
            onStart={handleStart}
            isLoading={isPreflightLoading}
            error={error}
          />
        ) : (
          <div className="flex flex-col gap-3 p-3">
            {/* Active question */}
            {activeQuestion && (
              <div className="border-l-2 border-zinc-700 pl-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">
                  Interviewer
                </p>
                <p className="text-sm text-zinc-300 leading-snug">{activeQuestion}</p>
              </div>
            )}

            {/* HUD response */}
            {(hudRaw || isStreaming) && (
              <div className="bg-zinc-900/60 rounded-lg p-3">
                <HUDResponse
                  raw={hudRaw}
                  agent={agentType ?? undefined}
                  urgency={agentType === 'rescue' ? 'rescue' : 'normal'}
                  isStreaming={isStreaming}
                />
              </div>
            )}

            {/* Pending indicator */}
            {isPending && !isStreaming && (
              <div className="flex items-center gap-2 text-zinc-600 text-xs">
                <span className="animate-pulse">●</span>
                <span>processing utterance...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs text-red-400 border border-red-900 rounded px-2 py-1 bg-red-950/30">
                {error}
              </div>
            )}

            {/* Manual input (dev/fallback) */}
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                placeholder="Type interviewer question..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                disabled={isStreaming}
              />
              <button
                onClick={handleManualSubmit}
                disabled={isStreaming || !manualInput.trim()}
                className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-xs text-zinc-200 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
