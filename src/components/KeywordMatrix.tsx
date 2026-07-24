import type { KeywordMatrixRow } from '../types';

// Badge de posicion coloreado: verde si esta en Top 3 real, ambar si Top 10,
// gris si mas abajo - mismo criterio de "nunca binario falso" que el resto
// del panel, el color refleja el numero real, no un estado inventado.
function positionTone(pos: number | null): 'ok' | 'warn' | 'off' {
  if (pos === null) return 'off';
  if (pos <= 3) return 'ok';
  if (pos <= 10) return 'warn';
  return 'off';
}

// Landing page real viene completa (protocolo+dominio+path) desde Search
// Console - se muestra solo el path para que quepa en la tabla, con la URL
// completa como title/href.
function landingPagePath(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path === '/' ? '/ (home)' : path;
  } catch {
    return url;
  }
}

export default function KeywordMatrix({ rows }: { rows: KeywordMatrixRow[] }) {
  if (!rows.length) {
    return <div className="empty-state">Sin keywords trackeadas todavía.</div>;
  }
  return (
    <div className="keyword-matrix">
      <div className="keyword-matrix-head">
        <span>Keyword</span>
        <span>Pos.</span>
        <span>Ant.</span>
        <span>Δ</span>
        <span>Landing page</span>
        <span>Período</span>
      </div>
      {rows.map((row) => {
        const tone = positionTone(row.posicion_actual);
        return (
          <div className="keyword-matrix-row" key={row.keyword}>
            <span className="keyword-matrix-kw">{row.keyword}</span>
            <span className={`keyword-matrix-badge keyword-matrix-badge-${tone}`}>
              {row.posicion_actual !== null ? `#${row.posicion_actual}` : '—'}
            </span>
            <span className="keyword-matrix-ant">{row.posicion_anterior !== null ? `#${row.posicion_anterior}` : '—'}</span>
            <span
              className={
                row.delta === null
                  ? 'keyword-matrix-delta keyword-matrix-delta-neutral'
                  : row.delta > 0
                    ? 'keyword-matrix-delta keyword-matrix-delta-up'
                    : row.delta < 0
                      ? 'keyword-matrix-delta keyword-matrix-delta-down'
                      : 'keyword-matrix-delta keyword-matrix-delta-neutral'
            }
            >
              {row.delta === null ? '—' : row.delta > 0 ? `↗ +${row.delta}` : row.delta < 0 ? `↘ ${row.delta}` : '—'}
            </span>
            <span className="keyword-matrix-landing">
              {row.landing_page ? (
                <a href={row.landing_page} target="_blank" rel="noreferrer" title={row.landing_page}>
                  {landingPagePath(row.landing_page)}
                </a>
              ) : (
                '—'
              )}
            </span>
            <span className="keyword-matrix-fecha">{row.periodo ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}
