import { Sparkles } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Nexavision home">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-electric to-cyan shadow-lg shadow-electric/25">
        <span className="absolute inset-[2px] rounded-[14px] bg-ink/60" />
        <Sparkles className="relative h-5 w-5 text-white" />
      </span>
      {!compact && <span className="font-display text-lg font-bold tracking-[-0.03em]">NEXA<span className="text-cyan">VISION</span></span>}
    </div>
  );
}

