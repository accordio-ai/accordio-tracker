import { useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  business_name: string | null;
  phone_number: string | null;
  address: string | null;
  location: string | null;
  skills: string[] | null;
  plan: string | null;
  preferred_currency: string | null;
  brand_color: string | null;
  onboarding_completed: boolean | null;
  slug: string | null;
  created_at: string | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.profile.get();
      if (result.success && result.data) {
        setProfile(result.data);
        setError(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Re-fetch when window becomes visible (user might have changed profile on web)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchProfile]);

  const displayName = profile?.full_name || profile?.business_name || profile?.email || null;
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || '?';
  const isLegend = profile?.plan === 'legend';

  return {
    profile,
    isLoading,
    error,
    displayName,
    initials,
    isLegend,
    refresh: fetchProfile,
  };
}
