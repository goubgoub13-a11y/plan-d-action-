import { useState } from 'react';
import { daysSince, dateFr } from '../lib/format';
import { useStore } from '../state/store';
import { useDialogs } from '../ui/Dialogs';
import { Formula, Info, TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { canShareFiles, ImportButton, useExport } from './BackupActions';
import { EXPLAIN } from './explain';

export function Settings() {
  const { data, persistent, setActive, addProperty, deleteProperty, updateProperty, addSample, wipe } = useStore();
  const { confirm, toast } = useDialogs();
  const { download, share } = useExport();
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  const last = data.settings.lastBackupAt;
  const active = data.settings.activePropertyId;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Réglages</h1>
      </header>

      <section className="card">
        <h2 className="card-h">Mes biens</h2>
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
        <button className="btn btn-ghost" onClick={() => setNaming({ id: null, name: '' })}>
          <Icon name="plus" size={18} /> Ajouter un bien
        </button>
      </section>

      <section className="card">
        <h2 className="card-h">Sauvegarde</h2>
        <p className="muted small">
          Vos données ne sont stockées que sur cet appareil. Exportez régulièrement un fichier de sauvegarde et gardez-le
          en lieu sûr : il permet de tout restaurer, ici ou sur un autre téléphone.
        </p>
        <p className={`backup-state${!last || daysSince(last) > 30 ? ' warn' : ''}`}>
          <Icon name="shield" size={18} />
          {last ? `Dernière sauvegarde : ${dateFr(last.slice(0, 10))}` : 'Aucune sauvegarde exportée pour le moment'}
        </p>
        <div className="stack">
          <button className="btn btn-primary" onClick={download} disabled={data.properties.length === 0}>
            <Icon name="download" size={18} /> Exporter une sauvegarde
          </button>
          {canShareFiles() && (
            <button className="btn btn-ghost" onClick={share} disabled={data.properties.length === 0}>
              Partager le fichier…
            </button>
          )}
          <ImportButton />
        </div>
      </section>

      <section className="card">
        <h2 className="card-h">Confidentialité</h2>
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
      </section>

      <section className="card">
        <h2 className="card-h">Aide</h2>
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
          className="btn btn-ghost"
          onClick={() => {
            addSample();
            toast("Exemple ajouté : « Appartement Saint-Étienne »");
          }}
        >
          Ajouter le bien d'exemple
        </button>
      </section>

      <section className="card">
        <h2 className="card-h">Données</h2>
        <button
          className="btn btn-ghost danger"
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
      </section>

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
