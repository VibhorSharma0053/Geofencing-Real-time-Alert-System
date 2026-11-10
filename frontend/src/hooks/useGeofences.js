import { useCallback } from 'react';
import { getGeofences } from '../api/geofences';
import { useAsync } from './useAsync';

export function useGeofences(params = {}) {
  const fetchGeofences = useCallback(() => getGeofences(params), [JSON.stringify(params)]);
  const { data, loading, error, refetch } = useAsync(fetchGeofences, true);

  return {
    geofences: data?.geofences || [],
    totalCount: data?.total_count ?? null,
    loading,
    error,
    refetch,
  };
}
