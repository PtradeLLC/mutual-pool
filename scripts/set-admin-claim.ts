// Grant or revoke the `admin` custom claim that the server uses for admin access.
//
//   npx tsx scripts/set-admin-claim.ts someone@example.com          # grant
//   npx tsx scripts/set-admin-claim.ts someone@example.com --revoke # revoke
//
// Needs Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT or
// GOOGLE_APPLICATION_CREDENTIALS) and FIREBASE_PROJECT_ID. The user must sign
// out and back in (or wait up to an hour) for the new claim to reach their token.
import 'dotenv/config';
import { getAuthAdmin, hasFirestoreCredentials } from '../src/config/firebase';

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: npx tsx scripts/set-admin-claim.ts <email> [--revoke]');
    process.exit(1);
  }
  if (!hasFirestoreCredentials()) {
    console.error([
      'Firebase Admin credentials are missing.',
      'Add a service account to .env:',
      '  1. Firebase console -> Project settings -> Service accounts -> Generate new private key',
      '  2. Put the downloaded JSON on ONE line in .env:  FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}',
      '     (or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json)',
    ].join('\n'));
    process.exit(1);
  }
  const auth = getAuthAdmin();
  if (!auth) throw new Error('Firebase Admin is not configured.');

  // The user must have signed in to the app at least once so the account exists.
  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };
  if (flag === '--revoke') {
    delete claims.admin;
  } else {
    claims.admin = true;
  }
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`${flag === '--revoke' ? 'Revoked' : 'Granted'} admin for ${email} (uid ${user.uid}).`);
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
