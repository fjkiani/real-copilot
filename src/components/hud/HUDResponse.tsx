/**
 * HUDResponse — Master router for all HUD phases (inline-only renderer)
 *
 * Ported from alpha-copilot/components/hud/HUDResponse.tsx.
 * Import paths updated for real-copilot src/ structure.
 *
 * RESCUE NOTE: Rescue renders inline via HUDRescue.
 * No fixed/portal overlay — InterviewHUD handles layout.
 */
import { parseHUDSections, parseSegments } from '../../lib/parseHUD';
import RenderSegments from './RenderSegments';
import HUDStandard from './HUDStandard';
import HUDOverride from './HUDOverride';
import HUDTerminal from './HUDTerminal';
import HUDRescue from './HUDRescue';
import HUDSupport from './HUDSupport';

interface HUDResponseProps {
  raw: string;
  agent?: string;
  urgency?: 'normal' | 'rescue' | 'override';
  isStreaming?: boolean;
}

// Agent badge
const AGENT_COLORS: Record<string, string> = {
  answer:   'text-green-400 border-green-800',
  code:     'text-cyan-400 border-cyan-800',
  rescue:   'text-red-400 border-red-800',
  pivot:    'text-orange-400 border-orange-800',
};

function AgentBadge({ agent }: { agent: string }) {
  const color = AGENT_COLORS[agent] ?? 'text-zinc-400 border-zinc-700';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${color}`}>
      {agent}
    </span>
  );
}

export default function HUDResponse({
  raw,
  agent,
  urgency = 'normal',
  isStreaming = false,
}: HUDResponseProps) {
  const parsed = parseHUDSections(raw);
  if (!parsed) return null;

  // Thinking / waiting states
  if (parsed.phase === 'thinking' || parsed.phase === 'waiting') {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-xs py-1">
        <span className="flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span>{parsed.phase === 'thinking' ? 'reasoning...' : 'generating...'}</span>
        {isStreaming && <span className="ml-auto text-zinc-700 animate-pulse">●</span>}
      </div>
    );
  }

  const isOverride = parsed.phase === 'override' || urgency === 'override';

  // ── Content router ────────────────────────────────────────────────────────
  const content = (() => {
    if (parsed.phase === 'rescue' || urgency === 'rescue') return <HUDRescue parsed={parsed} />;
    if (parsed.phase === 'override') return <HUDOverride parsed={parsed} />;
    if (parsed.phase === 'terminal' || parsed.phase === 'code') return <HUDTerminal parsed={parsed} />;
    if (parsed.phase === 'support') return <HUDSupport parsed={parsed} />;
    if (parsed.phase === 'plain') return <RenderSegments segments={parseSegments(parsed.text ?? '')} />;
    return <HUDStandard parsed={parsed} />;
  })();

  return (
    <div className={`space-y-2 ${isOverride ? 'animate-pulse' : ''}`}>
      {/* Header row: agent badge + streaming indicator */}
      {(agent || isStreaming) && (
        <div className="flex items-center gap-2">
          {agent && <AgentBadge agent={agent} />}
          {isStreaming && (
            <span className="ml-auto text-xs text-green-500 animate-pulse font-mono">streaming</span>
          )}
        </div>
      )}

      {/* Main HUD content */}
      <div className={isOverride ? 'border border-red-800 rounded-lg p-3 bg-red-950/10' : ''}>
        {content}
      </div>
    </div>
  );
}
