'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getWeekStart, bookingKey } from '@/lib/activities';

type BookingsMap = Record<string, string[]>;

const POLL_MS = 30_000;
const CACHE_KEY = 'somn:activities';

function loadCache(): BookingsMap {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(b: BookingsMap) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(b)); } catch {}
}

/**
 * Aria booking state. Source of truth is KV-backed /api/activities, shared
 * across the team; a localStorage cache paints instantly and survives a KV
 * outage. Optimistic updates, same pattern as the social layer.
 */
export function useActivities() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [bookings, setBookings] = useState<BookingsMap>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        const next = (data.bookings ?? {}) as BookingsMap;
        if (mountedRef.current) { setBookings(next); saveCache(next); }
      }
    } catch { /* keep cache */ }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setBookings(loadCache());
    fetchBookings();
    const id = setInterval(fetchBookings, POLL_MS);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetchBookings]);

  const toggleBooking = useCallback(async (activityId: string, date: string, user: string) => {
    const key = bookingKey(activityId, date);
    const current = bookings[key] ?? [];
    const isBooked = current.includes(user);
    const optimistic = isBooked ? current.filter(n => n !== user) : [...current, user];

    setBookings(prev => { const next = { ...prev, [key]: optimistic }; saveCache(next); return next; });

    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, date, user, action: isBooked ? 'unbook' : 'book' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.names) setBookings(prev => { const next = { ...prev, [key]: data.names }; saveCache(next); return next; });
      } else if (res.status === 409) {
        // class filled up — roll back
        setBookings(prev => { const next = { ...prev, [key]: current }; saveCache(next); return next; });
      }
    } catch { /* offline — keep optimistic */ }
  }, [bookings]);

  const getNames = useCallback(
    (activityId: string, date: string): string[] => bookings[bookingKey(activityId, date)] ?? [],
    [bookings],
  );

  return { weekStart, setWeekStart, bookings, loading, toggleBooking, getNames, refresh: fetchBookings };
}
