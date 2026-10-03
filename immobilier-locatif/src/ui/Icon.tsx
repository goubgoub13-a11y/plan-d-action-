/**
 * Jeu d'icônes unique : trait fin (1,7), extrémités arrondies, grille 24 px.
 * SVG inline, aucune police ni bibliothèque externe.
 */
const PATHS = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z',
  layers: 'M12 3.5 3 8.25l9 4.75 9-4.75zM3 12.25 12 17l9-4.75M3 16.25 12 21l9-4.75',
  swap: 'M7.5 20V5M4 8.5 7.5 5 11 8.5M16.5 4v15M13 15.5l3.5 3.5 3.5-3.5',
  chart: 'M4 20h16M7 16.5V12M12 16.5V7M17 16.5V10',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4.5M12 8h.01',
  chevron: 'm9.5 6 6 6-6 6',
  down: 'm6 9.5 6 6 6-6',
  back: 'm14.5 6-6 6 6 6',
  trash: 'M4 7h16M9.5 7V4.5h5V7M18 7l-.8 12.5a1 1 0 0 1-1 .9H7.8a1 1 0 0 1-1-.9L6 7M10 11v5.5M14 11v5.5',
  copy: 'M9 9h10v10H9zM15 9V5H5v10h4',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 20V9M7.5 13.5 12 9l4.5 4.5M5 4.5h14',
  wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5zM16.5 14h.01',
  key: 'M14.5 4a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM10.6 13.4 4 20M7 17l2 2M5.5 18.5l1.5 1.5',
  bank: 'M3.5 9.5 12 4.5l8.5 5M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20.5h17',
  receipt: 'M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5zM9 8.5h6M9 12.5h6',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  tag: 'M3.5 12V3.5H12l8.5 8.5-8.5 8.5zM8 8h.01',
  check: 'M5 12.5 10 17l9-10',
  shield: 'M12 3.5 5 6.2V11c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6.2z',
  shieldCheck: 'M12 3.5 5 6.2V11c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6.2zM9 12l2.2 2.2L15.5 10',
  edit: 'M4 20h4.5L19.5 9l-4.5-4.5L4 15.5zM13.5 6l4.5 4.5',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2h.01',
  calendar: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4',
  building: 'M5 20.5V6l7-2.5L19 6v14.5M9.5 20.5V16h5v4.5M9 9h.01M12 9h.01M15 9h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01',
  percent: 'M18.5 5.5l-13 13M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sofa: 'M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3.5 17.5v-5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0v5zM6 17.5v2M18 17.5v2',
  drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z',
  arrowIn: 'M12 4.5v13M6.5 12 12 17.5 17.5 12',
  arrowOut: 'M12 19.5v-13M6.5 12 12 6.5l5.5 5.5',
  sparkles: 'M12 4v4M12 16v4M4 12h4M16 12h4',
  coins: 'M9 10a5 2.2 0 1 0 0-.01zM4 10v4c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-4M10 6.3c.9-.9 2.8-1.5 5-1.5 2.8 0 5 1 5 2.2v8c0 1-1.6 1.9-3.8 2.1',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Icône associée à une catégorie de mouvement (purement visuel). */
export function categoryIcon(categoryId: string, group: string): IconName {
  const byId: Record<string, IconName> = {
    price: 'building',
    notary: 'receipt',
    agency: 'receipt',
    loanFees: 'bank',
    guarantee: 'shield',
    broker: 'bank',
    works: 'tool',
    furniture: 'sofa',
    otherFees: 'receipt',
    propertyTax: 'receipt',
    pno: 'shield',
    coproNonRecoverable: 'building',
    maintenance: 'tool',
    repairs: 'tool',
    management: 'key',
    bankFees: 'bank',
    accounting: 'receipt',
    otherTaxes: 'receipt',
    otherExpenses: 'tag',
    loanPayment: 'bank',
    loanInsurance: 'shield',
    recoverableChargesPaid: 'drop',
    rent: 'key',
    recoveredCharges: 'drop',
    otherIncome: 'coins',
  };
  return byId[categoryId] ?? (group === 'income' ? 'coins' : 'tag');
}
