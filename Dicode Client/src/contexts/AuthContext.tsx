import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, User as FirebaseUser, browserLocalPersistence, browserSessionPersistence, setPersistence, updateProfile } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type { AuthState, User, UserRole } from '@/types';
import { auth, functions } from '@/lib/firebase';
import { getUserProfile, upsertUserProfile, getUserCohorts, type UserProfileDoc } from '@/lib/firestore';
import { uploadAvatar } from '@/lib/storage';

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
        email: firebaseUser.email ?? '',
        role: desiredRole,
        name: firebaseUser.displayName ?? firebaseUser.email ?? 'Team Member',
        avatar: firebaseUser.photoURL ?? null,
      });
      return;
    }

    // Existing user - update email if it changed (e.g., Google account)
    if (firebaseUser.email && profile.email !== firebaseUser.email) {
      await upsertUserProfile(firebaseUser.uid, {
        email: firebaseUser.email,
      });
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

  const updateAvatar = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    try {
      // Upload to Firebase Storage
      const photoURL = await uploadAvatar(file, currentUser.uid, onProgress);

      // Update Firebase Auth profile
      await updateProfile(currentUser, { photoURL });

      // Update Firestore profile
      // Note: hydrateUser/validateRole logic handles keeping them in sync, 
      // but we should explicitly update the doc here to be instant.
      await upsertUserProfile(currentUser.uid, {
        avatar: photoURL
      });

      // Refresh local user state
      await refreshUser();

      return photoURL;
    } catch (error) {
      console.error('Error updating avatar:', error);
      throw error;
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
    updateAvatar,
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

    // Ensure email is up to date (in case it was missing or changed)
    if (firebaseUser.email && existingProfile.email !== firebaseUser.email) {
      profile = await upsertUserProfile(firebaseUser.uid, {
        email: firebaseUser.email,
      });
    }
  } else {
    profile = await upsertUserProfile(firebaseUser.uid, {
      email: firebaseUser.email ?? '',
      role: deriveRoleFromEmail(firebaseUser.email),
      name: firebaseUser.displayName ?? firebaseUser.email ?? 'Team Member',
      avatar: firebaseUser.photoURL ?? null,
      department: null,
    });
  }

  // Sync custom claims for security rules (organizationId in token)
  // This is needed for Firestore list queries to work properly
  try {
    const syncClaims = httpsCallable<void, { success: boolean; updated: boolean; organizationId: string | null }>(functions, 'syncCustomClaims');
    const result = await syncClaims();
    if (result.data.updated) {
      // Claims were updated, force token refresh to get new claims
      console.log('[auth] Custom claims updated, refreshing token...');
      await firebaseUser.getIdToken(true);
    }
  } catch (error) {
    // Don't fail login if claim sync fails - it's not critical for basic functionality
    console.warn('[auth] Failed to sync custom claims:', error);
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
