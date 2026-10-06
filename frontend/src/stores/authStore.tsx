import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, configureApiClient } from "../services/apiClient";
import { authService } from "../services/authService";
import type { UserPublic } from "../types/api";
import { AccountCreatedError, RegistrationUnconfirmedError } from "../utils/registration";

const ACCESS_TOKEN_KEY = "casa_access_token";
const REFRESH_TOKEN_KEY = "casa_refresh_token";

interface AuthContextValue {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserPublic>;
  register: (data: { first_name: string; last_name: string; email: string; password: string }) => Promise<UserPublic>;
  logout: () => void;
  updateUser: (user: UserPublic) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
      tryRefresh: async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return false;
        try {
          const { access_token } = await authService.refresh(refreshToken);
          localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
          return true;
        } catch {
          return false;
        }
      },
      onSessionExpired: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setUser(null);
      },
    });

    // Restaure la session si un token est déjà stocké (rechargement de page).
    const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!existingToken) {
      setIsLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await authService.login({ email, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    const me = await authService.me();
    setUser(me);
    return me;
  };

  /** Crée le compte puis ouvre la session et renvoie l'identité fraîche, comme `login`. Les deux étapes sont distinguées : un refus du serveur
   * (4xx) est relayé tel quel ; une réponse perdue ou un 5xx donne `RegistrationUnconfirmedError` (création non confirmée, jamais rejouée
   * seule) ; une création confirmée dont la connexion échoue donne `AccountCreatedError`, après nettoyage de la session partielle. */
  const register = async (data: { first_name: string; last_name: string; email: string; password: string }) => {
    try {
      await authService.register(data);
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) throw error;
      throw new RegistrationUnconfirmedError();
    }
    try {
      return await login(data.email, data.password);
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setUser(null);
      throw new AccountCreatedError();
    }
  };

  const logout = () => {
    authService.logout().catch(() => {
      // Le logout est stateless côté serveur (cf. backend) — même si l'appel
      // échoue (token déjà expiré par ex.), on nettoie la session locale.
    });
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
  };

  // Rafraîchit l'utilisateur en mémoire après une modification de profil
  // (PATCH /api/auth/me) sans forcer une reconnexion complète.
  const updateUser = (updated: UserPublic) => setUser(updated);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, register, logout, updateUser }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
