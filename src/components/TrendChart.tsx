import { useEffect, useId, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

interface TrendPoint {
  fecha: string;
  valor: number | null;
}

// Grafico de linea SVG interactivo (sin libreria - mismo criterio ya usado
// en el sparkline de MetricRadarCard, pero generalizado y con interaccion
// real): la linea se "dibuja" al aparecer (stroke-dashoffset animado con
// GSAP), y al mover el mouse aparece una guia vertical + punto + tooltip
// con el valor real mas cercano.
//
// Los nulls se saltan al armar la linea: se conecta cada punto real
// directo con el siguiente punto real, sin importar cuantos nulls haya en
// el medio - una sola linea continua, nunca segmentos flotantes
// desconectados. Los nulls SI cuentan para la posicion en el eje X (para
// no comprimir fechas con hueco real), asi que un hueco se ve como un
// tramo mas inclinado de la misma linea, no como un corte.
//
// Los marcadores (punto final, punto de hover) se dibujan como <div>
// posicionados por porcentaje encima del SVG, no como <circle> dentro del
// viewBox: con preserveAspectRatio="none" el viewBox se estira distinto en
// X que en Y, asi que un <circle> ahi sale ovalado, no redondo. Un <div>
// posicionado por % vive fuera de esa distorsion.
export default function TrendChart({
  points,
  color = 'var(--accent)',
  height = 100,
  formatValue = (v: number) => v.toLocaleString('es-CL'),
  formatDate,
}: {
  points: TrendPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatDate?: (fecha: string) => string;
}) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const hoverDotRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<SVGLineElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 100;
  const H = height;
  const PAD_Y = 8;

  const realCount = points.filter((p) => p.valor !== null).length;

  const { coords, min, max } = useMemo(() => {
    if (!points.length) return { coords: [] as ([number, number] | null)[], min: 0, max: 0 };
    const values = points.map((p) => p.valor).filter((v): v is number => v !== null);
    if (!values.length) return { coords: points.map(() => null), min: 0, max: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = points.length > 1 ? W / (points.length - 1) : 0;
    const coords = points.map((p, i) => {
      if (p.valor === null) return null;
      const x = points.length > 1 ? i * stepX : W / 2;
      const y = H - ((p.valor - min) / span) * (H - PAD_Y * 2) - PAD_Y;
      return [x, y] as [number, number];
    });
    return { coords, min, max };
  }, [points, H]);

  const realCoords = coords.filter((c): c is [number, number] => c !== null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || realCoords.length < 2) return;
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(path, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' });
    if (areaRef.current) {
      gsap.fromTo(areaRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3, ease: 'power1.out' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realCoords.length]);

  useEffect(() => {
    const dot = hoverDotRef.current;
    const guide = guideRef.current;
    if (!dot || !guide) return;
    if (hoverIdx === null || coords[hoverIdx] === null) {
      gsap.to(dot, { opacity: 0, duration: 0.15 });
      gsap.to(guide, { opacity: 0, duration: 0.15 });
      return;
    }
    const [x, y] = coords[hoverIdx] as [number, number];
    gsap.to(dot, { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, opacity: 1, duration: 0.12, ease: 'power2.out' });
    gsap.to(guide, { attr: { x1: x, x2: x }, opacity: 1, duration: 0.12, ease: 'power2.out' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverIdx, coords]);

  if (!realCoords.length) {
    return <div className="trend-chart-empty">Sin datos todavía</div>;
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let closest: number | null = null;
    let closestDist = Infinity;
    coords.forEach((c, i) => {
      if (!c) return;
      const d = Math.abs(c[0] - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIdx(closest);
  };

  // Una sola linea continua a traves de todos los puntos reales, saltando
  // los nulls (nunca varios <polyline> desconectados).
  const areaPoints =
    realCoords.length > 1
      ? `${realCoords[0][0]},${H} ${realCoords.map(([x, y]) => `${x},${y}`).join(' ')} ${realCoords[realCoords.length - 1][0]},${H}`
      : '';

  const lastReal = realCoords[realCoords.length - 1];
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverCoord = hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <div className="trend-chart">
      <div className="trend-chart-yaxis">
        <span>{formatValue(max)}</span>
        <span>{formatValue(min)}</span>
      </div>
      <div className="trend-chart-plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="trend-chart-svg"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {realCoords.length === 1 ? null : (
            <>
              {areaPoints && <polygon ref={areaRef} points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />}
              <polyline
                ref={pathRef}
                points={realCoords.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          <line ref={guideRef} x1={0} x2={0} y1={0} y2={H} stroke="var(--line)" strokeWidth={1} opacity={0} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Punto final - marca el valor mas reciente, siempre visible (no solo en hover) */}
        <div className="trend-chart-enddot" style={{ left: `${(lastReal[0] / W) * 100}%`, top: `${(lastReal[1] / H) * 100}%`, background: color }} />
        <div ref={hoverDotRef} className="trend-chart-hoverdot" style={{ background: color, opacity: 0 }} />
      </div>
      <div className="trend-chart-axis">
        <span>{formatDate ? formatDate(points[0].fecha) : points[0].fecha}</span>
        <span>{formatDate ? formatDate(points[points.length - 1].fecha) : points[points.length - 1].fecha}</span>
      </div>
      {hoverPoint && hoverCoord && hoverPoint.valor !== null && (
        <div className="trend-chart-tooltip">
          <strong>{formatValue(hoverPoint.valor)}</strong>
          <span>{formatDate ? formatDate(hoverPoint.fecha) : hoverPoint.fecha}</span>
        </div>
      )}
      {realCount < 4 && (
        <div className="trend-chart-sparse-note">
          Solo {realCount} punto{realCount === 1 ? '' : 's'} real{realCount === 1 ? '' : 'es'} — se completa con el tiempo
        </div>
      )}
    </div>
  );
}
