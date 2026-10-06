import { useEffect, useRef, type RefObject } from 'react';

const layers: HTMLElement[] = [];
// Une seule source de vérité : deux panneaux peuvent se fermer dans le même commit.
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = '';
function syncLayers() {
  const top = layers[layers.length - 1]?.parentElement;
  if (!top) {
    originalInert.forEach((value, node) => { node.inert = value; });
    originalInert.clear();
    document.body.style.overflow = originalOverflow;
    return;
  }
  for (const node of document.body.children) {
    if (!(node instanceof HTMLElement)) continue;
    if (!originalInert.has(node)) originalInert.set(node, node.inert);
    node.inert = node !== top;
  }
  document.body.style.overflow = 'hidden';
}
const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
/** Pile de panneaux : seul le dernier reçoit Escape/Tab. Les autres surfaces deviennent inertes. */
export function useModalFocus(open: boolean, panel: RefObject<HTMLDivElement>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  const wasOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  // Avant le commit React : les champs autoFocus ne se sont pas encore focalisés.
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement;
  wasOpen.current = open;
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    if (layers.length === 0) originalOverflow = document.body.style.overflow;
    layers.push(el);
    syncLayers();
    const top = () => layers[layers.length - 1] === el;
    const focusable = () => [...el.querySelectorAll<HTMLElement>(selector)].filter(node => node.getClientRects().length > 0 && !node.closest('[inert]'));
    function onKey(e: KeyboardEvent) {
      if (!top()) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close.current(); }
      if (e.key !== 'Tab') return;
      const nodes = focusable();
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { e.preventDefault(); el!.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el || !el!.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el!.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
    function onFocus(e: FocusEvent) {
      if (top() && !el!.contains(e.target as Node)) (focusable()[0] ?? el!).focus();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    if (!el.contains(document.activeElement)) el.focus();
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const index = layers.lastIndexOf(el);
      if (index !== -1) layers.splice(index, 1);
      syncLayers();
      // Ne pas voler le focus à une éventuelle confirmation encore ouverte.
      if (opener.current?.isConnected && !opener.current.closest('[inert]')) opener.current.focus({ preventScroll: true });
    };
  }, [open, panel]);
}
