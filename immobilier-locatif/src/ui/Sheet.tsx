import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Panneau qui monte du bas de l'écran (formulaires, détails d'un indicateur). */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Référence stable : l'effet ci-dessous ne doit s'exécuter qu'à l'ouverture / fermeture,
  // pas à chaque rendu du parent (sinon le focus quitterait le champ en cours de saisie).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = panel.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    // Un champ du panneau a déjà pris le focus (autoFocus) : on le lui laisse.
    if (el && !el.contains(prevFocus)) el.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Rend le focus à l'élément qui a ouvert le panneau (accessibilité clavier).
      if (prevFocus && prevFocus.isConnected && !el?.contains(prevFocus)) prevFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="sheet-root" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
