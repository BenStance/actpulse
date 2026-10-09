import { User } from './user.entity';

export function accountSummary(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    isActivated: user.isActivated,
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          isActive: user.organization.isActive,
        }
      : null,
    equipmentIds: user.equipment?.map((equipment) => equipment.id) ?? [],
    deviceIds:
      user.equipment?.flatMap(
        (equipment) =>
          equipment.monitors
            ?.filter((device) => device.currentEquipmentId === equipment.id)
            .map((device) => device.id) ?? [],
      ) ?? [],
  };
}

export function managedUserSummary(user: User) {
  return {
    ...accountSummary(user),
    equipment:
      user.equipment?.map((equipment) => ({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        siteId: equipment.siteId,
        organizationId: equipment.organizationId,
      })) ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
