export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Nexavision home">
      <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-pink via-electric to-orange shadow-lg shadow-electric/35">
        <svg className="relative h-7 w-7 drop-shadow-lg" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M20 3 24.5 15.5 37 20l-12.5 4.5L20 37l-4.5-12.5L3 20l12.5-4.5L20 3Z" fill="white" />
          <circle cx="20" cy="20" r="5" fill="#FF682D" />
        </svg>
      </span>
      {!compact && <span className="font-display text-xl font-black tracking-[0.02em] text-white drop-shadow-md">NEXA<span className="text-softpink">VISION</span></span>}
    </div>
  );
}

