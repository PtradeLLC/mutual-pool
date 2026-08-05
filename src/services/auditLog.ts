import { getDb, COLLECTIONS, timestampToISO } from '../config/firebase';
import { AuditLogEntry } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

export async function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
  const db = getDb();
  
  const auditEntry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    ...entry,
    createdAt: new Date().toISOString(),
  };
  
  // Convert dates to Timestamps for Firestore
  const firestoreData = {
    ...auditEntry,
    createdAt: Timestamp.fromDate(new Date(auditEntry.createdAt)),
  };
  
  await db.collection(COLLECTIONS.AUDIT_LOGS).doc(auditEntry.id).set(firestoreData);
  
  return auditEntry;
}

export async function getAuditLogs(filters?: {
  podId?: string;
  actorId?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const db = getDb();
  let query: any = db.collection(COLLECTIONS.AUDIT_LOGS).orderBy('createdAt', 'desc');
  
  if (filters?.podId) {
    query = query.where('podId', '==', filters.podId);
  }
  if (filters?.actorId) {
    query = query.where('actorId', '==', filters.actorId);
  }
  if (filters?.action) {
    query = query.where('action', '==', filters.action);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    } as AuditLogEntry;
  });
}