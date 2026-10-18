// Firebase Admin: used only to verify members' sign-in tokens (Firebase Auth).
// Application data lives in Postgres (src/server/storage); nothing here touches
// a database.
//
// Verifying ID tokens needs only the project id and Google's public
// certificates, so no service account is required. FIREBASE_SERVICE_ACCOUNT is
// still honoured if set (e.g. for scripts/set-admin-claim.ts, which needs
// privileged access to set custom claims).
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

function loadOptionalLocalConfig(): { projectId?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const local = require('../../firebase-applet-config.json');
    return { projectId: local?.projectId };
  } catch {
    return {};
  }
}

let app: App | null = null;
let auth: Auth | null = null;

export function initializeFirebase(): void {
  try {
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : undefined;
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || loadOptionalLocalConfig().projectId;
      app = serviceAccount ? initializeApp({ credential: cert(serviceAccount), projectId }) : initializeApp({ projectId });
    }
    if (app) {
      try { auth = getAuth(app); } catch { /* reported by getAuthAdmin() returning null */ }
    }
  } catch (err) {
    console.error('[Firebase Admin] initialisation failed:', err instanceof Error ? err.message : err);
  }
}

export function getAuthAdmin(): Auth | null {
  if (!auth) initializeFirebase();
  return auth || null;
}
