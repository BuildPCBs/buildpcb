import { User, Session } from '@supabase/supabase-js'

export interface AuthUser extends User {
  // Add any additional user properties you want to track
}

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
  // Legacy methods for backward compatibility
  login: () => void
  logout: () => Promise<{ error: any }>
}

export interface AuthState {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
}
