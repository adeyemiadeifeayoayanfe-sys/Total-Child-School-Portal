const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const apiConfig = {
  baseUrl: API_URL,
};

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sb_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// For production, ensure we're using the correct API URL
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn('VITE_API_URL is not set. Using default localhost URL.');
}