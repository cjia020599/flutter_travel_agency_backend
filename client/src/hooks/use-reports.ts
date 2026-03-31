import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/auth'; // Use auth client or direct fetch with token
import type { TourSummary, CarSummary, BookingStats, LocationStats, ReportFilters } from '@shared/schema'; // If types synced, or define here

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useTourSummary(filters?: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'tours', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${API_BASE}/api/reports/tours?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<TourSummary[]>;
    },
  });
}

export function useCarSummary(filters?: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'cars', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${API_BASE}/api/reports/cars?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<CarSummary[]>;
    },
  });
}

export function useBookingStats(filters?: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'bookings', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${API_BASE}/api/reports/bookings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<BookingStats>;
    },
  });
}

export function useLocationStats(filters?: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'locations', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${API_BASE}/api/reports/locations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<LocationStats[]>;
    },
  });
}

