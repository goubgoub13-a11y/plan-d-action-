import { useRef, useState } from 'react';
import { backupFileName, buildBackup, MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../backup/backup';
import type { AppData } from '../domain/types';
import { dateFr } from '../lib/format';
import { useStore } from '../state/store';
import { useDialogs } from '../ui/Dialogs';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

function backupBlob(data: AppData): { blob: Blob; name: string } {
  const text = serializeBackup(buildBackup(data, __APP_VERSION__));
  return { blob: new Blob([text], { type: 'application/json' }), name: backupFileName() };
}

export function canShareFiles(): boolean {
  try {
    const f = new File(['{}'], 'test.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/** Téléchargement local du fichier : rien ne transite par Internet. */
export function useExport() {
  const { data, markBackupDone } = useStore();
  const { toast } = useDialogs();

  const download = () => {
    const { blob, name } = backupBlob(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    markBackupDone();
    toast(`Sauvegarde créée : ${name}`);
  };

  /** Partage natif (iOS / Android) : permet d'enregistrer le fichier dans « Fichiers », un cloud perso, etc. */
  const share = async () => {
    const { blob, name } = backupBlob(data);
    const file = new File([blob], name, { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: name });
      markBackupDone();
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast('Partage impossible : utilisez « Télécharger ».');
    }
  };

  return { download, share };
}

export function ImportButton({ className = 'btn btn-secondary', label = 'Restaurer une sauvegarde' }: { className?: string; label?: string }) {
  const { data, replaceAll } = useStore();
  const { confirm, toast } = useDialogs();
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setErrors(['Le fichier est trop volumineux pour être une sauvegarde.']);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setErrors(['Impossible de lire ce fichier.']);
      return;
    }
    const res = parseBackup(text);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    const s = res.summary;
    const hasCurrent = data.properties.length > 0;
    const ok = await confirm({
      title: hasCurrent ? 'Remplacer vos données ?' : 'Restaurer cette sauvegarde ?',
      message: (
        <>
          <p>
            Sauvegarde {s.exportedAt ? `du ${dateFr(s.exportedAt.slice(0, 10))}` : 'sans date'} :{' '}
            <b>
              {s.propertyCount} bien{s.propertyCount > 1 ? 's' : ''}
            </b>
            , {s.movementCount} mouvement{s.movementCount > 1 ? 's' : ''}
            {s.propertyNames.length > 0 && <> ({s.propertyNames.join(', ')})</>}.
          </p>
          {hasCurrent && (
            <p>
              Toutes les données actuellement sur cet appareil seront <b>remplacées</b>. Exportez-les d'abord si vous
              voulez les garder.
            </p>
          )}
        </>
      ),
      confirmLabel: hasCurrent ? 'Remplacer' : 'Restaurer',
      danger: hasCurrent,
    });
    if (!ok) return;
    try {
      await replaceAll(res.data);
      toast('Sauvegarde restaurée');
    } catch (e) {
      console.error(e);
      setErrors(["L'enregistrement a échoué. Vos données actuelles n'ont pas été modifiées."]);
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button className={className} onClick={() => input.current?.click()}>
        <Icon name="upload" size={18} /> {label}
      </button>
      <Sheet open={errors !== null} title="Import impossible" onClose={() => setErrors(null)}>
        <div className="prose">
          <p>Le fichier n'a pas été importé, vos données n'ont pas été modifiées.</p>
          <ul className="error-list">
            {errors?.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
