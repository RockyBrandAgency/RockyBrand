import { useMemo, useState, type SVGProps } from 'react';
import qrcode from 'qrcode-generator';

// Piezas compartidas por el login con desafío y por la inscripción del
// código de verificación desde el panel.

/**
 * QR dibujado en el navegador, sin red: la clave TOTP nunca sale a un
 * servicio de QR externo. qrcode-generator 2.0.4 (MIT, sin dependencias, la
 * misma versión exacta del 06) solo calcula la matriz; acá se arma un <svg>
 * con un único <path>, sin innerHTML.
 */
export function CodigoQr({ valor, tamano = 176, etiqueta }: { valor: string; tamano?: number; etiqueta: string }) {
  const { d, lado } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(valor);
    qr.make();
    const n = qr.getModuleCount();
    const margen = 4; // zona de silencio de 4 módulos (ISO/IEC 18004)
    let camino = '';
    for (let fila = 0; fila < n; fila++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(fila, col)) camino += `M${col + margen} ${fila + margen}h1v1h-1z`;
      }
    }
    return { d: camino, lado: n + margen * 2 };
  }, [valor]);

  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="mfa-qr"
      style={{ maxWidth: tamano }}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Campo del código de 6 dígitos: teclado numérico y autocompletado del SMS/app. */
export function CampoCodigo({
  id,
  valor,
  onChange,
  autoFocus,
  invalido,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  invalido?: boolean;
}) {
  return (
    <input
      id={id}
      className="login-input mfa-codigo"
      inputMode="numeric"
      name="code"
      autoComplete="one-time-code"
      spellCheck={false}
      pattern="[0-9]{6}"
      autoFocus={autoFocus}
      aria-invalid={invalido || undefined}
      value={valor}
      // Sin maxLength: al pegar «123 456» o «123-456» el navegador cortaría a
      // 6 caracteres antes de limpiar y quedarían 5 dígitos. Se limpia primero
      // y se recorta después.
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  );
}

/** La clave TOTP en texto, para quien no puede escanear, con «Copiar clave». */
export function ClaveConCopia({ clave }: { clave: string }) {
  const [copiada, setCopiada] = useState(false);
  const [fallo, setFallo] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setFallo(false);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      setFallo(true);
    }
  }
  // Grupos de 4 para poder dictarla o escribirla a mano sin perderse.
  const legible = clave.replace(/(.{4})/g, '$1 ').trim();
  return (
    <div className="mfa-clave">
      <code className="mfa-clave-texto">{legible}</code>
      <button type="button" className="btn btn-ghost btn-sm" onClick={copiar}>
        {copiada ? <IconoCheck /> : <IconoCopiar />}
        {copiada ? 'Copiada' : 'Copiar clave'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copiada ? 'Clave copiada' : ''}
      </span>
      {fallo && <div className="field-hint">No se pudo copiar: selecciónala y cópiala a mano.</div>}
    </div>
  );
}

// ===== Íconos Lucide (ISC), trazos copiados de lucide-react 1.59.0 =====
// Inline, como el resto de los íconos del panel: no se suma la librería
// completa por cinco íconos.

function Icono({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

const ESCUDO =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

export function IconoEscudoCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d={ESCUDO} />
      <path d="m9 12 2 2 4-4" />
    </Icono>
  );
}

export function IconoEscudoAlerta(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d={ESCUDO} />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icono>
  );
}

export function IconoCopiar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icono>
  );
}

export function IconoVolver(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icono>
  );
}

export function IconoCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icono>
  );
}
