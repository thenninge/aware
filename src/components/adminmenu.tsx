'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, Team } from '@/types/auth';

interface AdminMenuProps {
  isExpanded: boolean;
  onClose: () => void;
}

export default function AdminMenu({ isExpanded, onClose }: AdminMenuProps) {
  const { authState, login, logout, updateUserProfile, setActiveTeam } = useAuth();
  const [activeTab, setActiveTab] = useState<'team' | 'users' | 'settings'>('team');
  const [localActiveTeam, setLocalActiveTeam] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Teams will be loaded from database
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  // Team creation state
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  
  // Team deletion state
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  
  // Team invitation state
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  
  // User nickname state
  const [nickname, setNickname] = useState('');
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);
  
  // Team data stats
  const [teamStats, setTeamStats] = useState({
    posts: 0,
    finds: 0,
    observations: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load teams when user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      loadUserTeams();
      setNickname(authState.user.nickname || '');
    }
  }, [authState.isAuthenticated, authState.user]);

  // Load team stats when active team changes
  useEffect(() => {
    if (localActiveTeam) {
      loadTeamStats();
    }
  }, [localActiveTeam]);

  // Sync localActiveTeam with authState.activeTeam
  useEffect(() => {
    if (authState.activeTeam) {
      setLocalActiveTeam(authState.activeTeam.id);
    } else {
      setLocalActiveTeam(null);
    }
  }, [authState.activeTeam]);

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
      if (teams.length > 0 && !localActiveTeam) {
        setLocalActiveTeam(teams[0].id);
        setActiveTeam(teams[0]); // Update AuthContext
      }
      
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const loadTeamStats = async () => {
    if (!localActiveTeam) return;
    
    setIsLoadingStats(true);
    try {
      const response = await fetch(`/api/team-stats?teamId=${localActiveTeam}`);
      if (response.ok) {
        const stats = await response.json();
        setTeamStats(stats);
      } else {
        console.error('Failed to load team stats');
      }
    } catch (error) {
      console.error('Error loading team stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Google OAuth login via NextAuth
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      await signIn('google', { 
        callbackUrl: window.location.origin,
        redirect: true 
      });
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
      setLocalActiveTeam(newTeam.id);
      setActiveTeam(newTeam); // Update AuthContext
      
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Feil ved opprettelse av team. Prøv igjen.');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!localActiveTeam || !authState.user) return;
    
    const teamToDelete = userTeams.find(t => t.id === localActiveTeam);
    if (!teamToDelete) return;
    
    const confirmed = window.confirm(`Er du sikker på at du vil slette teamet "${teamToDelete.name}"? Denne handlingen kan ikke angres.`);
    if (!confirmed) return;
    
    setIsDeletingTeam(true);
    
    try {
      const response = await fetch(`/api/teams?id=${localActiveTeam}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete team');
      }

      // Remove team from local state
      setUserTeams(prev => prev.filter(t => t.id !== localActiveTeam));
      
      // Clear active team if it was the deleted one
      setLocalActiveTeam(null);
      setActiveTeam(null); // Update AuthContext
      
      alert('Team slettet!');
      
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Feil ved sletting av team. Prøv igjen.');
    } finally {
      setIsDeletingTeam(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !localActiveTeam || !authState.user) return;
    
    setIsSendingInvite(true);
    
    try {
      const response = await fetch('/api/team-invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: localActiveTeam,
          email: inviteEmail.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const result = await response.json();
      setInviteEmail('');
      alert('Invitasjon sendt!');
      
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      alert(`Feil ved sending av invitasjon: ${error.message}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!nickname.trim() || !authState.user) return;
    
    setIsUpdatingNickname(true);
    
    try {
      // Update nickname in database
      const response = await fetch('/api/user-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          display_name: authState.user.displayName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update nickname');
      }

      // Update nickname in AuthContext
      updateUserProfile({ nickname: nickname.trim() });
      
      alert('Nickname updated!');
      
    } catch (error: any) {
      console.error('Error updating nickname:', error);
      alert('Feil ved oppdatering av nickname. Prøv igjen.');
    } finally {
      setIsUpdatingNickname(false);
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
            User
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
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
                        value={localActiveTeam || ''}
                        onChange={(e) => {
                          setLocalActiveTeam(e.target.value);
                          // Update AuthContext
                          if (e.target.value) {
                            const selectedTeam = userTeams.find(t => t.id === e.target.value);
                            if (selectedTeam) {
                              setActiveTeam(selectedTeam);
                            }
                          } else {
                            setActiveTeam(null);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Velg team...</option>
                        {userTeams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name}
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
                  {localActiveTeam && userTeams.find(t => t.id === localActiveTeam) && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-2">Active Team</h4>
                      <p className="text-sm text-blue-700">Team: <span className="font-medium">{userTeams.find(t => t.id === localActiveTeam)?.name}</span></p>
                      <div className="text-sm text-blue-700">
                        <span className="font-medium">Members:</span>
                        <div className="mt-1 space-y-1">
                          {userTeams.find(t => t.id === localActiveTeam)?.members?.map((member, index) => {
                            const memberData = member as any;
                            let displayName;
                            if (memberData.userid === authState.user?.googleId) {
                              displayName = authState.user?.nickname || authState.user?.displayName || 'You';
                            } else {
                              displayName = memberData.userProfile?.nickname || memberData.userProfile?.display_name || memberData.userProfile?.email || `User ${memberData.userid}`;
                            }
                            return (
                              <div key={index} className="text-xs bg-blue-100 px-2 py-1 rounded">
                                {displayName} ({member.role})
                              </div>
                            );
                          }) || <span className="text-xs text-gray-500">No members</span>}
                        </div>
                      </div>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
                  {localActiveTeam && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Invite Members</h4>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        disabled={isSendingInvite}
                      />
                      <button 
                        onClick={handleSendInvite}
                        disabled={!inviteEmail.trim() || isSendingInvite}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                      >
                        {isSendingInvite ? 'Sender...' : 'Send Invite'}
                      </button>
                    </div>
                  )}

                  {/* Delete Active Team */}
                  {localActiveTeam && userTeams.find(t => t.id === localActiveTeam) && (
                    <div className="space-y-3 pt-6 pb-6">
                      <h4 className="font-medium text-gray-700">Delete Active Team</h4>
                      <button 
                        onClick={handleDeleteTeam}
                        disabled={isDeletingTeam}
                        className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                      >
                        {isDeletingTeam ? 'Sletter...' : `Delete "${userTeams.find(t => t.id === localActiveTeam)?.name}"`}
                      </button>
                    </div>
                  )}
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

                  {/* Update Nickname */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Update Nickname</h4>
                    <input
                      type="text"
                      placeholder="Enter your nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      disabled={isUpdatingNickname}
                    />
                    <button 
                      onClick={handleUpdateNickname}
                      disabled={!nickname.trim() || isUpdatingNickname}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      {isUpdatingNickname ? 'Updating...' : 'Update Nickname'}
                    </button>
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
                <div className="space-y-6">
                  {/* Team Data Overview */}
                  {localActiveTeam && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-3">Active Team Data</h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-white p-3 rounded border">
                          <div className="text-2xl font-bold text-blue-600">
                            {isLoadingStats ? '...' : teamStats.posts}
                          </div>
                          <div className="text-sm text-gray-900">Skuddpar</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-2xl font-bold text-green-600">
                            {isLoadingStats ? '...' : teamStats.finds}
                          </div>
                          <div className="text-sm text-gray-900">Funn</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-2xl font-bold text-yellow-600">
                            {isLoadingStats ? '...' : teamStats.observations}
                          </div>
                          <div className="text-sm text-gray-900">Observasjoner</div>
                        </div>
                      </div>
                      <p className="text-xs text-blue-900 mt-2">Team: {userTeams.find(t => t.id === localActiveTeam)?.name}</p>
                    </div>
                  )}

                  {/* App Version */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">App Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-900">Version:</span>
                        <span className="font-medium">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-900">Build:</span>
                        <span className="font-medium">{new Date().toISOString().split('T')[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Debug Info */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Debug Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-900">User ID:</span>
                        <span className="font-mono text-xs">{authState.user?.googleId?.substring(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-900">Active Team:</span>
                        <span className="font-medium">{localActiveTeam ? 'Yes' : 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-900">Teams Count:</span>
                        <span className="font-medium">{userTeams.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-900">Session:</span>
                        <span className="font-medium">{authState.isAuthenticated ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
