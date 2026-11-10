import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for executing asynchronous operations with loading and error states.
 * @param {Function} asyncFunction - An async function returning data.
 * @param {boolean} immediate - Whether to execute immediately on mount.
 */
export function useAsync(asyncFunction, immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, execute, refetch: execute };
}
