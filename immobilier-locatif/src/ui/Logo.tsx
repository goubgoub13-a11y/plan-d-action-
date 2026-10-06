/** Monogramme : un toit et trois barres montantes. Identique à public/icon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-from)" />
          <stop offset="1" stopColor="var(--hero-to)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#logo-bg)" />
      <path d="M120 262 256 146l136 116" fill="none" stroke="#f3f7f5" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="170" y="300" width="44" height="82" rx="12" fill="#f3f7f5" opacity="0.5" />
      <rect x="234" y="262" width="44" height="120" rx="12" fill="#f3f7f5" opacity="0.78" />
      <rect x="298" y="222" width="44" height="160" rx="12" fill="var(--hero-in)" />
    </svg>
  );
}
