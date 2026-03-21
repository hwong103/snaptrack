import { useState, useEffect } from 'react';
import { getSession, profileGet } from '../services/api';
import type { SessionResponse, UserProfile } from '../services/api';

interface AuthState {
  user: SessionResponse['user'] | null;
  profile: UserProfile | null;
  needsOnboarding: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<SessionResponse['user'] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const s = await getSession();
      if (!s.authenticated || !s.user) {
        setUser(null);
        setProfile(null);
        setNeedsOnboarding(false);
        return;
      }
      setUser(s.user);
      const p = await profileGet();
      setProfile(p);
      setNeedsOnboarding(!p);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return { user, profile, needsOnboarding, loading, refresh: load };
}
