// Bruker-profil struktur
export interface UserProfile {
  googleId: string;           // Unik Google ID
  email: string;              // Fra Google
  displayName: string;        // Fra Google
  nickname?: string;          // Valgfri, kan endres
  createdAt: Date;
  lastActive: Date;
}

// Team medlem struktur
export interface TeamMember {
  userId: string;             // Google ID
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  nickname?: string;          // Team-spesifikk nickname
}

// Team struktur
export interface Team {
  id: string;                 // Unik team ID
  name: string;               // Team navn
  ownerId: string;            // Google ID til eieren
  members: TeamMember[];      // Liste over medlemmer
  createdAt: Date;
  isActive: boolean;
}

// Database record base (alle data kobles til team)
export interface DatabaseRecord {
  id: string;
  teamId: string;             // ALLE data kobles til team
  createdBy: string;          // Google ID til oppretteren
  createdAt: Date;
  updatedAt: Date;
}

// Auth state
export interface AuthState {
  user: UserProfile | null;
  activeTeam: Team | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Team invitation
export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined';
}
