import { useState, useCallback } from 'react';
import { apiConfig, getAuthHeaders } from '../config/api';
import { ApiResponse } from '../types';

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (
    endpoint: string,
    options: UseApiOptions = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const method = options.method || 'GET';
      const headers = getAuthHeaders();

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (options.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, fetchOptions);
      const result: ApiResponse<T> = await response.json();

      if (result.success) {
        setData(result.data || null);
        options.onSuccess?.(result.data);
      } else {
        setError(result.error || 'Request failed');
        options.onError?.(result.error || 'Request failed');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Network error';
      setError(errorMessage);
      options.onError?.(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, call };
}