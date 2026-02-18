// Compatibility Hook - Fetches and manages compatibility matches
// Ready for backend integration with astrological matching

import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '../config/flags';
import type { CompatMatch, CompatProfile, CompatQuery, CompatResponse } from '../compat/types';

// Re-export types from the main types file
export type { CompatProfile, CompatMatch, CompatResponse, CompatQuery } from '../compat/types';

export function useCompat(chartId: string, limit: number = 10) {
  const [matches, setMatches] = useState<CompatMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_COMPAT') || !chartId) {
      setMatches([]);
      return;
    }

    const fetchCompat = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('chartId', chartId);
        if (limit) params.set('limit', limit.toString());

        const response = await fetch(`/api/compat/matches?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch compatibility: ${response.status}`);
        }

        const data: CompatResponse = await response.json();
        setMatches(data.matches);
      } catch (err) {
        console.error('[useCompat] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load compatibility');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCompat();
  }, [chartId, limit]);

  return {
    matches,
    loading,
    error,
    refetch: () => {
      if (isFeatureEnabled('ENABLE_COMPAT') && chartId) {
        setMatches([]);
      }
    },
  };
}

// Hook for creating/updating compatibility profile
export function useCompatProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProfile = async (profile: Omit<CompatProfile, 'updatedAt'>) => {
    if (!isFeatureEnabled('ENABLE_COMPAT')) {
      throw new Error('Compatibility feature is disabled');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compat/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error(`Failed to create profile: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create profile';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (userId: string, chartId: string, updates: Partial<CompatProfile>) => {
    if (!isFeatureEnabled('ENABLE_COMPAT')) {
      throw new Error('Compatibility feature is disabled');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compat/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          chartId,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createProfile,
    updateProfile,
    loading,
    error,
  };
}

// Mock data for development
export const getMockCompatData = (chartId: string): CompatMatch[] => {
  return [
    {
      targetUserId: 'user-123',
      targetChartId: 'chart-456',
      score: 0.87,
      rationale: [
        'Venus trine Moon',
        'Shared modality: Fixed',
        'Compatible elemental balance',
      ],
      compatibility: {
        elemental: 0.85,
        modal: 0.90,
        aspect: 0.88,
        preference: 0.82,
      },
      sharedTraits: [
        'Creative expression',
        'Emotional depth',
        'Artistic sensitivity',
      ],
      potentialChallenges: [
        'Different communication styles',
        'Varying energy levels',
      ],
    },
    {
      targetUserId: 'user-789',
      targetChartId: 'chart-101',
      score: 0.74,
      rationale: [
        'Sun sextile Mercury',
        'Shared air element dominance',
        'Similar musical preferences',
      ],
      compatibility: {
        elemental: 0.78,
        modal: 0.70,
        aspect: 0.75,
        preference: 0.73,
      },
      sharedTraits: [
        'Intellectual curiosity',
        'Communication skills',
        'Social awareness',
      ],
      potentialChallenges: [
        'Different emotional needs',
        'Varying commitment levels',
      ],
    },
  ];
};

// Development helper
export const useMockCompat = (chartId: string) => {
  const [matches] = useState(() => getMockCompatData(chartId));
  
  return {
    matches,
    profile: {
      userId: 'current-user',
      chartId,
      audioPrefs: {
        energy: 0.7,
        mood: 0.6,
        complexity: 0.8,
      },
      updatedAt: new Date().toISOString(),
    },
    loading: false,
    error: null,
    refetch: () => {},
  };
};
