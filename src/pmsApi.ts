import { getStoredToken, UnauthorizedError } from './api';
import type { PmsGuest, PmsBooking, PmsAddon, PmsItinerary, PmsMonthlyOverview } from './types';

const PMS_API_URL = 'https://laer7rii87.execute-api.us-east-2.amazonaws.com/pms';

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${PMS_API_URL}${path}`, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error de conexión con el PMS');
  return data as T;
}

export function listGuests(lodgeId: string): Promise<{ guests: PmsGuest[] }> {
  return request(`/${lodgeId}/guests`);
}

export function createGuest(lodgeId: string, payload: Record<string, unknown>): Promise<{ GuestID: string }> {
  return request(`/${lodgeId}/guests`, { method: 'POST', body: payload });
}

export function updateGuest(lodgeId: string, guestId: string, patch: Record<string, unknown>): Promise<{ GuestID: string; message: string }> {
  return request(`/${lodgeId}/guests/${guestId}`, { method: 'PATCH', body: patch });
}

export function listBookings(lodgeId: string): Promise<{ bookings: PmsBooking[] }> {
  return request(`/${lodgeId}/bookings`);
}

export function createBooking(lodgeId: string, payload: Record<string, unknown>): Promise<{ BookingID: string }> {
  return request(`/${lodgeId}/bookings`, { method: 'POST', body: payload });
}

export function updateBooking(lodgeId: string, bookingId: string, patch: Record<string, unknown>): Promise<{ BookingID: string; message: string }> {
  return request(`/${lodgeId}/bookings/${bookingId}`, { method: 'PATCH', body: patch });
}

export function listAddons(lodgeId: string, bookingId: string): Promise<{ addons: PmsAddon[] }> {
  return request(`/${lodgeId}/bookings/${bookingId}/addons`);
}

export function createAddon(lodgeId: string, bookingId: string, payload: Record<string, unknown>): Promise<{ AddonID: string }> {
  return request(`/${lodgeId}/bookings/${bookingId}/addons`, { method: 'POST', body: payload });
}

export function getItinerary(lodgeId: string, date: string): Promise<PmsItinerary> {
  return request(`/${lodgeId}/itinerary?date=${encodeURIComponent(date)}`);
}

export function getMonthlyOverview(lodgeId: string, year: number, month: number): Promise<PmsMonthlyOverview> {
  return request(`/${lodgeId}/monthly-overview?year=${year}&month=${month}`);
}
