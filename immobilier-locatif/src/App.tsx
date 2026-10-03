import { useEffect, useState } from 'react';
import type { Scenario } from './domain/types';
import { useStore } from './state/store';
import { Analysis } from './screens/Analysis';
import { Home } from './screens/Home';
import { Movements } from './screens/Movements';
import { Project } from './screens/Project';
import { Settings } from './screens/Settings';
import { Welcome } from './screens/Welcome';
import type { Go, ProjectSection, Tab } from './screens/nav';
import { Icon, type IconName } from './ui/Icon';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'project', label: 'Projet', icon: 'layers' },
  { id: 'movements', label: 'Mouvements', icon: 'swap' },
  { id: 'analysis', label: 'Analyse', icon: 'chart' },
  { id: 'settings', label: 'Réglages', icon: 'settings' },
];

export function App() {
  const { status, property, saveStatus, retrySave, persistent, storageIssues } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [editing, setEditing] = useState<ProjectSection | null>(null);
  /** Vue Prévu / Réel choisie, partagée entre Accueil et Analyse (null = par défaut). */
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const go: Go = (t, s) => {
    setEditing(t === 'project' && s ? s : null);
    setTab(t);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // Plus aucun bien (premier lancement, tout effacé) : on repartira de l'accueil
  // après création, exemple ou restauration.
  const hasProperty = property !== null;
  useEffect(() => {
    if (!hasProperty) {
      setTab('home');
      setEditing(null);
    }
  }, [hasProperty]);

  if (status === 'loading') {
    return <div className="splash" aria-busy="true" />;
  }

  if (!property) {
    return <Welcome onCreated={() => go('project', 'purchase')} />;
  }

  return (
    <div className="app">
      <div className="alerts">
        {saveStatus === 'error' && (
          <div className="alert alert-error" role="alert">
            <Icon name="alert" size={20} />
            <span className="alert-text">
              <strong>Impossible d'enregistrer vos modifications</strong>
              <span>Vos données sont toujours visibles. Une nouvelle tentative va être effectuée.</span>
            </span>
            <button className="alert-btn" onClick={() => void retrySave()}>
              Réessayer
            </button>
          </div>
        )}
        {!persistent && (
          <div className="alert alert-error" role="alert">
            <Icon name="alert" size={20} />
            <span className="alert-text">
              <strong>Stockage local indisponible</strong>
              <span>Vos saisies ne seront pas conservées (navigation privée ?). Exportez une sauvegarde.</span>
            </span>
          </div>
        )}
        {storageIssues.length > 0 && tab !== 'settings' && (
          <button className="alert alert-info" onClick={() => setTab('settings')}>
            <Icon name="shield" size={20} />
            <span className="alert-text">
              <strong>Des données locales semblent endommagées</strong>
              <span>Rien n'a été effacé. Voir les détails.</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        )}
      </div>
      <main key={tab} className="view">
        {tab === 'home' && <Home go={go} choice={scenario} setChoice={setScenario} />}
        {tab === 'project' && <Project editing={editing} setEditing={setEditing} />}
        {tab === 'movements' && <Movements />}
        {tab === 'analysis' && <Analysis go={go} choice={scenario} setChoice={setScenario} />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
