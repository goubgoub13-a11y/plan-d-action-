export type Tab = 'home' | 'project' | 'movements' | 'analysis' | 'settings';
/** Rubrique du projet ouverte en édition. */
export type ProjectSection = 'property' | 'purchase' | 'financing' | 'rental' | 'charges';
/** Navigue vers un onglet ; pour « project », ouvre éventuellement l'éditeur d'une rubrique. */
export type Go = (tab: Tab, section?: ProjectSection) => void;
