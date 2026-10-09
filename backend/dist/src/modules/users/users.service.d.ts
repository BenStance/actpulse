import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthRateLimiterService } from '../auth/auth-rate-limiter.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { EntitlementService } from '../billing/entitlement.service';
import { AuditTrailService } from '../billing/audit-trail.service';
import { Device } from '../devices/device.entity';
import { Equipment } from '../equipment/equipment.entity';
import { MailService } from '../mail/mail.service';
import { Organization } from '../organizations/organization.entity';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AssignDevicesDto } from './dto/assign-devices.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
export declare class UsersService {
    private readonly users;
    private readonly devices;
    private readonly equipment;
    private readonly organizations;
    private readonly dataSource;
    private readonly mail;
    private readonly sessions;
    private readonly rate;
    private readonly entitlements;
    private readonly auditTrail;
    constructor(users: Repository<User>, devices: Repository<Device>, equipment: Repository<Equipment>, organizations: Repository<Organization>, dataSource: DataSource, mail: MailService, sessions: AuthSessionService, rate: AuthRateLimiterService, entitlements: EntitlementService, auditTrail: AuditTrailService);
    create(dto: CreateUserDto, actorId?: string): Promise<{
        message: string;
        user: {
            equipment: {
                id: string;
                name: string;
                type: import("../equipment/equipment.entity").EquipmentType;
                siteId: string;
                organizationId: string;
            }[];
            createdAt: Date;
            updatedAt: Date;
            id: string;
            name: string;
            email: string;
            role: UserRole;
            organizationId: string | null;
            isActive: boolean;
            isActivated: boolean;
            organization: {
                id: string;
                name: string;
                isActive: boolean;
            } | null;
            equipmentIds: string[];
            deviceIds: string[];
        };
    }>;
    resendInvitation(id: string): Promise<{
        message: string;
    }>;
    activateUser(dto: ActivateUserDto): Promise<{
        message: string;
    }>;
    findAll(search?: string, organizationId?: string, rawPage?: number, rawPageSize?: number): Promise<{
        items: {
            equipment: {
                id: string;
                name: string;
                type: import("../equipment/equipment.entity").EquipmentType;
                siteId: string;
                organizationId: string;
            }[];
            createdAt: Date;
            updatedAt: Date;
            id: string;
            name: string;
            email: string;
            role: UserRole;
            organizationId: string | null;
            isActive: boolean;
            isActivated: boolean;
            organization: {
                id: string;
                name: string;
                isActive: boolean;
            } | null;
            equipmentIds: string[];
            deviceIds: string[];
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    findOne(id: string): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            siteId: string;
            organizationId: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        name: string;
        email: string;
        role: UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            siteId: string;
            organizationId: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        name: string;
        email: string;
        role: UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    deactivate(id: string, actorId?: string): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            siteId: string;
            organizationId: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        name: string;
        email: string;
        role: UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    reactivate(id: string, actorId?: string): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            siteId: string;
            organizationId: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        name: string;
        email: string;
        role: UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    assignDevices(id: string, dto: AssignDevicesDto, actorId?: string): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            siteId: string;
            organizationId: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        name: string;
        email: string;
        role: UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    private validEquipment;
    private userEntity;
}
