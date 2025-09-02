/**
 * Browser storage utilities for auth data
 */

interface UserData {
  id: string;
  email: string;
  lastLogin: string;
}

export const authStorage = {
  // Get user data from localStorage
  getUser: (): UserData | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const userData = localStorage.getItem('buildpcb.user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return null;
    }
  },

  // Save user data to localStorage
  setUser: (userData: UserData) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('buildpcb.user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user data to localStorage:', error);
    }
  },

  // Remove user data from localStorage
  removeUser: () => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('buildpcb.user');
      localStorage.removeItem('supabase.auth.token');
    } catch (error) {
      console.error('Error removing user data from localStorage:', error);
    }
  },

  // Check if we have a stored session
  hasStoredSession: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userData = authStorage.getUser();
    const supabaseToken = localStorage.getItem('supabase.auth.token');
    
    return !!(userData && supabaseToken);
  },

  // Get last login time
  getLastLogin: (): Date | null => {
    const userData = authStorage.getUser();
    return userData?.lastLogin ? new Date(userData.lastLogin) : null;
  }
};

export default authStorage;
