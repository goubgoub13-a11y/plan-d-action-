/**
 * Évolution mois par mois (v1.2.0). SVG et CSS, sans bibliothèque.
 * Deux vues : résultat de chaque mois (barres autour de zéro) et résultat cumulé (courbe).
 * Toucher un mois affiche son détail. Présentation uniquement.
 */
import { useEffect, useRef, useState } from 'react';
import { eur, eurSigned, monthFr } from '../lib/format';
import type { MonthPoint } from '../lib/series';
import { Amount } from './Display';
import { Segmented } from './Fields';

const SHORT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const COL = 34; // largeur d'un mois (px) quand le graphique défile
const H = 132; // hauteur de la zone de tracé (px)

function tick(month: string, i: number, all: MonthPoint[]): string {
  const [y, m] = month.split('-').map(Number);
  const showYear = i === 0 || m === 1 || all.length <= 4;
  return `${SHORT[m - 1]}${showYear ? ` ${String(y).slice(2)}` : ''}`;
}

export function MonthlyChart({ series }: { series: MonthPoint[] }) {
  const [mode, setMode] = useState<'month' | 'cumul'>('month');
  const [sel, setSel] = useState(series.length - 1);
  const scroller = useRef<HTMLDivElement>(null);
  const s = Math.min(sel, series.length - 1);
  const cur = series[s];

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [series.length, mode]);

  const values = series.map((p) => (mode === 'month' ? p.net : p.cumulative));
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const range = maxPos + maxNeg || 1;
  const zeroY = (maxPos / range) * H; // position de la ligne zéro depuis le haut
  const y = (v: number) => zeroY - (v / range) * H;
  const width = Math.max(series.length * COL, 1);
  const fill = series.length <= 9; // peu de mois : le graphique occupe toute la largeur

  return (
    <div className="mchart">
      <div className="mchart-head">
        <span className="mini-label">Évolution mois par mois</span>
        <Segmented
          small
          label="Vue du graphique"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Par mois' },
            { value: 'cumul', label: 'Cumulé' },
          ]}
        />
      </div>

      <div className={`mchart-scroll${fill ? ' is-fill' : ''}`} ref={scroller}>
        <div className="mchart-plot" style={{ width: fill ? '100%' : width, height: H + 26 }}>
          <span className="mchart-zero" style={{ top: zeroY }} aria-hidden="true" />
          {mode === 'cumul' && (
            <svg className="mchart-svg" viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="mchart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--data-a)" stopOpacity="0.28" />
                  <stop offset="1" stopColor="var(--data-a)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M ${COL / 2} ${zeroY} ${series.map((p, i) => `L ${i * COL + COL / 2} ${y(p.cumulative)}`).join(' ')} L ${(series.length - 1) * COL + COL / 2} ${zeroY} Z`}
                fill="url(#mchart-area)"
              />
              <polyline
                points={series.map((p, i) => `${i * COL + COL / 2},${y(p.cumulative)}`).join(' ')}
                fill="none"
                stroke="var(--data-a)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          )}
          <div className="mchart-cols">
            {series.map((p, i) => {
              const v = mode === 'month' ? p.net : p.cumulative;
              const h = Math.max((Math.abs(v) / range) * H, v === 0 ? 0 : 2);
              return (
                <button
                  key={p.month}
                  type="button"
                  className={`mchart-col${i === s ? ' is-sel' : ''}`}
                  onClick={() => setSel(i)}
                  aria-label={`${monthFr(p.month)} : résultat ${eurSigned(p.net)}, cumulé ${eurSigned(p.cumulative)}`}
                  aria-pressed={i === s}
                >
                  {mode === 'month' ? (
                    <span
                      className={`mchart-bar ${v >= 0 ? 'is-pos' : 'is-neg'}${p.empty ? ' is-empty' : ''}`}
                      style={v >= 0 ? { bottom: H - zeroY + 26, height: h } : { top: zeroY, height: h }}
                    />
                  ) : (
                    <span className="mchart-dot" style={{ top: y(v) - 5 }} />
                  )}
                  <span className="mchart-tick">{tick(p.month, i, series)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {cur && (
        <div className="mchart-detail" aria-live="polite">
          <div className="mchart-detail-head">
            <span className="mchart-month">{monthFr(cur.month)}</span>
            <Amount value={mode === 'month' ? cur.net : cur.cumulative} size="lg" signed tone={(mode === 'month' ? cur.net : cur.cumulative) >= 0 ? 'pos' : undefined} />
          </div>
          <div className="mchart-detail-grid">
            <span>
              Recettes <b>{eur(cur.income)}</b>
            </span>
            <span>
              Dépenses <b>{eur(cur.expenses)}</b>
            </span>
            <span>
              {mode === 'month' ? 'Cumulé' : 'Ce mois-ci'} <b>{eurSigned(mode === 'month' ? cur.cumulative : cur.net)}</b>
            </span>
            {cur.injected > 0 && (
              <span>
                Injecté <b>{eur(cur.injected)}</b>
              </span>
            )}
          </div>
          {cur.empty && <p className="mchart-empty">Aucun mouvement enregistré ce mois-ci.</p>}
        </div>
      )}
    </div>
  );
}

/** Mini-courbe du résultat cumulé, pour une carte. */
export function Sparkline({ series, label }: { series: MonthPoint[]; label: string }) {
  if (series.length < 2) return null;
  const vals = series.map((p) => p.cumulative);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const r = max - min || 1;
  const w = 100;
  const h = 32;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / r) * h}`);
  const zero = h - ((0 - min) / r) * h;
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={w} y1={zero} y2={zero} className="sparkline-zero" vectorEffect="non-scaling-stroke" />
      <polyline points={pts.join(' ')} className="sparkline-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
