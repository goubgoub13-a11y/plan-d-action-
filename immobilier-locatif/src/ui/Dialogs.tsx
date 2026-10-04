import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './useModalFocus';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (message: string) => void;
}

const Ctx = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialogs doit être utilisé dans <DialogProvider>');
  return c;
}

/** Boîtes de confirmation et messages brefs, sans `window.confirm` (peu lisible sur mobile). */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    setPending(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const panel = useRef<HTMLDivElement>(null);
  useModalFocus(pending !== null, panel, () => close(false));

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setPending(null);
  };

  const toast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToastMsg(message);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      {pending && createPortal(
        <div className="dialog-root" role="presentation">
          <div className="sheet-backdrop" onClick={() => close(false)} />
          <div className="dialog" ref={panel} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={pending.title}>
            <h2>{pending.title}</h2>
            {pending.message && <div className="dialog-msg">{pending.message}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus>
                {pending.cancelLabel ?? 'Annuler'}
              </button>
              <button
                type="button"
                className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
      <div className="toast-zone" aria-live="polite">
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </Ctx.Provider>
  );
}
