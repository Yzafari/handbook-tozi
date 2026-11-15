export function buildSearchAccessFilter(user = null) {
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return [];
  const allowed = [{ term: { visibility: 'PUBLIC' } }];
  if (user?.id) allowed.push({ bool: { filter: [{ term: { visibility: 'PRIVATE' } }, { term: { ownerId: user.id } }] } });
  if (user?.jobRole) allowed.push({ bool: { filter: [{ term: { visibility: 'ROLE_RESTRICTED' } }, { term: { accessJobRoles: user.jobRole } }] } });
  return [{ bool: { should: allowed, minimum_should_match: 1 } }];
}
