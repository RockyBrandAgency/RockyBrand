import { useMemo, useState } from 'react';
import { useTiendaData } from '../../context/TiendaDataContext';

function money(clp: number): string {
  return clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

type Campo = 'precio_clp' | 'stock';
type Filtro = 'todos' | 'activos' | 'inactivos' | 'stock_bajo';

export default function TiendaProductos() {
  const { productos, umbralStockBajo, loading, error, actualizarProducto } = useTiendaData();
  const [editando, setEditando] = useState<{ sku: string; campo: Campo } | null>(null);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const stats = useMemo(
    () => ({
      total: productos.length,
      activos: productos.filter((p) => p.activo).length,
      inactivos: productos.filter((p) => !p.activo).length,
      sinStock: productos.filter((p) => p.stock === 0).length,
      stockBajo: productos.filter((p) => p.stock > 0 && p.stock <= umbralStockBajo).length,
    }),
    [productos, umbralStockBajo]
  );

  const visibles = useMemo(() => {
    let lista = productos;
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.familia ?? '').toLowerCase().includes(q)
      );
    }
    if (filtro === 'activos') lista = lista.filter((p) => p.activo);
    if (filtro === 'inactivos') lista = lista.filter((p) => !p.activo);
    if (filtro === 'stock_bajo') lista = lista.filter((p) => p.stock <= umbralStockBajo);
    return lista;
  }, [productos, busqueda, filtro, umbralStockBajo]);

  function empezarEdicion(sku: string, campo: Campo, actual: number) {
    setEditando({ sku, campo });
    setValor(String(actual));
    setSaveError('');
  }

  async function guardar(stockActual: number) {
    if (!editando) return;
    const numero = Math.round(Number(valor.replace(',', '.')));
    if (!Number.isFinite(numero) || numero < 0) {
      setSaveError('Ingresa un número válido.');
      return;
    }
    setGuardando(editando.sku);
    setSaveError('');
    try {
      // Bloqueo optimista solo en stock: si una venta real lo cambio
      // mientras esta pantalla estaba abierta, el backend rechaza (409)
      // en vez de pisarlo en silencio (ver store_admin_lambda.py).
      const cambios: { precio_clp?: number; stock?: number; stock_actual_esperado?: number } = { [editando.campo]: numero };
      if (editando.campo === 'stock') cambios.stock_actual_esperado = stockActual;
      await actualizarProducto(editando.sku, cambios);
      setEditando(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  async function toggleActivo(sku: string, activo: boolean) {
    setGuardando(sku);
    setSaveError('');
    try {
      await actualizarProducto(sku, { activo: !activo });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  if (loading && !productos.length) return <div className="empty-state">Cargando…</div>;
  if (error) return <div className="empty-state">{error}</div>;

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'activos', label: 'Activos' },
    { key: 'inactivos', label: 'Inactivos' },
    { key: 'stock_bajo', label: 'Stock bajo' },
  ];

  return (
    <div>
      <div className="section-sub" style={{ marginBottom: 14 }}>
        Precio y stock se editan acá — reemplaza a <code>store_seed_products.py</code> como forma
        normal de actualizar el catálogo. El sitio de la tienda lee estos valores en vivo (con
        hasta 1 hora de caché).
      </div>

      {productos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Modelos', value: stats.total },
            { label: 'Activos', value: stats.activos },
            { label: 'Inactivos', value: stats.inactivos },
            { label: 'Stock bajo', value: stats.stockBajo },
            { label: 'Sin stock', value: stats.sinStock },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '10px 14px', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
              <div className="cell-sub">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {saveError && (
        <div className="footnote" style={{ color: 'var(--err)', marginBottom: 10 }}>
          {saveError}
        </div>
      )}

      {productos.length > 0 && (
        <div className="crm-toolbar" style={{ marginBottom: 12 }}>
          <input
            className="crm-search"
            placeholder="Buscar por nombre, SKU o familia…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn btn-sm ${filtro === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!productos.length ? (
        <div className="empty-state">Sin productos cargados todavía.</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">Ningún modelo coincide con este filtro.</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>SKU</th>
                <th className="tabular">Precio</th>
                <th className="tabular">Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.sku} style={{ opacity: p.activo ? 1 : 0.55 }}>
                  <td>
                    <div className="cell-name">{p.nombre}</div>
                    {p.familia && <div className="cell-sub">{p.familia}</div>}
                  </td>
                  <td className="cell-sub">{p.sku}</td>
                  <td className="tabular">
                    {editando?.sku === p.sku && editando.campo === 'precio_clp' ? (
                      <span className="costos-inline-edit">
                        <input
                          autoFocus
                          value={valor}
                          inputMode="numeric"
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void guardar(p.stock);
                            if (e.key === 'Escape') setEditando(null);
                          }}
                        />
                        <button className="btn btn-primary btn-sm" disabled={guardando === p.sku} onClick={() => void guardar(p.stock)}>
                          OK
                        </button>
                      </span>
                    ) : (
                      <button className="costos-editable" onClick={() => empezarEdicion(p.sku, 'precio_clp', p.precio_clp)}>
                        {money(p.precio_clp)}
                      </button>
                    )}
                  </td>
                  <td className="tabular">
                    {editando?.sku === p.sku && editando.campo === 'stock' ? (
                      <span className="costos-inline-edit">
                        <input
                          autoFocus
                          value={valor}
                          inputMode="numeric"
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void guardar(p.stock);
                            if (e.key === 'Escape') setEditando(null);
                          }}
                        />
                        <button className="btn btn-primary btn-sm" disabled={guardando === p.sku} onClick={() => void guardar(p.stock)}>
                          OK
                        </button>
                      </span>
                    ) : (
                      <button className="costos-editable" onClick={() => empezarEdicion(p.sku, 'stock', p.stock)}>
                        <span className={p.stock === 0 || p.stock <= umbralStockBajo ? 'costos-mal' : undefined}>{p.stock}</span>
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`pill ${p.activo ? 'confirmed' : 'pending'}`}
                      style={{ cursor: guardando === p.sku ? 'wait' : 'pointer', border: 'none' }}
                      disabled={guardando === p.sku}
                      onClick={() => void toggleActivo(p.sku, p.activo)}
                    >
                      <span className="pill-dot" />
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
