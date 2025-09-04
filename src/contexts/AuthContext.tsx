'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, UserProfile, Team } from '@/types/auth';

interface AuthContextType {
  authState: AuthState;
  login: (user: UserProfile) => void;
  logout: () => void;
  setActiveTeam: (team: Team | null) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    activeTeam: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const savedUser = localStorage.getItem('aware_user');
        const savedTeam = localStorage.getItem('aware_active_team');
        
        if (savedUser) {
          const user = JSON.parse(savedUser);
          const team = savedTeam ? JSON.parse(savedTeam) : null;
          
          setAuthState({
            user,
            activeTeam: team,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadAuthState();
  }, []);

  const login = (user: UserProfile) => {
    localStorage.setItem('aware_user', JSON.stringify(user));
    setAuthState({
      user,
      activeTeam: null,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = () => {
    localStorage.removeItem('aware_user');
    localStorage.removeItem('aware_active_team');
    setAuthState({
      user: null,
      activeTeam: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const setActiveTeam = (team: Team | null) => {
    if (team) {
      localStorage.setItem('aware_active_team', JSON.stringify(team));
    } else {
      localStorage.removeItem('aware_active_team');
    }
    
    setAuthState(prev => ({
      ...prev,
      activeTeam: team,
    }));
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (!authState.user) return;
    
    const updatedUser = { ...authState.user, ...updates };
    localStorage.setItem('aware_user', JSON.stringify(updatedUser));
    
    setAuthState(prev => ({
      ...prev,
      user: updatedUser,
    }));
  };

  const value: AuthContextType = {
    authState,
    login,
    logout,
    setActiveTeam,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
