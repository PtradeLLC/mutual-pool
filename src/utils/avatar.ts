// Default avatar: initials rendered by ui-avatars, never a stock photo of a
// real-looking person. Shared by the client and the server.
export function avatarUrlFor(displayName?: string | null, existingUrl?: string | null): string {
  if (existingUrl && /^https?:\/\//i.test(existingUrl) && !existingUrl.includes('images.unsplash.com')) return existingUrl;
  const name = (displayName || 'Member').trim() || 'Member';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=005FB8&color=fff&size=200`;
}
