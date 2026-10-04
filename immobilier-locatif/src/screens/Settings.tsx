import { useEffect, useState } from 'react';
import type { QuarantineEntry } from '../storage/types';
import { daysSince, dateFr, todayIso } from '../lib/format';
import { Section } from '../ui/Display';
import { useStore } from '../state/store';
import { useDialogs } from '../ui/Dialogs';
import { Formula, Info, TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { canShareFiles, ImportButton, useExport } from './BackupActions';
import { EXPLAIN } from './explain';
import { AppearanceSettings } from '../ui/Appearance';

export function Settings() {
  const { data, persistent, setActive, addProperty, deleteProperty, updateProperty, addSample, wipe, storageIssues, getQuarantine, clearQuarantine } =
    useStore();
  const [quarantine, setQuarantine] = useState<QuarantineEntry[]>([]);
  useEffect(() => {
    getQuarantine().then(setQuarantine).catch(() => setQuarantine([]));
  }, [getQuarantine, storageIssues]);
  const { confirm, toast } = useDialogs();
  const { download, share } = useExport();
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  const last = data.settings.lastBackupAt;
  const active = data.settings.activePropertyId;

  return (
    <div className="screen">
      <header className="page-head">
        <p className="eyebrow">Mon bien locatif</p>
        <h1>Réglages</h1>
      </header>

      {(storageIssues.length > 0 || quarantine.length > 0) && (
        <section className="card notice" aria-label="Données locales endommagées">
          <div className="notice-head">
            <Icon name="alert" size={18} />
            <h2>Données locales endommagées</h2>
          </div>
          <p className="small">
            Certaines données enregistrées sur cet appareil n'ont pas pu être lues correctement. Ce qui était lisible a été
            conservé. Rien n'a été effacé : une copie brute des éléments concernés est gardée à part.
          </p>
          {storageIssues.length > 0 && (
            <ul className="error-list">
              {storageIssues.map((i, n) => (
                <li key={n}>{i}</li>
              ))}
            </ul>
          )}
          <div className="stack">
            <button
              className="btn btn-secondary"
              disabled={quarantine.length === 0}
              onClick={() => {
                const blob = new Blob([JSON.stringify({ app: 'immobilier-locatif', kind: 'quarantine', entries: quarantine }, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `immobilier-donnees-endommagees-${todayIso()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
              }}
            >
              <Icon name="download" size={18} /> Télécharger la copie ({quarantine.length})
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Supprimer la copie des données endommagées ?',
                  message: "Faites-le seulement après l'avoir téléchargée ou si vos biens s'affichent correctement.",
                  confirmLabel: 'Supprimer la copie',
                  danger: true,
                });
                if (ok) {
                  await clearQuarantine();
                  setQuarantine([]);
                  toast('Copie supprimée');
                }
              }}
            >
              Masquer cet avertissement
            </button>
          </div>
        </section>
      )}

      <AppearanceSettings />

      <Section title="Sauvegarde" icon="shieldCheck">
        <p className={`backup-status${!last || daysSince(last) > 30 ? ' is-warn' : ''}`}>
          {last ? `Dernière sauvegarde exportée le ${dateFr(last.slice(0, 10))}` : 'Aucune sauvegarde exportée pour le moment'}
        </p>
        <div className="action-list">
          <div className="action-item">
            <span className="action-text">
              <strong>Sauvegarder mes données</strong>
              <span>Un fichier à garder en lieu sûr : il permet de tout retrouver, ici ou sur un autre téléphone.</span>
            </span>
            <button className="btn btn-primary btn-sm" onClick={download} disabled={data.properties.length === 0}>
              <Icon name="download" size={18} /> Exporter
            </button>
          </div>
          {canShareFiles() && (
            <button className="btn btn-quiet" onClick={share} disabled={data.properties.length === 0}>
              Partager le fichier (Fichiers, e-mail…)
            </button>
          )}
          <div className="action-item">
            <span className="action-text">
              <strong>Restaurer une sauvegarde</strong>
              <span>Remplace les données de cet appareil, après confirmation.</span>
            </span>
            <ImportButton className="btn btn-secondary btn-sm" label="Choisir un fichier" />
          </div>
        </div>
        <p className="reassure">
          <Icon name="shield" size={16} /> Vos données restent sur votre appareil. Rien n'est envoyé sur Internet.
        </p>
      </Section>

      <Section title="Mes biens" icon="building">
        <div className="list">
          {data.properties.map((p) => (
            <div key={p.id} className={`prop-row${p.id === active ? ' on' : ''}`}>
              <button className="prop-main" onClick={() => setActive(p.id)} aria-pressed={p.id === active}>
                <span className="radio" aria-hidden="true">
                  {p.id === active && <Icon name="check" size={16} />}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {p.phase === 'owned' ? 'Acquis' : 'En projet'} · {p.movements.length} mouvement{p.movements.length > 1 ? 's' : ''}
                  </span>
                </span>
              </button>
              <button className="icon-btn" aria-label={`Renommer ${p.name}`} onClick={() => setNaming({ id: p.id, name: p.name })}>
                <Icon name="edit" size={19} />
              </button>
              <button
                className="icon-btn"
                aria-label={`Supprimer ${p.name}`}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Supprimer « ${p.name} » ?`,
                    message: 'Le projet et tous ses mouvements seront définitivement effacés de cet appareil.',
                    confirmLabel: 'Supprimer',
                    danger: true,
                  });
                  if (ok) {
                    deleteProperty(p.id);
                    toast('Bien supprimé');
                  }
                }}
              >
                <Icon name="trash" size={19} />
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={() => setNaming({ id: null, name: '' })}>
          <Icon name="plus" size={18} /> Ajouter un bien
        </button>
      </Section>

      <Section title="Confidentialité" icon="shield">
        <ul className="checks">
          <li><Icon name="check" size={18} /> Pas de compte, pas de serveur</li>
          <li><Icon name="check" size={18} /> Aucune donnée envoyée sur Internet</li>
          <li><Icon name="check" size={18} /> Aucun traceur, aucune statistique</li>
          <li><Icon name="check" size={18} /> Fonctionne hors connexion</li>
        </ul>
        {!persistent && (
          <p className="warn-text">
            <Icon name="alert" size={18} /> Le stockage local est indisponible dans ce navigateur (navigation privée ?) :
            vos saisies seront perdues à la fermeture. Exportez une sauvegarde.
          </p>
        )}
      </Section>

      <Section title="Aide" icon="info">
        <Info title="Toutes les formules" label="Voir toutes les formules de calcul">
          {Object.values(EXPLAIN).map((e) => (
            <div key={e.title} className="formula-block">
              <h3>{e.title}</h3>
              {e.body}
            </div>
          ))}
          <div className="formula-block">
            <h3>Mensualité du crédit</h3>
            <Formula>M = C × t ÷ (1 − (1 + t)^−n), avec t = taux annuel ÷ 12 et n = nombre de mensualités</Formula>
            <p>Arrondie au centime. Taux à 0 % : M = C ÷ n.</p>
          </div>
        </Info>
        <button
          className="btn btn-secondary"
          onClick={() => {
            addSample();
            toast("Exemple ajouté : « Appartement Saint-Étienne »");
          }}
        >
          Ajouter le bien d'exemple
        </button>
      </Section>

      <Section title="Zone sensible" icon="trash" className="section-danger">
        <p className="field-hint">Supprime définitivement toutes les données de cet appareil. Exportez une sauvegarde avant.</p>
        <button
          className="btn btn-secondary is-danger"
          onClick={async () => {
            const ok = await confirm({
              title: 'Tout effacer ?',
              message: 'Tous les biens, mouvements et réglages seront définitivement supprimés de cet appareil. Exportez une sauvegarde avant si besoin.',
              confirmLabel: 'Tout effacer',
              danger: true,
            });
            if (ok) {
              await wipe();
              toast('Données effacées');
            }
          }}
        >
          <Icon name="trash" size={18} /> Effacer toutes les données
        </button>
      </Section>

      <p className="version">Mon bien locatif · version {__APP_VERSION__}</p>

      <Sheet
        open={naming !== null}
        title={naming?.id ? 'Renommer le bien' : 'Nouveau bien'}
        onClose={() => setNaming(null)}
        footer={
          <button
            className="btn btn-primary wide"
            disabled={!naming?.name.trim()}
            onClick={() => {
              if (!naming) return;
              if (naming.id) updateProperty(naming.id, (d) => void (d.name = naming.name.trim()));
              else addProperty(naming.name);
              setNaming(null);
            }}
          >
            {naming?.id ? 'Enregistrer' : 'Créer'}
          </button>
        }
      >
        <label className="field">
          <span>Nom du bien</span>
          <TextInput
            label="Nom du bien"
            value={naming?.name ?? ''}
            onChange={(v) => setNaming((n) => (n ? { ...n, name: v } : n))}
            placeholder="Ex. : Studio Lyon 7e"
            autoFocus
          />
        </label>
      </Sheet>
    </div>
  );
}
