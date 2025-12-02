import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, User as FirebaseUser, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import type { AuthState, User, UserRole } from '@/types';
import { auth } from '@/lib/firebase';
import { getUserProfile, upsertUserProfile, getUserCohorts, type UserProfileDoc } from '@/lib/firestore';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const hydratedUser = await hydrateUser(firebaseUser);
        if (isMounted) {
          setUser(hydratedUser);
        }
      } catch (error) {
        console.error('[auth] Failed to hydrate user', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const validateRole = async (firebaseUser: FirebaseUser, desiredRole?: UserRole) => {
    if (!desiredRole) return; // No role selected, skip validation

    // Get user's actual role from Firestore
    const profile = await getUserProfile(firebaseUser.uid);

    if (!profile) {
      // New user - set role (for initial signup flow)
      await upsertUserProfile(firebaseUser.uid, {
        role: desiredRole,
        name: firebaseUser.displayName ?? firebaseUser.email ?? 'Team Member',
        avatar: firebaseUser.photoURL ?? null,
      });
      return;
    }

    // Existing user - validate role matches
    if (profile.role !== desiredRole) {
      // Log out immediately if role mismatch
      await firebaseSignOut(auth);
      throw new Error(`This account is registered as ${profile.role}, but you selected ${desiredRole}. Please select the correct role.`);
    }
  };

  const login = async (email: string, password: string, desiredRole?: UserRole, rememberMe: boolean = true) => {
    // Set persistence based on rememberMe
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await validateRole(credential.user, desiredRole);
  };

  const loginWithGoogle = async (desiredRole?: UserRole, rememberMe: boolean = true) => {
    // Set persistence based on rememberMe
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    const credential = await signInWithPopup(auth, provider);
    await validateRole(credential.user, desiredRole);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const refreshUser = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUser(null);
      return;
    }

    setIsLoading(true);
    try {
      const hydratedUser = await hydrateUser(currentUser);
      setUser(hydratedUser);
    } catch (error) {
      console.error('[auth] Failed to refresh user', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithGoogle,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function deriveRoleFromEmail(email?: string | null): UserRole {
  if (!email) return 'employee';
  return email.toLowerCase().includes('admin') ? 'admin' : 'employee';
}

async function hydrateUser(firebaseUser: FirebaseUser): Promise<User> {
  const existingProfile = await getUserProfile(firebaseUser.uid);
  let profile: UserProfileDoc;

  if (existingProfile) {
    profile = existingProfile;
  } else {
    profile = await upsertUserProfile(firebaseUser.uid, {
      role: deriveRoleFromEmail(firebaseUser.email),
      name: firebaseUser.displayName ?? firebaseUser.email ?? 'Team Member',
      avatar: firebaseUser.photoURL ?? null,
      department: null,
    });
  }

  // Load user's cohort memberships
  const cohortIds = await getUserCohorts(firebaseUser.uid);

  return mapProfileToUser(firebaseUser, profile, cohortIds);
}

function mapProfileToUser(firebaseUser: FirebaseUser, profile: UserProfileDoc, cohortIds: string[]): User {
  // Helper to convert Firestore Timestamp to Date
  const convertTimestamp = (timestamp: any): Date | string | number | undefined => {
    if (!timestamp) return undefined;
    if (timestamp?.toDate) return timestamp.toDate();
    return timestamp;
  };

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    name: profile.name ?? firebaseUser.displayName ?? firebaseUser.email ?? 'Team Member',
    role: profile.role,
    department: profile.department || undefined,
    organization: profile.organization || undefined,
    avatar: profile.avatar ?? firebaseUser.photoURL ?? undefined,
    cohortIds: cohortIds.length > 0 ? cohortIds : undefined,
    gender: profile.gender || undefined,
    dateOfBirth: convertTimestamp(profile.dateOfBirth),
    requirePasswordChange: profile.requirePasswordChange || undefined,
    onboardingCompletedAt: convertTimestamp(profile.onboardingCompletedAt),
    invitationId: profile.invitationId || undefined,
  };
}
