export type Tab = 'home' | 'project' | 'movements' | 'settings';
export type ProjectSection = 'purchase' | 'financing' | 'rental' | 'charges';
export type Go = (tab: Tab, section?: ProjectSection) => void;
