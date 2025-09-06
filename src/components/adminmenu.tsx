'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, Team } from '@/types/auth';

interface AdminMenuProps {
  isExpanded: boolean;
  onClose: () => void;
}

export default function AdminMenu({ isExpanded, onClose }: AdminMenuProps) {
  const { authState, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'team' | 'users' | 'settings'>('team');
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Teams will be loaded from database
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  // Team creation state
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Load teams when user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      loadUserTeams();
    }
  }, [authState.isAuthenticated, authState.user]);

  const loadUserTeams = async () => {
    if (!authState.user) return;
    
    setIsLoadingTeams(true);
    
    try {
      const response = await fetch('/api/teams');
      
      if (!response.ok) {
        throw new Error('Failed to load teams');
      }

      const teams = await response.json();
      setUserTeams(teams);
      
      // Auto-select first team if none is selected
      if (teams.length > 0 && !activeTeam) {
        setActiveTeam(teams[0].id);
      }
      
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Google OAuth login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new team
  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !authState.user) return;
    
    setIsCreatingTeam(true);
    
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTeamName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      const newTeam = await response.json();
      setUserTeams(prev => [...prev, newTeam]);
      setNewTeamName('');
      
      // Auto-select the new team
      setActiveTeam(newTeam.id);
      
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Feil ved opprettelse av team. Prøv igjen.');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  if (!isExpanded) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[3000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Admin Panel</h2>
            {authState.isAuthenticated && authState.user && (
              <p className="text-sm text-gray-300">
                {authState.user.nickname || authState.user.displayName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Team
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'team' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Team Management</h3>
              
              {/* Hvis ikke logget inn, vis login prompt */}
              {!authState.isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    Du må være logget inn for å få tilgang til team-funksjoner.
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isLoading ? 'Logger inn...' : 'Logg inn med Google'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Team Selector */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Active Team</h4>
                    {isLoadingTeams ? (
                      <div className="text-center py-4 text-gray-500">
                        <p>Laster teams...</p>
                      </div>
                    ) : userTeams.length > 0 ? (
                      <select
                        value={activeTeam || ''}
                        onChange={(e) => setActiveTeam(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Velg team...</option>
                        {userTeams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.members?.length || 0} medlemmer)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p>Ingen teams ennå. Opprett ditt første team nedenfor!</p>
                      </div>
                    )}
                  </div>

                  {/* Current Team Info */}
                  {activeTeam && userTeams.find(t => t.id === activeTeam) && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-2">Active Team</h4>
                      <p className="text-sm text-blue-700">Team: <span className="font-medium">{userTeams.find(t => t.id === activeTeam)?.name}</span></p>
                      <p className="text-sm text-blue-700">Members: <span className="font-medium">{userTeams.find(t => t.id === activeTeam)?.members?.length || 0}</span></p>
                      <p className="text-sm text-blue-600 mt-2">All data (skuddpar, søkespor, funn) vises for dette teamet</p>
                    </div>
                  )}

                  {/* Create Team */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Create New Team</h4>
                    <input
                      type="text"
                      placeholder="Team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isCreatingTeam}
                    />
                    <button 
                      onClick={handleCreateTeam}
                      disabled={!newTeamName.trim() || isCreatingTeam}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                      {isCreatingTeam ? 'Oppretter...' : 'Create Team'}
                    </button>
                  </div>

                  {/* Invite Members */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Invite Members</h4>
                    <input
                      type="email"
                      placeholder="Email address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                      Send Invite
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">User Management</h3>
              
              {!authState.isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    Du må være logget inn for å få tilgang til bruker-funksjoner.
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isLoading ? 'Logger inn...' : 'Logg inn med Google'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-2">Current User</h4>
                    <p className="text-sm text-gray-600">User ID: <span className="font-medium">{authState.user?.googleId}</span></p>
                    <p className="text-sm text-gray-600">Email: <span className="font-medium">{authState.user?.email}</span></p>
                    <p className="text-sm text-gray-600">Nickname: <span className="font-medium">{authState.user?.nickname || 'Ikke satt'}</span></p>
                    <p className="text-sm text-gray-600">Teams: <span className="font-medium">{userTeams.length}</span></p>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-4">
                    <button
                      onClick={logout}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Logg ut
                    </button>
                  </div>

                  <div className="text-center text-gray-500 text-sm">
                    User management features coming soon...
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Admin Settings</h3>
              
              {!authState.isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    Du må være logget inn for å få tilgang til admin-innstillinger.
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isLoading ? 'Logger inn...' : 'Logg inn med Google'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm">
                  Admin settings coming soon...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
