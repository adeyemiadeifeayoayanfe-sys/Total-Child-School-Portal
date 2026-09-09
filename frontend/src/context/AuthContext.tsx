import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../config/supabase';
import { apiConfig } from '../config/api';
import { User, UserRole, ApiResponse } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  login: (email: string, password: string) => Promise<ApiResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveRoleState(null);
      return;
    }

    const availableRoles = user.roles?.length
      ? user.roles
      : [user.role];

    // Keep the current dashboard if the role is still assigned.
    if (activeRole && availableRoles.includes(activeRole)) {
      return;
    }

    // Otherwise start with the user's primary role.
    setActiveRoleState(user.role);
  }, [user, activeRole]);

  function setActiveRole(role: UserRole) {
    if (!user) return;

    const availableRoles = user.roles?.length
      ? user.roles
      : [user.role];

    // Never allow the UI to switch to a role the account does not have.
    if (availableRoles.includes(role)) {
      setActiveRoleState(role);
    }
  }

  async function checkSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        localStorage.setItem('sb_token', session.access_token);
        await fetchUser();
      }
    } catch (error) {
      console.error('Session check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUser() {
    try {
      const token = localStorage.getItem('sb_token');
      if (!token) return;

      const response = await fetch(`${apiConfig.baseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        setUser(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    }
  }

  async function login(email: string, password: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        localStorage.setItem('sb_token', result.data.session.access_token);
        setUser(result.data.user);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed',
      };
    }
  }

  async function logout() {
    try {
      const token = localStorage.getItem('sb_token');

      if (token) {
        await fetch(`${apiConfig.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('sb_token');
      setUser(null);
      setActiveRoleState(null);
      await supabase.auth.signOut();
    }
  }

  async function refreshUser() {
    await fetchUser();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeRole,
        setActiveRole,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}