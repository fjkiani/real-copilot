/**
 * HUDTerminal — Coding phase renderer
 * Renders: [CLARIFY FIRST] [APPROACH] [THE CODE] [FOLLOW-UP TRAP]
 * Also handles v1 terminal format: [ALGORITHM] [COMPLEXITY] [EDGE CASES] [CODE]
 * Ported from alpha-copilot/components/hud/HUDTerminal.tsx with import path fix.
 */
import { parseSegments, type HUDParsed } from '../../lib/parseHUD';
import RenderSegments from './RenderSegments';

export default function HUDTerminal({ parsed }: { parsed: HUDParsed }) {
  const ext = parsed as HUDParsed & { optimize?: string };

  // v2 code agent format
  if (parsed.clarifyFirst || parsed.approach || parsed.code || parsed.followUpTrap) {
    return (
      <div className="space-y-3">
        {parsed.clarifyFirst && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Clarify First</span>
            <RenderSegments segments={parseSegments(parsed.clarifyFirst)} className="mt-1" />
          </div>
        )}
        {parsed.approach && (
          <div className="animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Approach</span>
            <p className="text-sm text-cyan-200 mt-0.5 leading-snug">{parsed.approach}</p>
          </div>
        )}
        {parsed.code && (
          <div className="animate-fade-in-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">The Code</span>
            <RenderSegments segments={parseSegments(parsed.code)} className="mt-1" />
          </div>
        )}
        {parsed.followUpTrap && (
          <div className="animate-fade-in-up" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Follow-Up Trap</span>
            <p className="text-sm text-orange-200 mt-0.5 leading-snug">{parsed.followUpTrap}</p>
          </div>
        )}
      </div>
    );
  }

  // v1 terminal format
  return (
    <div className="space-y-3">
      {parsed.algorithm && (
        <div className="animate-fade-in-up" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Algorithm</span>
          <p className="text-sm text-cyan-200 mt-0.5 font-medium leading-snug">{parsed.algorithm}</p>
        </div>
      )}
      {parsed.complexity && (
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Complexity</span>
          <p className="text-sm text-zinc-300 mt-0.5 font-mono">{parsed.complexity}</p>
        </div>
      )}
      {parsed.edgeCases && (
        <div className="animate-fade-in-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
          <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Edge Cases</span>
          <RenderSegments segments={parseSegments(parsed.edgeCases)} className="mt-1" />
        </div>
      )}
      {parsed.code && (
        <div className="animate-fade-in-up" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">The Code</span>
          <RenderSegments segments={parseSegments(parsed.code)} className="mt-1" />
        </div>
      )}
      {ext.optimize && (
        <div className="animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Optimize</span>
          <p className="text-sm text-purple-200 mt-0.5">{ext.optimize}</p>
        </div>
      )}
    </div>
  );
}
