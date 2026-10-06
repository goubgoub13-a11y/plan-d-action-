import { useState } from 'react';
import { useStore } from '../state/store';
import { TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { ImportButton } from './BackupActions';

export function Welcome({ onCreated }: { onCreated: () => void }) {
  const { addProperty, addSample } = useStore();
  const [name, setName] = useState('');
  return (
    <div className="welcome">
      <div className="welcome-logo">
        <Logo />
      </div>
      <h1>Mon bien locatif</h1>
      <p className="lead">
        Ce que votre appartement vous coûte, ce qu'il vous rapporte, et s'il est vraiment rentable. Du projet jusqu'au
        suivi de ce que vous payez et encaissez.
      </p>
      <form
        className="card welcome-form"
        onSubmit={(e) => {
          e.preventDefault();
          addProperty(name);
          onCreated();
        }}
      >
        <label className="field">
          <span>Nom de votre projet</span>
          <TextInput label="Nom de votre projet" value={name} onChange={setName} placeholder="Ex. : Appartement Saint-Étienne" />
        </label>
        <button className="btn btn-primary wide" type="submit">
          Commencer
        </button>
      </form>
      <div className="stack">
        <button className="btn btn-secondary" onClick={addSample}>
          Découvrir avec un exemple
        </button>
        <ImportButton />
      </div>
      <p className="welcome-foot">
        <Icon name="shield" size={15} /> Sans compte. Vos données restent sur cet appareil.
      </p>
    </div>
  );
}
