/**
 * HUDStandard — v2 answer agent renderer
 * Renders: [WHAT THEY'RE TESTING] [SAY THIS FIRST] [THE MECHANISM] [CLOSE WITH]
 * Ported from alpha-copilot/components/hud/HUDStandard.tsx with import path fix.
 */
import { parseSegments, type HUDParsed } from '../../lib/parseHUD';
import RenderSegments from './RenderSegments';

const SECTION_DELAY = ['0ms', '60ms', '120ms', '180ms', '240ms'];

function Section({
  label,
  labelColor,
  children,
  delay,
}: {
  label: string;
  labelColor: string;
  children: React.ReactNode;
  delay: string;
}) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      <span className={`text-xs font-semibold uppercase tracking-wider ${labelColor}`}>{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export default function HUDStandard({ parsed }: { parsed: HUDParsed }) {
  // v2 answer agent sections
  if (parsed.testing || parsed.sayFirst || parsed.mechanism || parsed.closeWith) {
    let sectionIdx = 0;
    return (
      <div className="space-y-3">
        {parsed.testing && (
          <Section label="What They're Testing" labelColor="text-zinc-500" delay={SECTION_DELAY[sectionIdx++]}>
            <p className="text-sm text-zinc-300 leading-snug">{parsed.testing}</p>
          </Section>
        )}
        {parsed.sayFirst && (
          <Section label="Say This First" labelColor="text-green-400" delay={SECTION_DELAY[sectionIdx++]}>
            <p className="text-sm text-green-200 font-semibold leading-snug">{parsed.sayFirst}</p>
          </Section>
        )}
        {parsed.mechanism && (
          <Section label="The Mechanism" labelColor="text-amber-500" delay={SECTION_DELAY[sectionIdx++]}>
            <RenderSegments segments={parseSegments(parsed.mechanism)} className="mt-1" />
          </Section>
        )}
        {parsed.closeWith && (
          <Section label="Close With" labelColor="text-blue-400" delay={SECTION_DELAY[sectionIdx++]}>
            <p className="text-sm text-blue-200 leading-snug">{parsed.closeWith}</p>
          </Section>
        )}
      </div>
    );
  }

  // v1 standard agent sections (motive / delivery / move / bait / diagnostic)
  let sectionIdx = 0;
  return (
    <div className="space-y-3">
      {parsed.motive && (
        <Section label="Motive" labelColor="text-zinc-500" delay={SECTION_DELAY[sectionIdx++]}>
          <p className="text-sm text-zinc-300 leading-snug">{parsed.motive}</p>
        </Section>
      )}
      {parsed.delivery && (
        <Section label="Delivery" labelColor="text-amber-500" delay={SECTION_DELAY[sectionIdx++]}>
          <p className="text-sm text-amber-200 italic leading-snug">{parsed.delivery}</p>
        </Section>
      )}
      {parsed.move && (
        <Section label="The Move" labelColor="text-green-400" delay={SECTION_DELAY[sectionIdx++]}>
          <RenderSegments segments={parseSegments(parsed.move)} className="mt-1" />
        </Section>
      )}
      {parsed.bait && (
        <Section label="The Bait" labelColor="text-blue-400" delay={SECTION_DELAY[sectionIdx++]}>
          <p className="text-sm text-blue-200 leading-snug">{parsed.bait}</p>
        </Section>
      )}
      {parsed.diagnostic && (
        <Section label="Diagnostic" labelColor="text-zinc-600" delay={SECTION_DELAY[sectionIdx++]}>
          <RenderSegments segments={parseSegments(parsed.diagnostic)} className="mt-1 text-zinc-400" />
        </Section>
      )}
    </div>
  );
}
