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

export function useSubscription(): SubscriptionStatus {
  const { user, profile } = useAuth();
  const [monthlyEntryCount, setMonthlyEntryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isPro = Boolean(profile?.is_pro);

  useEffect(() => {
    if (!user || isPro) {
      setIsLoading(false);
      return;
    }
    SupabaseService.getMonthlyEntryCount(user.id)
      .then(setMonthlyEntryCount)
      .finally(() => setIsLoading(false));
  }, [user, isPro]);

  return {
    isPro,
    monthlyEntryCount,
    entryLimitReached: !isPro && monthlyEntryCount >= FREE_ENTRY_LIMIT,
    isLoading,
  };
}
