import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Login } from './Login';

interface AuthContextType {
  user: User | null;
  userRole: 'admin' | 'planejador' | 'contratada' | 'client' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userRole: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'planejador' | 'contratada' | 'client' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthWrapper] Setting up onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthWrapper] Auth state changed:", firebaseUser?.uid || "No user");
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            console.log("[AuthWrapper] User role found:", role);
            setUserRole(role);
          } else {
            console.log("[AuthWrapper] User document not found in Firestore");
          }
        } catch (error) {
          console.error('[AuthWrapper] Error fetching user role:', error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
