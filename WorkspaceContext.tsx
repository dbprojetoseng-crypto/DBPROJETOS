import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
import {
  doc, getDoc, setDoc, collection, addDoc,
  onSnapshot, query, where, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { useAuth } from './components/AuthWrapper';

export type UserRole = 'admin' | 'planejador' | 'contratada';

export interface WorkspaceMember {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  area: string;
  empresa: string;
  joinedAt?: any;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  maxObras: number;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaceId: string | null;
  myRole: UserRole | null;
  myArea: string;
  myEmpresa: string;
  members: WorkspaceMember[];
  loading: boolean;
  createWorkspace: (name: string) => Promise<string>;
  inviteMember: (email: string, role: UserRole, area: string, empresa: string) => Promise<string>;
  acceptInvite: (token: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be inside WorkspaceProvider');
  return ctx;
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [myArea, setMyArea] = useState('');
  const [myEmpresa, setMyEmpresa] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Find workspace where user is a member
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Check user profile for workspaceId
    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then(async snap => {
      const wsId = snap.data()?.workspaceId;
      if (!wsId) { setLoading(false); return; }

      setWorkspaceId(wsId);

      // Load workspace doc
      const wsSnap = await getDoc(doc(db, 'workspaces', wsId));
      if (wsSnap.exists()) {
        setWorkspace({ id: wsSnap.id, ...wsSnap.data() } as Workspace);
      }

      // Load my membership
      const memberSnap = await getDoc(doc(db, 'workspaces', wsId, 'members', user.uid));
      if (memberSnap.exists()) {
        const m = memberSnap.data() as WorkspaceMember;
        setMyRole(m.role);
        setMyArea(m.area || '');
        setMyEmpresa(m.empresa || '');
      }

      setLoading(false);
    }).catch(err => {
      console.error("Error loading workspace profile:", err);
      setLoading(false);
    });
  }, [user]);

  // Listen to members list (admin only)
  useEffect(() => {
    if (!workspaceId || myRole !== 'admin') return;
    const unsub = onSnapshot(
      collection(db, 'workspaces', workspaceId, 'members'),
      snap => setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as WorkspaceMember)))
    );
    return () => unsub();
  }, [workspaceId, myRole]);

  const createWorkspace = async (name: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const wsRef = await addDoc(collection(db, 'workspaces'), {
      name,
      ownerId: user.uid,
      plan: 'trial',
      maxObras: 5,
      createdAt: serverTimestamp(),
    });
    // Add creator as admin member
    await setDoc(doc(db, 'workspaces', wsRef.id, 'members', user.uid), {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || user.email || '',
      role: 'admin',
      area: '',
      empresa: '',
      joinedAt: serverTimestamp(),
      invitedBy: user.uid,
    });
    // Link user profile to workspace
    await setDoc(doc(db, 'users', user.uid), {
      workspaceId: wsRef.id,
      role: 'admin',
      email: user.email,
      name: user.displayName || user.email,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setWorkspaceId(wsRef.id);
    setMyRole('admin');
    setWorkspace({
      id: wsRef.id,
      name,
      ownerId: user.uid,
      plan: 'trial',
      maxObras: 5,
    });
    setLoading(false);
    return wsRef.id;
  };

  const inviteMember = async (
    email: string, role: UserRole, area: string, empresa: string
  ): Promise<string> => {
    if (!workspaceId || !user) throw new Error('No workspace');
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    await addDoc(collection(db, 'invites'), {
      workspaceId,
      email: email.toLowerCase().trim(),
      role,
      area,
      empresa,
      token,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      expiresAt: expires,
      used: false,
    });

    // Return invite link
    return `${window.location.origin}?invite=${token}`;
  };

  const acceptInvite = async (token: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Find invite by token
    const { getDocs } = await import('firebase/firestore');
    const inviteSnap = await getDocs(
      query(collection(db, 'invites'), where('token', '==', token), where('used', '==', false))
    );

    if (inviteSnap.empty) throw new Error('Convite inválido ou expirado.');
    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data();

    // Check expiry
    if (invite.expiresAt?.toDate() < new Date()) throw new Error('Convite expirado.');

    // Add user to workspace members
    await setDoc(doc(db, 'workspaces', invite.workspaceId, 'members', user.uid), {
      uid: user.uid,
      email: user.email || invite.email,
      name: user.displayName || user.email || '',
      role: invite.role,
      area: invite.area || '',
      empresa: invite.empresa || '',
      joinedAt: serverTimestamp(),
      invitedBy: invite.createdBy,
    });

    // Link user profile
    await setDoc(doc(db, 'users', user.uid), {
      workspaceId: invite.workspaceId,
      role: invite.role,
      email: user.email,
      name: user.displayName || user.email,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Mark invite as used
    await updateDoc(inviteDoc.ref, { used: true, usedBy: user.uid, usedAt: serverTimestamp() });

    setWorkspaceId(invite.workspaceId);
    setMyRole(invite.role);
    setMyArea(invite.area || '');
    setMyEmpresa(invite.empresa || '');

    window.location.reload();
  };

  return (
    <WorkspaceContext.Provider value={{
      workspace, workspaceId, myRole, myArea, myEmpresa,
      members, loading, createWorkspace, inviteMember, acceptInvite,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
