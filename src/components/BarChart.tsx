import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface BarPoint {
  label: string;
  valor: number;
}

// Devuelve el path de un rectangulo con esquinas SUPERIORES redondeadas y
// la base cuadrada (crece desde una sola linea de base) - un <rect> con
// solo un rx no puede hacer esto (redondea las 4 esquinas por igual), asi
// que se dibuja a mano: sube por el borde izquierdo, arco al borde
// superior, cruza, arco de bajada, borde derecho, y cierra por la base.
function roundedTopBarPath(x: number, width: number, yTop: number, yBase: number, radius: number): string {
  const r = Math.min(radius, width / 2, Math.max(yBase - yTop, 0));
  if (r <= 0.01) {
    return `M${x},${yBase} L${x},${yTop} L${x + width},${yTop} L${x + width},${yBase} Z`;
  }
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `L${x + width - r},${yTop}`,
    `Q${x + width},${yTop} ${x + width},${yTop + r}`,
    `L${x + width},${yBase}`,
    'Z',
  ].join(' ');
}

// Grafico de barras SVG sin libreria (mismo criterio que TrendChart.tsx):
// cada barra crece desde la base al aparecer (GSAP), con tooltip real al
// pasar el mouse. Pensado para series discretas por publicacion/entidad en
// vez de series de tiempo continuas (para eso ya esta TrendChart).
export default function BarChart({
  bars,
  color = 'var(--accent-soft)',
  height = 100,
  formatValue = (v: number) => v.toLocaleString('es-CL'),
}: {
  bars: BarPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const barRefs = useRef<(SVGPathElement | null)[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 100;
  const H = height;
  const PAD_Y = 4;
  const RADIUS = 2.2;

  const max = bars.length ? Math.max(...bars.map((b) => b.valor), 1) : 1;
  // El gap es proporcional al ancho de cada slot (no un valor fijo): con
  // pocas barras el slot es grande y un gap fijo se veria como bloques
  // pegados - con el gap como fraccion del slot, siempre queda aire
  // aunque haya solo 2-3 publicaciones reales.
  const slot = bars.length ? W / bars.length : 0;
  const gap = slot * 0.38;
  const barWidth = Math.max(slot - gap, 1);

  useEffect(() => {
    barRefs.current.forEach((el, i) => {
      if (!el) return;
      const b = bars[i];
      const yTop = PAD_Y + ((max - b.valor) / max) * (H - PAD_Y * 2);
      gsap.fromTo(
        el,
        { attr: { d: roundedTopBarPath(i * slot + gap / 2, barWidth, H, H, RADIUS) } },
        { attr: { d: roundedTopBarPath(i * slot + gap / 2, barWidth, yTop, H, RADIUS) }, duration: 0.7, delay: i * 0.03, ease: 'power2.out' }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, max, slot, barWidth]);

  if (!bars.length) {
    return <div className="trend-chart-empty">Sin datos todavía</div>;
  }

  const hoverBar = hoverIdx !== null ? bars[hoverIdx] : null;

  return (
    <div className="trend-chart">
      <div className="trend-chart-yaxis">
        <span>{formatValue(max)}</span>
        <span>0</span>
      </div>
      <div className="trend-chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-chart-svg bar-chart-svg">
          {bars.map((_b, i) => (
            <path
              key={i}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className="bar-chart-bar"
              d={roundedTopBarPath(i * slot + gap / 2, barWidth, H, H, RADIUS)}
              fill={color}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.7}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </svg>
      </div>
      {hoverBar && (
        <div className="trend-chart-tooltip">
          <strong>{formatValue(hoverBar.valor)}</strong>
          <span>{hoverBar.label}</span>
        </div>
      )}
      {bars.length < 4 && (
        <div className="trend-chart-sparse-note">
          Solo {bars.length} publicaci{bars.length === 1 ? 'ón' : 'ones'} real{bars.length === 1 ? '' : 'es'} en el período
        </div>
      )}
    </div>
  );
}
