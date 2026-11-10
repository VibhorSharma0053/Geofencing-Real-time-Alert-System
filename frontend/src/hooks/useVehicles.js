import { useCallback } from 'react';
import { getVehicles } from '../api/vehicles';
import { useAsync } from './useAsync';

export function useVehicles(params = {}) {
  const fetchVehicles = useCallback(() => getVehicles(params), [JSON.stringify(params)]);
  const { data, loading, error, refetch } = useAsync(fetchVehicles, true);

  return {
    vehicles: data?.vehicles || [],
    totalCount: data?.total_count ?? null,
    loading,
    error,
    refetch,
  };
}
