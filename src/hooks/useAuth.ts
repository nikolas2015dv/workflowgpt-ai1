import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';

const fallback: AuthContextValue = {
  user: null,
  subscription: null,
  effectivePlan: null,
  usage: null,
  isLoading: true,
  isAuthenticated: false,
  isDevMode: false,
  isOwner: false,
  error: null,
  refreshUser: async () => {},
  applySubscriptionResult: () => {},
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? fallback;
}
