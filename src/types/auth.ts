import { User, Session } from '@supabase/supabase-js'

// Using User type directly from Supabase
export type AuthUser = User

export interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  isAuthenticated: boolean
  isAuthOverlayOpen: boolean
  isLoading: boolean
  showAuthOverlay: () => void
  hideAuthOverlay: () => void
  signInWithOtp: (email: string) => Promise<{ error: any }>
  verifyOtp: (email: string, token: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  getToken: () => Promise<string | null>
  // Legacy methods for backward compatibility
  login: () => void
  logout: () => Promise<{ error: any }>
}

export interface AuthState {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
}
