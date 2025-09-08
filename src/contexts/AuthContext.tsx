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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  // Load active team and user profile from localStorage and API
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

    const loadUserProfile = async () => {
      try {
        // First try to load from localStorage
        const savedProfile = localStorage.getItem('aware_user_profile');
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile));
        }

        // Load from API
        if (session?.user) {
          const response = await fetch('/api/user-profile');
          if (response.ok) {
            const apiProfile = await response.json();
            if (apiProfile) {
              setUserProfile(apiProfile);
              localStorage.setItem('aware_user_profile', JSON.stringify(apiProfile));
            }
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    const loadTeamsAndSetActive = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/teams');
          if (response.ok) {
            const teams = await response.json();
            if (teams.length > 0) {
              // If no active team is set, use the first team
              const currentActiveTeam = localStorage.getItem('aware_active_team');
              if (!currentActiveTeam) {
                const firstTeam = teams[0];
                setActiveTeamState(firstTeam);
                localStorage.setItem('aware_active_team', JSON.stringify(firstTeam));
              }
            }
          }
        } catch (error) {
          console.error('Error loading teams:', error);
        }
      }
    };

    loadActiveTeam();
    loadUserProfile();
    loadTeamsAndSetActive();
  }, [session?.user]);

  // Update auth state when session changes
  const baseUser = convertSessionToUserProfile(session);
  const finalUser = userProfile && baseUser ? { ...baseUser, ...userProfile } : baseUser;
  
  const authState: AuthState = {
    user: finalUser,
    activeTeam,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
  };

  const login = async () => {
    await signIn('google');
  };

  const logout = async () => {
    localStorage.removeItem('aware_active_team');
    localStorage.removeItem('aware_user_profile');
    setActiveTeamState(null);
    setUserProfile(null);
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
    setUserProfile(updatedUser);
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
