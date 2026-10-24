import type { Role } from "@prisma/client";

export const roleRank: Record<Role, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function isRoleAtLeast(role: Role, minRole: Role) {
  return roleRank[role] >= roleRank[minRole];
}
