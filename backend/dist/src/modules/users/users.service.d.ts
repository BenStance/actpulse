import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { PasswordOtp } from '../auth/password-otp.entity';
import { Device } from '../devices/device.entity';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AssignDevicesDto } from './dto/assign-devices.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
export declare class UsersService {
    private readonly usersRepository;
    private readonly devicesRepository;
    private readonly otpRepository;
    private readonly authService;
    private readonly mailService;
    constructor(usersRepository: Repository<User>, devicesRepository: Repository<Device>, otpRepository: Repository<PasswordOtp>, authService: AuthService, mailService: MailService);
    create(dto: CreateUserDto): Promise<{
        message: string;
        userId: string;
        activationToken: string;
    }>;
    activateUser(dto: ActivateUserDto): Promise<{
        message: string;
    }>;
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User>;
    update(id: string, dto: UpdateUserDto): Promise<User>;
    deactivate(id: string): Promise<{
        message: string;
    }>;
    assignDevices(id: string, dto: AssignDevicesDto): Promise<User>;
}
