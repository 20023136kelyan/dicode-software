'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence, setPersistence, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, upsertUserProfile, updateNotificationPreferences as updateNotificationPrefsFirestore, subscribeToUserProfile } from '@/lib/firestore';
import { uploadAvatar } from '@/lib/storage';
import type { UserProfile, NotificationPreferences } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signInWithGoogle: (rememberMe?: boolean) => Promise<void>;
  signInWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateAvatar: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Subscribe to user profile changes
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    setProfileLoading(true);

    // Initialize profile if it doesn't exist
    const initProfile = async () => {
      const existing = await getUserProfile(user.uid);
      if (!existing) {
        await upsertUserProfile(user.uid, {
          displayName: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
        });
      }
    };

    initProfile();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
      setProfileLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    console.log('🔐 Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('👤 Auth state changed:', {
        isSignedIn: !!user,
        userId: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
      });

      if (user && !user.email?.endsWith('@di-code.de')) {
        console.error('⛔️ Access denied: Restricted to @di-code.de domain');
        await firebaseSignOut(auth);
        setUser(null);
      } else {
        setUser(user);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async (rememberMe: boolean = true) => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      // Set persistence based on rememberMe
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      const result = await signInWithPopup(auth, provider);
      if (!result.user.email?.endsWith('@di-code.de')) {
        await firebaseSignOut(auth);
        throw new Error('Access restricted to @di-code.de accounts.');
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string, rememberMe: boolean = true) => {
    if (!email.endsWith('@di-code.de')) {
      throw new Error('Access restricted to @di-code.de accounts.');
    }
    try {
      // Set persistence based on rememberMe
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!email.endsWith('@di-code.de')) {
      throw new Error('Registration restricted to @di-code.de accounts.');
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken(true);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const updateDisplayName = async (displayName: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName });
      
      // Update Firestore profile
      await upsertUserProfile(user.uid, { displayName });
      
      console.log('✅ Display name updated:', displayName);
    } catch (error) {
      console.error('Error updating display name:', error);
      throw error;
    }
  };

  const updateAvatar = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      // Upload to Firebase Storage
      const photoURL = await uploadAvatar(file, user.uid, onProgress);
      
      // Update Firebase Auth profile
      await updateProfile(user, { photoURL });
      
      // Update Firestore profile
      await upsertUserProfile(user.uid, { photoURL });
      
      console.log('✅ Avatar updated:', photoURL);
      return photoURL;
    } catch (error) {
      console.error('Error updating avatar:', error);
      throw error;
    }
  };

  const updateNotificationPreferences = async (preferences: Partial<NotificationPreferences>): Promise<void> => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      await updateNotificationPrefsFirestore(user.uid, preferences);
      console.log('✅ Notification preferences updated');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    getAuthToken,
    updateDisplayName,
    updateAvatar,
    updateNotificationPreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
