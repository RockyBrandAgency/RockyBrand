import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface BarPoint {
  label: string;
  valor: number;
}

// Grafico de barras SVG sin libreria (mismo criterio que TrendChart.tsx):
// cada barra crece desde 0 al aparecer (GSAP), con tooltip real al pasar el
// mouse. Pensado para series discretas por publicacion/entidad en vez de
// series de tiempo continuas (para eso ya esta TrendChart).
export default function BarChart({
  bars,
  color = 'var(--ok)',
  height = 100,
  formatValue = (v: number) => v.toLocaleString('es-CL'),
}: {
  bars: BarPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const barsRef = useRef<(SVGRectElement | null)[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 100;
  const H = height;
  const PAD_Y = 4;

  const max = bars.length ? Math.max(...bars.map((b) => b.valor), 1) : 1;
  const gap = 1.4;
  const barWidth = bars.length ? W / bars.length - gap : 0;

  useEffect(() => {
    barsRef.current.forEach((el, i) => {
      if (!el) return;
      const b = bars[i];
      const targetH = (b.valor / max) * (H - PAD_Y * 2);
      gsap.fromTo(
        el,
        { attr: { height: 0, y: H } },
        { attr: { height: targetH, y: H - targetH }, duration: 0.7, delay: i * 0.03, ease: 'power2.out' }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, max]);

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
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-chart-svg">
        {bars.map((_b, i) => (
          <rect
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            x={i * (barWidth + gap)}
            y={H}
            width={barWidth}
            height={0}
            fill={color}
            opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
            rx={0.6}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
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
