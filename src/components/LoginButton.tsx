'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/auth';

export default function LoginButton() {
  const { authState, login, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Mock Google OAuth login - senere kobles dette til ekte Google OAuth
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      // Simuler Google OAuth prosess
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock bruker data
      const mockUser: UserProfile = {
        googleId: `google_${Date.now()}`,
        email: 'test@example.com',
        displayName: 'Test User',
        nickname: 'TestJeger',
        createdAt: new Date(),
        lastActive: new Date(),
      };
      
      login(mockUser);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (authState.isLoading) {
    return (
      <button className="w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center" disabled>
        <span className="text-white text-sm">...</span>
      </button>
    );
  }

  if (authState.isAuthenticated && authState.user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
        >
          Logg ut
        </button>
        <div className="text-xs text-gray-700">
          {authState.user.nickname || authState.user.displayName}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={isLoading}
      className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg flex items-center justify-center transition-colors"
      title="Logg inn med Google"
    >
      {isLoading ? (
        <span className="text-white text-sm">...</span>
      ) : (
        <span className="text-white text-lg">👤</span>
      )}
    </button>
  );
}
