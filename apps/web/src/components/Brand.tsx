export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center" aria-label="Nexavision ana sayfa">
      {!compact && <span className="font-display text-xl font-black tracking-[0.08em] text-white drop-shadow-md">NEXA<span className="text-softpink">VISION</span></span>}
    </div>
  );
}

