'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Invitation {
  id: string;
  teamid: string;
  email: string;
  status: string;
  created_at: string;
  teams?: {
    name: string;
  };
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { authState, login } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchInvitation(params.id as string);
    }
  }, [params.id]);

  const fetchInvitation = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/invitations/${inviteId}`);
      if (!response.ok) {
        throw new Error('Invitation not found');
      }
      const data = await response.json();
      setInvitation(data);
    } catch (err) {
      setError('Invitation not found or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!authState.isAuthenticated) {
      // Redirect to login first
      await login();
      return;
    }

    if (!invitation) return;

    setAccepting(true);
    try {
      const response = await fetch(`/api/invitations/${invitation.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }

      alert('Invitation accepted! You are now a member of the team.');
      router.push('/');
    } catch (err) {
      alert('Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-4">{error || 'This invitation is not valid or has expired.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invitation Already Processed</h1>
          <p className="text-gray-600 mb-4">
            This invitation has already been {invitation.status}.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Team Invitation</h1>
          <p className="text-gray-600 mb-6">
            You have been invited to join the team:
          </p>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-semibold text-blue-800">
              {invitation.teams?.name || 'Unknown Team'}
            </h2>
          </div>
          
          {!authState.isAuthenticated ? (
            <div>
              <p className="text-gray-600 mb-4">
                You need to log in to accept this invitation.
              </p>
              <button
                onClick={login}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Log in with Google
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Welcome, {authState.user?.displayName}! Click below to join the team.
              </p>
              <button
                onClick={handleAcceptInvitation}
                disabled={accepting}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
