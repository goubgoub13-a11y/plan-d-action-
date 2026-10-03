import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { Home } from './screens/Home';
import { Movements } from './screens/Movements';
import { Project } from './screens/Project';
import { Settings } from './screens/Settings';
import { Welcome } from './screens/Welcome';
import type { Go, ProjectSection, Tab } from './screens/nav';
import { Icon, type IconName } from './ui/Icon';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'project', label: 'Projet', icon: 'project' },
  { id: 'movements', label: 'Mouvements', icon: 'list' },
  { id: 'settings', label: 'Réglages', icon: 'settings' },
];

export function App() {
  const { status, property, saveStatus, retrySave, persistent, storageIssues } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [section, setSection] = useState<ProjectSection>('purchase');

  const go: Go = (t, s) => {
    if (s) setSection(s);
    setTab(t);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, section]);

  // Plus aucun bien (premier lancement, tout effacé) : on repartira de l'accueil
  // après création, exemple ou restauration.
  const hasProperty = property !== null;
  useEffect(() => {
    if (!hasProperty) setTab('home');
  }, [hasProperty]);

  if (status === 'loading') {
    return <div className="splash" aria-busy="true" />;
  }

  if (!property) {
    return <Welcome onCreated={() => go('project', 'purchase')} />;
  }

  return (
    <div className="app">
      {saveStatus === 'error' && (
        <div className="top-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>Vos dernières modifications ne sont pas encore enregistrées sur l'appareil. Nouvelle tentative automatique…</span>
          <button className="alert-btn" onClick={() => void retrySave()}>
            Réessayer
          </button>
        </div>
      )}
      {!persistent && (
        <div className="top-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>Stockage local indisponible : vos saisies ne seront pas conservées. Exportez une sauvegarde.</span>
        </div>
      )}
      {storageIssues.length > 0 && tab !== 'settings' && (
        <button className="top-alert info" onClick={() => setTab('settings')}>
          <Icon name="shield" size={18} />
          <span>Des données locales semblent endommagées. Rien n'a été effacé : voir les détails.</span>
          <Icon name="chevron" size={16} />
        </button>
      )}
      <main>
        {tab === 'home' && <Home go={go} />}
        {tab === 'project' && <Project section={section} setSection={setSection} />}
        {tab === 'movements' && <Movements />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
