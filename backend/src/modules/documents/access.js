export function canAccessDocument(document, user) {
  if (!document?.isActive) return false;
  if (document.visibility === 'PUBLIC') return true;
  if (!user?.id) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  if (document.visibility === 'PRIVATE') return document.ownerId === user.id;
  return Boolean(user.jobRole) && Array.isArray(document.accessJobRoles) && document.accessJobRoles.includes(user.jobRole);
}
