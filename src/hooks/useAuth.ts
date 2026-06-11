import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';

const fallback: AuthContextValue = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isDevMode: false,
  error: null,
  refreshUser: async () => {},
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? fallback;
}
