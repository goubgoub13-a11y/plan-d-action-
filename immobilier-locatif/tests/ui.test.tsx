import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILTIN_CATEGORIES } from '../src/domain/categories';
import { Amount, EmptyState, Line, Percent, StackBar } from '../src/ui/Display';
import { categoryIcon } from '../src/ui/Icon';

const html = (el: JSX.Element) => renderToStaticMarkup(el).replace(/[  ]/g, ' ');

describe('composants d’affichage (v1.1.0)', () => {
  it('Amount sépare nombre et devise, et garde un libellé accessible complet', () => {
    const out = html(<Amount value={82} signed size="display" label="Cash-flow" />);
    expect(out).toContain('class="fig fig-display"');
    expect(out).toContain('aria-label="Cash-flow : +82 €"');
    expect(out).toContain('<span class="fig-unit" aria-hidden="true">€</span>');
  });

  it('Amount négatif : signe typographique « − », jamais « - »', () => {
    const out = html(<Amount value={-153.48} signed />);
    expect(out).toContain('−');
    expect(out).not.toMatch(/>-\d/);
    expect(out).toContain('153');
  });

  it('Percent affiche « — » quand la valeur n’est pas calculable', () => {
    expect(html(<Percent value={null} />)).toContain('—');
    expect(html(<Percent value={7.14} />)).toContain('7,1');
  });

  it('StackBar : segments proportionnels, valeurs nulles omises', () => {
    const out = html(
      <StackBar
        label="Coût"
        parts={[
          { label: 'Prix', value: 75, tone: 'a' },
          { label: 'Frais', value: 25, tone: 'b' },
          { label: 'Rien', value: 0, tone: 'c' },
        ]}
      />,
    );
    expect(out).toContain('width:75%');
    expect(out).toContain('width:25%');
    expect(out).not.toContain('seg-c');
    expect(out).toContain('role="img" aria-label="Coût"');
  });

  it('Line affiche l’aide sous le libellé et la précision sous la valeur', () => {
    const out = html(<Line label="Injecté" hint="estimation" value="5 040 €" secondary="prévu 4 850 €" />);
    expect(out).toContain('<span class="line-hint">estimation</span>');
    expect(out).toContain('<span class="line-secondary">prévu 4 850 €</span>');
  });

  it('EmptyState : titre, texte et action', () => {
    const out = html(<EmptyState icon="swap" title="Aucun mouvement pour le moment" action={<button>Ajouter</button>}>Texte</EmptyState>);
    expect(out).toContain('<h2>Aucun mouvement pour le moment</h2>');
    expect(out).toContain('<button>Ajouter</button>');
  });

  it('chaque catégorie prédéfinie a une icône', () => {
    for (const c of BUILTIN_CATEGORIES) expect(categoryIcon(c.id, c.group), c.id).toBeTruthy();
    expect(categoryIcon('inconnue', 'income')).toBe('coins');
    expect(categoryIcon('inconnue', 'custom')).toBe('tag');
  });
});
