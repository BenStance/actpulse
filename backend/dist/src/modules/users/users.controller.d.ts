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
    create(dto: CreateUserDto): Promise<{
        message: string;
        userId: string;
        activationToken: string;
    }>;
    findAll(): Promise<import("./user.entity").User[]>;
    findOne(id: string): Promise<import("./user.entity").User>;
    update(id: string, dto: UpdateUserDto): Promise<import("./user.entity").User>;
    deactivate(id: string): Promise<{
        message: string;
    }>;
    assignDevices(id: string, dto: AssignDevicesDto): Promise<import("./user.entity").User>;
}
