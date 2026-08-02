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
import { db } from './firebase';
import { User, Pod, Perk, AuditLogEntry, Redemption } from '../types';
import { INITIAL_USERS, INITIAL_PODS, INITIAL_PERKS, INITIAL_AUDIT_LOGS } from '../data/initialData';

// Helper to strip undefined fields so Firestore setDoc never throws on undefined values
function sanitizeForFirestore<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const clean: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean as T;
}

// --- SEED INITIAL DATA IF EMPTY ---
export async function seedInitialFirestoreData() {
  try {
    // Delete legacy sample perks from Firestore so production starts clean
    const samplePerkIds = ['perk_1', 'perk_2', 'perk_3', 'perk_4', 'perk_5', 'perk_6', 'perk_pending_sample'];
    for (const perkId of samplePerkIds) {
      try {
        await deleteDoc(doc(db, 'perks', perkId));
      } catch (e) {
        // ignore if not found
      }
    }

    // Check if pods exist
    const podsSnap = await getDocs(collection(db, 'pods'));
    if (podsSnap.empty) {
      console.log('Seeding initial pods into Firestore...');
      for (const pod of INITIAL_PODS) {
        await setDoc(doc(db, 'pods', pod.id), sanitizeForFirestore(pod));
      }
    }

    // Check if perks exist
    if (INITIAL_PERKS.length > 0) {
      const perksSnap = await getDocs(collection(db, 'perks'));
      if (perksSnap.empty) {
        console.log('Seeding initial perks into Firestore...');
        for (const perk of INITIAL_PERKS) {
          await setDoc(doc(db, 'perks', perk.id), sanitizeForFirestore(perk));
        }
      }
    }

    // Check if users exist
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding initial users into Firestore...');
      for (const user of INITIAL_USERS) {
        await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user));
      }
    }

    // Check if audit logs exist
    const logsSnap = await getDocs(collection(db, 'auditLogs'));
    if (logsSnap.empty) {
      console.log('Seeding initial audit logs into Firestore...');
      for (const log of INITIAL_AUDIT_LOGS) {
        await setDoc(doc(db, 'auditLogs', log.id), sanitizeForFirestore(log));
      }
    }
  } catch (error) {
    console.warn('Error seeding initial Firestore data:', error);
  }
}

// --- USERS ---
export async function getUserFromFirestore(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
  } catch (err) {
    console.error('Error fetching user from Firestore:', err);
  }
  return null;
}

export async function saveUserToFirestore(user: User): Promise<void> {
  try {
    await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user), { merge: true });
  } catch (err) {
    console.error('Error saving user to Firestore:', err);
  }
}

export function subscribeToUser(userId: string, callback: (user: User | null) => void) {
  return onSnapshot(doc(db, 'users', userId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as User);
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('User subscription error:', err);
  });
}

// --- PODS ---
export function subscribeToPods(callback: (pods: Pod[]) => void) {
  return onSnapshot(collection(db, 'pods'), (snapshot) => {
    const pods: Pod[] = [];
    snapshot.forEach((docSnap) => pods.push(docSnap.data() as Pod));
    callback(pods);
  }, (err) => {
    console.error('Pods subscription error:', err);
  });
}

export async function savePodToFirestore(pod: Pod): Promise<void> {
  try {
    await setDoc(doc(db, 'pods', pod.id), sanitizeForFirestore(pod), { merge: true });
  } catch (err) {
    console.error('Error saving pod to Firestore:', err);
  }
}

// --- PERKS ---
export function subscribeToPerks(callback: (perks: Perk[]) => void) {
  return onSnapshot(collection(db, 'perks'), (snapshot) => {
    const perks: Perk[] = [];
    snapshot.forEach((docSnap) => perks.push(docSnap.data() as Perk));
    callback(perks);
  }, (err) => {
    console.error('Perks subscription error:', err);
  });
}

export async function savePerkToFirestore(perk: Perk): Promise<void> {
  try {
    const cleanPerk = sanitizeForFirestore(perk);
    await setDoc(doc(db, 'perks', cleanPerk.id), cleanPerk, { merge: true });
    console.log(`Perk ${cleanPerk.id} saved to Firestore successfully.`);
  } catch (err) {
    console.error('Error saving perk to Firestore:', err);
  }
}

export async function deletePerkFromFirestore(perkId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'perks', perkId));
  } catch (err) {
    console.error('Error deleting perk from Firestore:', err);
  }
}

// --- AUDIT LOGS ---
export function subscribeToAuditLogs(callback: (logs: AuditLogEntry[]) => void) {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const logs: AuditLogEntry[] = [];
    snapshot.forEach((docSnap) => logs.push(docSnap.data() as AuditLogEntry));
    callback(logs);
  }, (err) => {
    console.error('Audit logs subscription error:', err);
  });
}

export async function addAuditLogToFirestore(log: AuditLogEntry): Promise<void> {
  try {
    await setDoc(doc(db, 'auditLogs', log.id), sanitizeForFirestore(log));
  } catch (err) {
    console.error('Error adding audit log to Firestore:', err);
  }
}

// --- REDEMPTIONS ---
export async function addRedemptionToFirestore(redemption: Redemption): Promise<void> {
  try {
    await setDoc(doc(db, 'redemptions', redemption.id), sanitizeForFirestore(redemption));
  } catch (err) {
    console.error('Error adding redemption to Firestore:', err);
  }
}
