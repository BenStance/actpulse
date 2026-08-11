import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { PasswordOtp } from '../auth/password-otp.entity';
import { Device } from '../devices/device.entity';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AssignDevicesDto } from './dto/assign-devices.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(PasswordOtp)
    private readonly otpRepository: Repository<PasswordOtp>,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateUserDto) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin users are seeded by system bootstrap');
    }
    if (dto.role === UserRole.USER) {
      throw new BadRequestException('User role is disabled. Only Controller can be invited');
    }

    const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const devices = await this.devicesRepository.findBy({ id: In(dto.deviceIds) });
    if (devices.length < 1) {
      throw new BadRequestException('User must be assigned at least one valid device');
    }

    const user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isActive: true,
      isActivated: false,
      password: null,
      devices,
      tokenVersion: 0,
    });

    const saved = await this.usersRepository.save(user);
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const token = this.authService.generateActivationToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.otpRepository.save(
      this.otpRepository.create({
        userId: saved.id,
        email: saved.email,
        otpCode: otp,
        token,
        purpose: OtpPurpose.USER_INVITATION,
        expiresAt,
        used: false,
      }),
    );

    await this.mailService.sendUserInvitation(saved.email, otp, token);

    return {
      message: 'User invited successfully',
      userId: saved.id,
      activationToken: token,
    };
  }

  async activateUser(dto: ActivateUserDto) {
    const user = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpEntry = await this.otpRepository.findOne({
      where: {
        userId: user.id,
        otpCode: dto.otp,
        purpose: OtpPurpose.USER_INVITATION,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpEntry || otpEntry.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired activation OTP');
    }

    if (otpEntry.token && dto.token && otpEntry.token !== dto.token) {
      throw new BadRequestException('Invalid activation token');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.isActivated = true;
    await this.usersRepository.save(user);

    otpEntry.used = true;
    await this.otpRepository.save(otpEntry);

    return { message: 'User activated successfully' };
  }

  findAll() {
    return this.usersRepository.find({ relations: ['devices'] });
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id }, relations: ['devices'] });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (dto.deviceIds && dto.deviceIds.length > 0) {
      const devices = await this.devicesRepository.findBy({ id: In(dto.deviceIds) });
      if (devices.length < 1) {
        throw new BadRequestException('At least one valid device is required');
      }
      user.devices = devices;
    }

    if (dto.name) user.name = dto.name;
    if (dto.role) {
      if (dto.role === UserRole.USER) {
        throw new BadRequestException('User role is disabled. Use Controller role');
      }
      user.role = dto.role;
    }

    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);
    user.isActive = false;
    user.tokenVersion += 1;
    await this.usersRepository.save(user);
    return { message: 'User deactivated successfully' };
  }

  async assignDevices(id: string, dto: AssignDevicesDto) {
    const user = await this.findOne(id);
    const devices = await this.devicesRepository.findBy({ id: In(dto.deviceIds) });
    if (devices.length < 1) {
      throw new BadRequestException('At least one valid device is required');
    }
    user.devices = devices;
    await this.usersRepository.save(user);
    return this.findOne(id);
  }
}


