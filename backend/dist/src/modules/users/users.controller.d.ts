import { UserRole } from '../../common/enums/user-role.enum';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AssignDevicesDto } from './dto/assign-devices.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    activate(dto: ActivateUserDto): Promise<{
        message: string;
    }>;
    create(dto: CreateUserDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    findAll(search?: string, organizationId?: string, page?: string, pageSize?: string): Promise<{
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
    deactivate(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    reactivate(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    resend(id: string): Promise<{
        message: string;
    }>;
    assignDevices(id: string, dto: AssignDevicesDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
}
