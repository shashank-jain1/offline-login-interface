import { supabase } from '../lib/supabase';
import { indexedDBService } from '../lib/indexedDB';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  isOfflineMode?: boolean;
}

export async function loginOnline(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      const passwordHash = await hashPassword(password);
      await indexedDBService.cacheUser({
        id: data.user.id,
        email: data.user.email!,
        passwordHash,
        lastLogin: Date.now(),
      });

      return {
        success: true,
        userId: data.user.id,
        email: data.user.email!,
        isOfflineMode: false,
      };
    }

    return { success: false, error: 'Login failed' };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function loginOffline(email: string, password: string): Promise<AuthResult> {
  try {
    const cachedUser = await indexedDBService.getCachedUser(email);

    if (!cachedUser) {
      return {
        success: false,
        error: 'No credentials found. Please login online first.',
      };
    }

    const passwordHash = await hashPassword(password);

    if (cachedUser.passwordHash !== passwordHash) {
      return { success: false, error: 'Invalid credentials' };
    }

    await indexedDBService.cacheUser({
      ...cachedUser,
      lastLogin: Date.now(),
    });

    return {
      success: true,
      userId: cachedUser.id,
      email: cachedUser.email,
      isOfflineMode: true,
    };
  } catch (error) {
    return { success: false, error: 'Offline login failed' };
  }
}

export async function login(email: string, password: string, isOnline: boolean): Promise<AuthResult> {
  if (isOnline) {
    const result = await loginOnline(email, password);
    if (!result.success) {
      return await loginOffline(email, password);
    }
    return result;
  } else {
    return await loginOffline(email, password);
  }
}

export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function signup(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      return {
        success: true,
        userId: data.user.id,
        email: data.user.email!,
      };
    }

    return { success: false, error: 'Signup failed' };
  } catch (error) {
    return { success: false, error: 'Network error during signup' };
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}