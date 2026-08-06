import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { callAction, UnauthorizedError } from '../api';
import { useAuth } from './AuthContext';
import type { StoreContactMessage, StoreDashboardResumen, StoreOrder, StoreProduct } from '../types';

// Tienda es de UN SOLO cliente (STORE_CLIENT_ID en panel_config_api_lambda.py)
// - a diferencia de PMS/CRM no depende del cliente activo del Sidebar, asi
// que no usa `usePanelData().scopedAction` (ese inyecta el project_id del
// cliente activo, que podria ser otro cliente o ninguno). Cada llamada
// manda el project_id fijo de la tienda.
const STORE_CLIENT_ID = 'chile-fly-fishing';

function storeAction<T = unknown>(action: string, extra?: Record<string, unknown>): Promise<T> {
  return callAction<T>(action, { ...extra, project_id: STORE_CLIENT_ID });
}

interface TiendaDataValue {
  resumen: StoreDashboardResumen | null;
  productos: StoreProduct[];
  umbralStockBajo: number;
  ordenes: StoreOrder[];
  mensajes: StoreContactMessage[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  refetchProductos: () => Promise<void>;
  refetchOrdenes: () => Promise<void>;
  actualizarProducto: (sku: string, cambios: { precio_clp?: number; stock?: number; activo?: boolean; stock_actual_esperado?: number }) => Promise<void>;
  marcarDespachado: (orderId: string, numeroSeguimiento: string) => Promise<void>;
  obtenerDetalleOrden: (orderId: string) => Promise<StoreOrder>;
}

const TiendaDataContext = createContext<TiendaDataValue | null>(null);

export function TiendaDataProvider({ children }: { children: ReactNode }) {
  const { handleUnauthorized } = useAuth();
  const [resumen, setResumen] = useState<StoreDashboardResumen | null>(null);
  const [productos, setProductos] = useState<StoreProduct[]>([]);
  const [umbralStockBajo, setUmbralStockBajo] = useState(2);
  const [ordenes, setOrdenes] = useState<StoreOrder[]>([]);
  const [mensajes, setMensajes] = useState<StoreContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, p, o, m] = await Promise.all([
        storeAction<StoreDashboardResumen>('store_dashboard'),
        storeAction<{ productos: StoreProduct[]; umbral_stock_bajo: number }>('store_list_products'),
        storeAction<{ ordenes: StoreOrder[] }>('store_list_orders'),
        storeAction<{ mensajes: StoreContactMessage[] }>('store_list_contact_messages'),
      ]);
      setResumen(r);
      setProductos(p.productos || []);
      setUmbralStockBajo(p.umbral_stock_bajo ?? 2);
      setOrdenes(o.ordenes || []);
      setMensajes(m.mensajes || []);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      console.error('Error cargando datos de la Tienda', e);
      setError(e instanceof Error ? e.message : 'No se pudo cargar la Tienda.');
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  const refetchProductos = useCallback(async () => {
    try {
      const p = await storeAction<{ productos: StoreProduct[]; umbral_stock_bajo: number }>('store_list_products');
      setProductos(p.productos || []);
      setUmbralStockBajo(p.umbral_stock_bajo ?? 2);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      console.error('Error recargando productos', e);
    }
  }, [handleUnauthorized]);

  const refetchOrdenes = useCallback(async () => {
    try {
      const o = await storeAction<{ ordenes: StoreOrder[] }>('store_list_orders');
      setOrdenes(o.ordenes || []);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      console.error('Error recargando pedidos', e);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const actualizarProducto = useCallback(
    async (sku: string, cambios: { precio_clp?: number; stock?: number; activo?: boolean; stock_actual_esperado?: number }) => {
      await storeAction('store_update_product', { sku, ...cambios });
      await refetchProductos();
    },
    [refetchProductos]
  );

  const marcarDespachado = useCallback(
    async (orderId: string, numeroSeguimiento: string) => {
      await storeAction('store_mark_shipped', { order_id: orderId, numero_seguimiento: numeroSeguimiento });
      await refetchOrdenes();
    },
    [refetchOrdenes]
  );

  const obtenerDetalleOrden = useCallback(async (orderId: string) => {
    const data = await storeAction<{ orden: StoreOrder }>('store_order_detail', { order_id: orderId });
    return data.orden;
  }, []);

  return (
    <TiendaDataContext.Provider
      value={{
        resumen,
        productos,
        umbralStockBajo,
        ordenes,
        mensajes,
        loading,
        error,
        refetch,
        refetchProductos,
        refetchOrdenes,
        actualizarProducto,
        marcarDespachado,
        obtenerDetalleOrden,
      }}
    >
      {children}
    </TiendaDataContext.Provider>
  );
}

export function useTiendaData() {
  const ctx = useContext(TiendaDataContext);
  if (!ctx) throw new Error('useTiendaData debe usarse dentro de TiendaDataProvider');
  return ctx;
}
