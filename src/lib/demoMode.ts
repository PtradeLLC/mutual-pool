// Client-side counterpart of the server's DEMO_MODE: enables simulated KYC,
// direct top-ups and other demo-only UI. Never active in production builds.
export const CLIENT_DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';
