export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center" aria-label="Nexavision ana sayfa">
      {!compact && <img className="h-16 w-40 object-contain sm:h-20 sm:w-48" src={`${import.meta.env.BASE_URL}nexavision-lyon-2026-logo.png`} alt="Nexavision Song Contest Lyon 2026" />}
    </div>
  );
}

