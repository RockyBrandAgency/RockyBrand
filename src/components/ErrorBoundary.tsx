import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Red de seguridad para errores de render.
//
// Sin esto, un solo TypeError en cualquier pantalla deja el panel COMPLETAMENTE
// EN BLANCO: React desmonta todo el árbol cuando un render lanza y nadie lo
// atrapa. Se comprobó el 2026-08-03 — bastó que una respuesta llegara sin un
// campo para que no quedara ni el menú, sin ninguna pista de qué pasó.
//
// Es el mismo componente que ya tiene el panel del cliente: los dos paneles
// tienen que fallar igual de bien, no solo verse igual.
interface Props {
  children: ReactNode;
  nombre?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola del navegador, que es donde se mira cuando alguien reporta
    // el problema. No se manda a ningún servicio externo: este panel muestra
    // datos de clientes y el stack puede traer parte de ellos.
    console.error('[panel] error de render', this.props.nombre ?? '', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="main">
        <div className="card" style={{ padding: '22px 24px', maxWidth: 560 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#b42318', marginBottom: 8 }}>
            No se pudo mostrar {this.props.nombre ?? 'esta sección'}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Es un problema de la pantalla, no de los datos: no se perdió ni se envió nada. El resto del panel sigue
            funcionando desde el menú.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
