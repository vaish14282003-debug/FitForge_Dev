const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  GYM_OWNER: 'GYM_OWNER',
  TRAINER: 'TRAINER',
  STAFF: 'STAFF',
  MEMBER: 'MEMBER',
});

const PERMISSIONS = Object.freeze({
  PROFILE_READ_OWN: 'profile:read:own',
  PROFILE_UPDATE_OWN: 'profile:update:own',
  WORKOUT_CREATE: 'workout:create',
  WORKOUT_ASSIGN: 'workout:assign',
  CLIENTS_READ_ASSIGNED: 'clients:read:assigned',
  MEMBERS_MANAGE: 'members:manage',
  TRAINERS_MANAGE: 'trainers:manage',
  REVENUE_READ: 'revenue:read',
  GYM_SETTINGS: 'gym:settings',
});

const P = PERMISSIONS;
const own = [P.PROFILE_READ_OWN, P.PROFILE_UPDATE_OWN];

// Single source of truth for what each role may do. Routes check permissions, never role names.
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: Object.values(P),
  [ROLES.GYM_OWNER]: Object.values(P),
  [ROLES.TRAINER]: [...own, P.WORKOUT_CREATE, P.WORKOUT_ASSIGN, P.CLIENTS_READ_ASSIGNED],
  [ROLES.STAFF]: [...own, P.MEMBERS_MANAGE],
  [ROLES.MEMBER]: own,
});

const permissionsFor = (role) => ROLE_PERMISSIONS[role] || [];
const can = (role, permission) => permissionsFor(role).includes(permission);

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, permissionsFor, can };
