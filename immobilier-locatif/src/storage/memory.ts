import type { AppData, Property, Settings } from '../domain/types';
import { emptySettings } from '../domain/factory';
import type { DataStorage } from './types';

/**
 * Stockage en mémoire : utilisé dans les tests et en dernier recours si
 * IndexedDB est indisponible (ex. navigation privée de certains navigateurs).
 * Dans ce dernier cas l'interface avertit que les données ne seront pas conservées.
 */
export class MemoryStorage implements DataStorage {
  private props = new Map<string, Property>();
  private settings: Settings = emptySettings();

  async loadAll(): Promise<AppData> {
    return {
      properties: [...this.props.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      settings: this.settings,
    };
  }
  async putProperty(p: Property): Promise<void> {
    this.props.set(p.id, structuredClone(p));
  }
  async deleteProperty(id: string): Promise<void> {
    this.props.delete(id);
  }
  async putSettings(s: Settings): Promise<void> {
    this.settings = structuredClone(s);
  }
  async replaceAll(data: AppData): Promise<void> {
    this.props = new Map(data.properties.map((p) => [p.id, structuredClone(p)]));
    this.settings = structuredClone(data.settings);
  }
}
