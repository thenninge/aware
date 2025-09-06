'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { AuthState, UserProfile, Team } from '@/types/auth';

interface AuthContextType {
  authState: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setActiveTeam: (team: Team | null) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);

  // Convert NextAuth session to our UserProfile format
  const convertSessionToUserProfile = (session: any): UserProfile | null => {
    if (!session?.user) return null;
    
    return {
      googleId: session.user.googleId || session.user.email,
      email: session.user.email,
      displayName: session.user.name || session.user.email,
      nickname: session.user.nickname,
      createdAt: new Date(),
      lastActive: new Date(),
    };
  };

  // Load active team from localStorage
  useEffect(() => {
    const loadActiveTeam = () => {
      try {
        const savedTeam = localStorage.getItem('aware_active_team');
        if (savedTeam) {
          setActiveTeamState(JSON.parse(savedTeam));
        }
      } catch (error) {
        console.error('Error loading active team:', error);
      }
    };

    loadActiveTeam();
  }, []);

  // Update auth state when session changes
  const authState: AuthState = {
    user: convertSessionToUserProfile(session),
    activeTeam,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
  };

  const login = async () => {
    await signIn('google');
  };

  const logout = async () => {
    localStorage.removeItem('aware_active_team');
    setActiveTeamState(null);
    await signOut();
  };

  const setActiveTeam = (team: Team | null) => {
    if (team) {
      localStorage.setItem('aware_active_team', JSON.stringify(team));
    } else {
      localStorage.removeItem('aware_active_team');
    }
    
    setActiveTeamState(team);
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    // For now, we'll store user profile updates in localStorage
    // In the future, this could sync with a database
    if (!authState.user) return;
    
    const updatedUser = { ...authState.user, ...updates };
    localStorage.setItem('aware_user_profile', JSON.stringify(updatedUser));
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
