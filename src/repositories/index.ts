import { 
  User, Pod, PodMembership, Deposit, ReprioritizationRequest, 
  AuditLogEntry, Perk, Redemption, WeeklyCycle,
  KYCStatus, PodStatus, DelinquencyStatus, ReprioritizationStatus,
  PodSizeTier, DepositTier
} from '../types';
import { getDb, COLLECTIONS } from '../config/firebase';
import { Timestamp, WriteBatch, Transaction, DocumentReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Helper to convert Firestore timestamps to ISO strings
function serializeDoc<T extends Record<string, any>>(doc: QueryDocumentSnapshot): T {
  const data = doc.data();
  const result: Record<string, any> = { id: doc.id, ...data };
  
  // Convert Firestore Timestamps to ISO strings
  for (const [key, value] of Object.entries(result)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    }
  }
  
  return result as T;
}

// Helper to prepare data for Firestore (convert dates to Timestamps)
function prepareForFirestore<T extends Record<string, any>>(data: T): T {
  const result: Record<string, any> = { ...data };
  
  for (const [key, value] of Object.entries(result)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      // ISO string dates - convert to Timestamp
      result[key] = Timestamp.fromDate(new Date(value));
    }
  }
  
  return result as T;
}

// Base Repository Class
export abstract class BaseRepository<T extends { id: string }> {
  protected abstract collectionName: string;
  
  protected get collection() {
    return getDb().collection(this.collectionName);
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const docRef = this.collection.doc();
    const now = Timestamp.now();
    const docData = prepareForFirestore({
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    });
    await docRef.set(docData);
    return { id: docRef.id, ...data } as T;
  }

  async createWithId(id: string, data: Omit<T, 'id'>): Promise<T> {
    const docRef = this.collection.doc(id);
    const now = Timestamp.now();
    const docData = prepareForFirestore({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    });
    await docRef.set(docData);
    return { id, ...data } as T;
  }

  async getById(id: string): Promise<T | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return serializeDoc<T>(doc);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    
    const updateData = prepareForFirestore({
      ...data,
      updatedAt: Timestamp.now(),
    });
    await docRef.update(updateData);
    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  async list(limitCount = 100, offset = 0): Promise<T[]> {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .offset(offset)
      .get();
    return snapshot.docs.map(doc => serializeDoc<T>(doc));
  }

  async query(filters: Array<{ field: string; operator: any; value: any }>, limitCount = 100): Promise<T[]> {
    let query: any = this.collection;
    for (const filter of filters) {
      query = query.where(filter.field, filter.operator, filter.value);
    }
    query = query.orderBy('createdAt', 'desc').limit(limitCount);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => serializeDoc<T>(doc));
  }

  async runTransaction<U>(updateFn: (transaction: Transaction) => Promise<U>): Promise<U> {
    return getDb().runTransaction(updateFn);
  }

  getBatch(): WriteBatch {
    return getDb().batch();
  }

  async commitBatch(batch: WriteBatch): Promise<void> {
    await batch.commit();
  }
}

// User Repository
export class UserRepository extends BaseRepository<User> {
  protected collectionName = COLLECTIONS.USERS;

  async getByEmail(email: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return serializeDoc<User>(snapshot.docs[0]);
  }

  async getByStripeAccountId(stripeAccountId: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('treasury.stripeAccountId', '==', stripeAccountId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return serializeDoc<User>(snapshot.docs[0]);
  }

  async updateKycStatus(userId: string, status: KYCStatus, verifiedAt?: string): Promise<User | null> {
    return this.update(userId, { 
      kycStatus: status, 
      kycVerifiedAt: verifiedAt 
    } as Partial<User>);
  }

  async updateTreasuryBalance(userId: string, amount: number): Promise<User | null> {
    const user = await this.getById(userId);
    if (!user) return null;
    return this.update(userId, {
      treasury: {
        ...user.treasury,
        balanceUsd: user.treasury.balanceUsd + amount,
      }
    } as Partial<User>);
  }

  async incrementCompletedPods(userId: string): Promise<User | null> {
    const user = await this.getById(userId);
    if (!user) return null;
    return this.update(userId, {
      completedPodsCount: user.completedPodsCount + 1,
    } as Partial<User>);
  }
}

// Pod Repository
export class PodRepository extends BaseRepository<Pod> {
  protected collectionName = COLLECTIONS.PODS;

  async getByStatus(status: PodStatus): Promise<Pod[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Pod>(doc));
  }

  async getByCreator(creatorId: string): Promise<Pod[]> {
    const snapshot = await this.collection
      .where('createdBy', '==', creatorId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Pod>(doc));
  }

  async getUserPods(userId: string): Promise<Pod[]> {
    const snapshot = await this.collection
      .where('members', 'array-contains', { userId })
      .get();
    return snapshot.docs.map(doc => serializeDoc<Pod>(doc));
  }

  async addMember(podId: string, member: PodMembership): Promise<Pod | null> {
    return this.runTransaction(async (transaction) => {
      const podRef = this.collection.doc(podId);
      const podDoc = await transaction.get(podRef);
      if (!podDoc.exists) throw new Error('Pod not found');
      
      const pod = serializeDoc<Pod>(podDoc);
      const updatedMembers = [...pod.members, member];
      
      transaction.update(podRef, { 
        members: updatedMembers,
        updatedAt: Timestamp.now(),
      });
      
      return { ...pod, members: updatedMembers };
    });
  }

  async updateMember(podId: string, userId: string, updates: Partial<PodMembership>): Promise<Pod | null> {
    return this.runTransaction(async (transaction) => {
      const podRef = this.collection.doc(podId);
      const podDoc = await transaction.get(podRef);
      if (!podDoc.exists) throw new Error('Pod not found');
      
      const pod = serializeDoc<Pod>(podDoc);
      const memberIndex = pod.members.findIndex(m => m.userId === userId);
      if (memberIndex === -1) throw new Error('Member not found');
      
      const updatedMembers = [...pod.members];
      updatedMembers[memberIndex] = { ...updatedMembers[memberIndex], ...updates };
      
      transaction.update(podRef, { 
        members: updatedMembers,
        updatedAt: Timestamp.now(),
      });
      
      return { ...pod, members: updatedMembers };
    });
  }

  async updateStatus(podId: string, status: PodStatus, additionalData?: Partial<Pod>): Promise<Pod | null> {
    return this.update(podId, { status, ...additionalData } as Partial<Pod>);
  }

  async incrementWeeklyCollected(podId: string, amount: number): Promise<Pod | null> {
    return this.runTransaction(async (transaction) => {
      const podRef = this.collection.doc(podId);
      const podDoc = await transaction.get(podRef);
      if (!podDoc.exists) throw new Error('Pod not found');
      
      const pod = serializeDoc<Pod>(podDoc);
      transaction.update(podRef, { 
        currentWeeklyCollected: pod.currentWeeklyCollected + amount,
        updatedAt: Timestamp.now(),
      });
      
      return { ...pod, currentWeeklyCollected: pod.currentWeeklyCollected + amount };
    });
  }

  async resetWeeklyCollected(podId: string): Promise<Pod | null> {
    return this.update(podId, { currentWeeklyCollected: 0 } as Partial<Pod>);
  }

  async advanceCycle(podId: string): Promise<Pod | null> {
    return this.runTransaction(async (transaction) => {
      const podRef = this.collection.doc(podId);
      const podDoc = await transaction.get(podRef);
      if (!podDoc.exists) throw new Error('Pod not found');
      
      const pod = serializeDoc<Pod>(podDoc);
      const nextWeek = pod.currentCycleWeek + 1;
      const isCompleted = nextWeek > pod.totalCycles;
      
      transaction.update(podRef, { 
        currentCycleWeek: nextWeek,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        currentWeeklyCollected: 0,
        updatedAt: Timestamp.now(),
      });
      
      return { 
        ...pod, 
        currentCycleWeek: nextWeek,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        currentWeeklyCollected: 0,
      };
    });
  }

  async lockRotation(podId: string, shuffledMembers: PodMembership[]): Promise<Pod | null> {
    return this.update(podId, { 
      members: shuffledMembers,
      status: 'ACTIVE',
      cycleStartDate: new Date().toISOString(),
    } as Partial<Pod>);
  }
}

// Deposit Repository
export class DepositRepository extends BaseRepository<Deposit> {
  protected collectionName = COLLECTIONS.DEPOSITS;

  async getByPodAndCycle(podId: string, cycleId: string): Promise<Deposit[]> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .where('cycleId', '==', cycleId)
      .orderBy('createdAt', 'asc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Deposit>(doc));
  }

  async getByMembership(membershipId: string): Promise<Deposit[]> {
    const snapshot = await this.collection
      .where('membershipId', '==', membershipId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Deposit>(doc));
  }

  async getByUser(userId: string): Promise<Deposit[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Deposit>(doc));
  }

  async getTotalCollectedForCycle(podId: string, cycleId: string): Promise<number> {
    const deposits = await this.getByPodAndCycle(podId, cycleId);
    return deposits
      .filter(d => d.status === 'COMPLETE')
      .reduce((sum, d) => sum + d.amount, 0);
  }
}

// Reprioritization Request Repository
export class ReprioritizationRequestRepository extends BaseRepository<ReprioritizationRequest> {
  protected collectionName = COLLECTIONS.REPRIORITIZATION_REQUESTS;

  async getByPod(podId: string): Promise<ReprioritizationRequest[]> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<ReprioritizationRequest>(doc));
  }

  async getPendingByPod(podId: string): Promise<ReprioritizationRequest[]> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .where('status', '==', 'PENDING')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<ReprioritizationRequest>(doc));
  }

  async addVote(requestId: string, userId: string, vote: 'FOR' | 'AGAINST'): Promise<ReprioritizationRequest | null> {
    return this.runTransaction(async (transaction) => {
      const requestRef = this.collection.doc(requestId);
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists) throw new Error('Request not found');
      
      const request = serializeDoc<ReprioritizationRequest>(requestDoc);
      if (request.votedUserIds.includes(userId)) {
        throw new Error('Already voted');
      }
      
      const updatedVotes = vote === 'FOR' 
        ? { votesFor: request.votesFor + 1 }
        : { votesAgainst: request.votesAgainst + 1 };
      
      transaction.update(requestRef, { 
        ...updatedVotes,
        votedUserIds: [...request.votedUserIds, userId],
        updatedAt: Timestamp.now(),
      });
      
      return { ...request, ...updatedVotes, votedUserIds: [...request.votedUserIds, userId] };
    });
  }

  async decide(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<ReprioritizationRequest | null> {
    return this.update(requestId, { 
      status, 
      decidedAt: new Date().toISOString() 
    } as Partial<ReprioritizationRequest>);
  }
}

// Audit Log Repository
export class AuditLogRepository extends BaseRepository<AuditLogEntry> {
  protected collectionName = COLLECTIONS.AUDIT_LOGS;

  async getByPod(podId: string, limitCount = 100): Promise<AuditLogEntry[]> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();
    return snapshot.docs.map(doc => serializeDoc<AuditLogEntry>(doc));
  }

  async getByActor(actorId: string, limitCount = 100): Promise<AuditLogEntry[]> {
    const snapshot = await this.collection
      .where('actorId', '==', actorId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();
    return snapshot.docs.map(doc => serializeDoc<AuditLogEntry>(doc));
  }

  async getByAction(action: AuditLogEntry['action'], limitCount = 100): Promise<AuditLogEntry[]> {
    const snapshot = await this.collection
      .where('action', '==', action)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();
    return snapshot.docs.map(doc => serializeDoc<AuditLogEntry>(doc));
  }
}

// Perk Repository
export class PerkRepository extends BaseRepository<Perk> {
  protected collectionName = COLLECTIONS.PERKS;

  async getApproved(category?: string, search?: string): Promise<Perk[]> {
    let query: any = this.collection.where('status', '==', 'APPROVED');
    
    if (category && category !== 'All') {
      query = query.where('category', '==', category);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    let perks = snapshot.docs.map(doc => serializeDoc<Perk>(doc));
    
    if (search) {
      const q = search.toLowerCase();
      perks = perks.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.provider.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    
    return perks;
  }

  async getPending(): Promise<Perk[]> {
    const snapshot = await this.collection
      .where('status', '==', 'PENDING')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Perk>(doc));
  }

  async approve(perkId: string): Promise<Perk | null> {
    return this.update(perkId, { status: 'APPROVED' } as Partial<Perk>);
  }

  async incrementRedeemedCount(perkId: string): Promise<Perk | null> {
    return this.runTransaction(async (transaction) => {
      const perkRef = this.collection.doc(perkId);
      const perkDoc = await transaction.get(perkRef);
      if (!perkDoc.exists) throw new Error('Perk not found');
      
      const perk = serializeDoc<Perk>(perkDoc);
      transaction.update(perkRef, { 
        redeemedCount: perk.redeemedCount + 1,
        updatedAt: Timestamp.now(),
      });
      
      return { ...perk, redeemedCount: perk.redeemedCount + 1 };
    });
  }
}

// Redemption Repository
export class RedemptionRepository extends BaseRepository<Redemption> {
  protected collectionName = COLLECTIONS.REDEMPTIONS;

  async getByUser(userId: string): Promise<Redemption[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('redeemedAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Redemption>(doc));
  }

  async getByPerk(perkId: string): Promise<Redemption[]> {
    const snapshot = await this.collection
      .where('perkId', '==', perkId)
      .orderBy('redeemedAt', 'desc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<Redemption>(doc));
  }
}

// Weekly Cycle Repository
export class WeeklyCycleRepository extends BaseRepository<WeeklyCycle> {
  protected collectionName = COLLECTIONS.WEEKLY_CYCLES;

  async getByPod(podId: string): Promise<WeeklyCycle[]> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .orderBy('weekNumber', 'asc')
      .get();
    return snapshot.docs.map(doc => serializeDoc<WeeklyCycle>(doc));
  }

  async getCurrentCycle(podId: string): Promise<WeeklyCycle | null> {
    const snapshot = await this.collection
      .where('podId', '==', podId)
      .where('status', '==', 'COLLECTING')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return serializeDoc<WeeklyCycle>(snapshot.docs[0]);
  }
}

// Idempotency Key Repository
export class IdempotencyRepository extends BaseRepository<{ id: string; key: string; response: any; expiresAt: string }> {
  protected collectionName = COLLECTIONS.IDEMPOTENCY_KEYS;

  async checkAndStore(key: string, response: any, ttlMinutes = 60): Promise<{ isNew: boolean; response: any }> {
    const existing = await this.collection.doc(key).get();
    if (existing.exists) {
      const data = existing.data();
      return { isNew: false, response: data?.response };
    }
    
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    await this.collection.doc(key).set({
      key,
      response,
      expiresAt,
      createdAt: Timestamp.now(),
    });
    
    return { isNew: true, response };
  }

  async cleanup(): Promise<number> {
    const now = Timestamp.now();
    const snapshot = await this.collection
      .where('expiresAt', '<', now)
      .get();
    
    const batch = getDb().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    return snapshot.size;
  }
}

// Export singleton instances
export const userRepository = new UserRepository();
export const podRepository = new PodRepository();
export const depositRepository = new DepositRepository();
export const reprioritizationRequestRepository = new ReprioritizationRequestRepository();
export const auditLogRepository = new AuditLogRepository();
export const perkRepository = new PerkRepository();
export const redemptionRepository = new RedemptionRepository();
export const weeklyCycleRepository = new WeeklyCycleRepository();
export const idempotencyRepository = new IdempotencyRepository();