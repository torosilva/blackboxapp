import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { useState, useEffect } from 'react';

export interface SubscriptionStatus {
  isPro: boolean;
  monthlyEntryCount: number;
  entryLimitReached: boolean;
  isLoading: boolean;
}

export const FREE_ENTRY_LIMIT = 5;

export function useSubscription(): SubscriptionStatus & { canCreateAudit: () => boolean, refresh: () => Promise<void> } {
  const { user, profile } = useAuth();
  const [monthlyEntryCount, setMonthlyEntryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isPro = Boolean(profile?.is_pro);

  const fetchCount = async () => {
    if (!user) return;
    try {
      const count = await SupabaseService.getMonthlyEntryCount(user.id);
      setMonthlyEntryCount(count);
    } catch (e) {
      console.warn('useSubscription: Failed to fetch count', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPro) {
      setIsLoading(false);
      return;
    }
    fetchCount();
  }, [user, isPro]);

  return {
    isPro,
    monthlyEntryCount,
    entryLimitReached: !isPro && monthlyEntryCount >= FREE_ENTRY_LIMIT,
    isLoading,
    canCreateAudit: () => {
      if (isPro) return true;
      return monthlyEntryCount < FREE_ENTRY_LIMIT;
    },
    refresh: fetchCount,
  };
}
