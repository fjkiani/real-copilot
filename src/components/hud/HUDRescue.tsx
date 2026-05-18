/**
 * HUDRescue — Inline rescue renderer
 * Ported from alpha-copilot/components/hud/HUDRescue.tsx with import path fix.
 */
import type { HUDParsed } from '../../lib/parseHUD';

export default function HUDRescue({ parsed }: { parsed: HUDParsed }) {
  const ext = parsed as HUDParsed & { stall?: string };
  return (
    <div className="space-y-2 border-l-2 border-red-600 pl-3 bg-red-950/20 rounded-r p-3">
      {parsed.rescue && (
        <div>
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">🆘 Said This</span>
          <p className="text-base text-white mt-1 font-bold leading-snug">{parsed.rescue}</p>
        </div>
      )}
      {parsed.fullAnswer && (
        <div>
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Full Answer</span>
          <p className="text-sm text-zinc-200 mt-0.5 leading-snug">{parsed.fullAnswer}</p>
        </div>
      )}
      {parsed.pivot && (
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pivoted To</span>
          <p className="text-sm text-zinc-300 mt-0.5">{parsed.pivot}</p>
        </div>
      )}
      {ext.stall && (
        <div>
          <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Stall Used</span>
          <p className="text-sm text-zinc-400 mt-0.5 italic">{ext.stall}</p>
        </div>
      )}
    </div>
  );
}
