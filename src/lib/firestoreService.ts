import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, defaultDb, allDbs } from './firebase';
import { User, Pod, Perk, AuditLogEntry, Redemption } from '../types';
import { INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS } from '../data/initialData';

// --- SEED INITIAL DATA IF EMPTY ---
export async function seedInitialFirestoreData() {
  for (const targetDb of allDbs) {
    try {
      // Check if pods exist
      const podsSnap = await getDocs(collection(targetDb, 'pods'));
      if (podsSnap.empty) {
        console.log('Seeding initial pods into Firestore...');
        for (const pod of INITIAL_PODS) {
          await setDoc(doc(targetDb, 'pods', pod.id), pod);
        }
      }

      // Check if perks exist
      const perksSnap = await getDocs(collection(targetDb, 'perks'));
      if (perksSnap.empty) {
        console.log('Seeding initial perks into Firestore...');
        for (const perk of INITIAL_PERKS) {
          await setDoc(doc(targetDb, 'perks', perk.id), perk);
        }
      }

      // Check if users exist
      const usersSnap = await getDocs(collection(targetDb, 'users'));
      if (usersSnap.empty) {
        console.log('Seeding initial users into Firestore...');
        for (const user of INITIAL_USERS) {
          await setDoc(doc(targetDb, 'users', user.id), user);
        }
      }

      // Check if audit logs exist
      const logsSnap = await getDocs(collection(targetDb, 'auditLogs'));
      if (logsSnap.empty) {
        console.log('Seeding initial audit logs into Firestore...');
        for (const log of INITIAL_AUDIT_LOGS) {
          await setDoc(doc(targetDb, 'auditLogs', log.id), log);
        }
      }
    } catch (error) {
      console.warn('Error seeding initial Firestore data:', error);
    }
  }
}

// --- USERS ---
export async function getUserFromFirestore(userId: string): Promise<User | null> {
  for (const targetDb of allDbs) {
    try {
      const userDoc = await getDoc(doc(targetDb, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
    } catch (err) {
      console.error('Error fetching user from Firestore:', err);
    }
  }
  return null;
}

export async function saveUserToFirestore(user: User): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await setDoc(doc(targetDb, 'users', user.id), user, { merge: true });
    } catch (err) {
      console.error('Error saving user to Firestore:', err);
    }
  }
}

export function subscribeToUser(userId: string, callback: (user: User | null) => void) {
  const unsub1 = onSnapshot(doc(db, 'users', userId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as User);
    }
  }, () => {});

  let unsub2 = () => {};
  if (defaultDb !== db) {
    unsub2 = onSnapshot(doc(defaultDb, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as User);
      }
    }, () => {});
  }

  return () => { unsub1(); unsub2(); };
}

// --- PODS ---
export function subscribeToPods(callback: (pods: Pod[]) => void) {
  const unsub1 = onSnapshot(collection(db, 'pods'), (snapshot) => {
    if (!snapshot.empty) {
      const pods: Pod[] = [];
      snapshot.forEach((docSnap) => pods.push(docSnap.data() as Pod));
      callback(pods);
    }
  }, () => {});

  let unsub2 = () => {};
  if (defaultDb !== db) {
    unsub2 = onSnapshot(collection(defaultDb, 'pods'), (snapshot) => {
      if (!snapshot.empty) {
        const pods: Pod[] = [];
        snapshot.forEach((docSnap) => pods.push(docSnap.data() as Pod));
        callback(pods);
      }
    }, () => {});
  }

  return () => { unsub1(); unsub2(); };
}

export async function savePodToFirestore(pod: Pod): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await setDoc(doc(targetDb, 'pods', pod.id), pod, { merge: true });
    } catch (err) {
      console.error('Error saving pod to Firestore:', err);
    }
  }
}

// --- PERKS ---
export function subscribeToPerks(callback: (perks: Perk[]) => void) {
  const unsub1 = onSnapshot(collection(db, 'perks'), (snapshot) => {
    if (!snapshot.empty) {
      const perks: Perk[] = [];
      snapshot.forEach((docSnap) => perks.push(docSnap.data() as Perk));
      callback(perks);
    }
  }, () => {});

  let unsub2 = () => {};
  if (defaultDb !== db) {
    unsub2 = onSnapshot(collection(defaultDb, 'perks'), (snapshot) => {
      if (!snapshot.empty) {
        const perks: Perk[] = [];
        snapshot.forEach((docSnap) => perks.push(docSnap.data() as Perk));
        callback(perks);
      }
    }, () => {});
  }

  return () => { unsub1(); unsub2(); };
}

export async function savePerkToFirestore(perk: Perk): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await setDoc(doc(targetDb, 'perks', perk.id), perk, { merge: true });
      console.log(`Perk ${perk.id} saved to Firestore successfully.`);
    } catch (err) {
      console.error('Error saving perk to Firestore:', err);
    }
  }
}

export async function deletePerkFromFirestore(perkId: string): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await deleteDoc(doc(targetDb, 'perks', perkId));
    } catch (err) {
      console.error('Error deleting perk from Firestore:', err);
    }
  }
}

// --- AUDIT LOGS ---
export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void) {
  const q1 = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
  const unsub1 = onSnapshot(q1, (snapshot) => {
    if (!snapshot.empty) {
      const logs: AuditLogEntry[] = [];
      snapshot.forEach((docSnap) => logs.push(docSnap.data() as AuditLogEntry));
      callback(logs);
    }
  }, () => {});

  let unsub2 = () => {};
  if (defaultDb !== db) {
    const q2 = query(collection(defaultDb, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
    unsub2 = onSnapshot(q2, (snapshot) => {
      if (!snapshot.empty) {
        const logs: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => logs.push(docSnap.data() as AuditLogEntry));
        callback(logs);
      }
    }, () => {});
  }

  return () => { unsub1(); unsub2(); };
}

export async function addAuditLogToFirestore(log: AuditLogEntry): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await setDoc(doc(targetDb, 'auditLogs', log.id), log);
    } catch (err) {
      console.error('Error adding audit log to Firestore:', err);
    }
  }
}

// --- REDEMPTIONS ---
export async function addRedemptionToFirestore(redemption: Redemption): Promise<void> {
  for (const targetDb of allDbs) {
    try {
      await setDoc(doc(targetDb, 'redemptions', redemption.id), redemption);
    } catch (err) {
      console.error('Error adding redemption to Firestore:', err);
    }
  }
}
