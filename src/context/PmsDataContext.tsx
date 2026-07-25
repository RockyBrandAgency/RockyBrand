import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { UnauthorizedError } from '../api';
import * as pmsApi from '../pmsApi';
import { useAuth } from './AuthContext';
import type { PmsGuest, PmsBooking } from '../types';

interface PmsDataValue {
  lodgeId: string;
  setLodgeId: (id: string) => void;
  guests: PmsGuest[];
  bookings: PmsBooking[];
  loading: boolean;
  loadError: boolean;
  refetch: () => Promise<void>;
  createGuest: (payload: Record<string, unknown>) => Promise<{ GuestID: string }>;
  createBooking: (payload: Record<string, unknown>) => Promise<{ BookingID: string }>;
}

const PmsDataContext = createContext<PmsDataValue | null>(null);

const LODGE_STORAGE_KEY = 'rockybrandPmsLodge';
const DEFAULT_LODGE = 'alto-castillo';

export function PmsDataProvider({ children }: { children: ReactNode }) {
  const { handleUnauthorized } = useAuth();
  const [lodgeId, setLodgeIdState] = useState(() => localStorage.getItem(LODGE_STORAGE_KEY) || DEFAULT_LODGE);
  const [guests, setGuests] = useState<PmsGuest[]>([]);
  const [bookings, setBookings] = useState<PmsBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const lodgeIdRef = useRef(lodgeId);
  lodgeIdRef.current = lodgeId;

  const setLodgeId = useCallback((id: string) => {
    localStorage.setItem(LODGE_STORAGE_KEY, id);
    setLodgeIdState(id);
  }, []);

  const refetch = useCallback(async () => {
    const requestedLodgeId = lodgeIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [g, b] = await Promise.all([pmsApi.listGuests(requestedLodgeId), pmsApi.listBookings(requestedLodgeId)]);
      // Si el usuario cambio de lodge mientras esta respuesta viajaba, se
      // descarta - mismo criterio de guarda anti-carrera que el resto del
      // panel (ver PanelDataContext / CrmDataContext).
      if (lodgeIdRef.current !== requestedLodgeId) return;
      setGuests(g.guests || []);
      setBookings(b.bookings || []);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
      } else {
        console.error('Error cargando datos del PMS', e);
        if (lodgeIdRef.current === requestedLodgeId) setLoadError(true);
      }
    } finally {
      if (lodgeIdRef.current === requestedLodgeId) setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    refetch();
  }, [refetch, lodgeId]);

  const createGuest = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await pmsApi.createGuest(lodgeIdRef.current, payload);
      await refetch();
      return result;
    },
    [refetch]
  );

  const createBooking = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await pmsApi.createBooking(lodgeIdRef.current, payload);
      await refetch();
      return result;
    },
    [refetch]
  );

  return (
    <PmsDataContext.Provider
      value={{ lodgeId, setLodgeId, guests, bookings, loading, loadError, refetch, createGuest, createBooking }}
    >
      {children}
    </PmsDataContext.Provider>
  );
}

export function usePmsData() {
  const ctx = useContext(PmsDataContext);
  if (!ctx) throw new Error('usePmsData debe usarse dentro de PmsDataProvider');
  return ctx;
}
