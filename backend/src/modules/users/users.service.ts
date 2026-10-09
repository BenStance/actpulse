import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { isUUID } from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { validateNewPassword } from '../../common/security/password';
import { AuthRateLimiterService } from '../auth/auth-rate-limiter.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { EntitlementService } from '../billing/entitlement.service';
import { AuditTrailService } from '../billing/audit-trail.service';
import {
  invitationHash,
  newInvitationToken,
  newOtp,
  otpHash,
} from '../auth/credential-hash';
import { PasswordOtp } from '../auth/password-otp.entity';
import { Device } from '../devices/device.entity';
import { Equipment } from '../equipment/equipment.entity';
import { MailService } from '../mail/mail.service';
import { Organization } from '../organizations/organization.entity';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AssignDevicesDto } from './dto/assign-devices.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
import { managedUserSummary } from './user-response';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly sessions: AuthSessionService,
    private readonly rate: AuthRateLimiterService,
    private readonly entitlements: EntitlementService,
    private readonly auditTrail: AuditTrailService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string) {
    const email = dto.email.trim().toLowerCase();
    const organization = await this.organizations.findOne({
      where: { id: dto.organizationId, isActive: true },
    });
    if (!organization)
      throw new BadRequestException('Active organization required');
    if (await this.users.exists({ where: { email } }))
      throw new BadRequestException('Email already exists');
    const assignedEquipment = await this.validEquipment(
      dto.equipmentIds,
      dto.deviceIds,
      organization.id,
    );
    const otp = newOtp();
    const token = newInvitationToken();
    const userId = await this.dataSource.transaction(async (manager) => {
      await this.entitlements.lockAndCheck(
        organization.id,
        'controllers',
        manager,
      );
      const user = await manager.save(
        User,
        manager.create(User, {
          name: dto.name.trim(),
          email,
          role: UserRole.CONTROLLER,
          organizationId: organization.id,
          equipment: assignedEquipment,
          isActive: true,
          isActivated: false,
          password: null,
          tokenVersion: 0,
        }),
      );
      await manager.save(
        PasswordOtp,
        manager.create(PasswordOtp, {
          userId: user.id,
          email,
          otpCode: otpHash(OtpPurpose.USER_INVITATION, email, otp),
          token: invitationHash(token),
          purpose: OtpPurpose.USER_INVITATION,
          expiresAt: new Date(Date.now() + 30 * 60_000),
          used: false,
          failedAttempts: 0,
        }),
      );
      await this.auditTrail.record(
        {
          actorId,
          actorRole: 'Admin',
          organizationId: organization.id,
          action: 'USER_INVITED',
          entityType: 'user',
          entityId: user.id,
          after: {
            role: 'Controller',
            isActive: true,
            assignmentCount: assignedEquipment.length,
          },
        },
        manager,
      );
      try {
        await this.mail.sendUserInvitation(email, otp, token);
      } catch {
        throw new ServiceUnavailableException(
          'Invitation could not be delivered',
        );
      }
      return user.id;
    });
    return { message: 'Controller invited', user: await this.findOne(userId) };
  }

  async resendInvitation(id: string) {
    const user = await this.userEntity(id);
    if (
      user.role !== UserRole.CONTROLLER ||
      user.isActivated ||
      !user.isActive ||
      !user.organization?.isActive
    ) {
      throw new BadRequestException(
        'Only active pending Controllers can receive another invitation',
      );
    }
    this.rate.check('request', `invitation:${id}`);
    const otp = newOtp();
    const token = newInvitationToken();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        PasswordOtp,
        { userId: id, purpose: OtpPurpose.USER_INVITATION, used: false },
        { used: true },
      );
      await manager.save(
        PasswordOtp,
        manager.create(PasswordOtp, {
          userId: id,
          email: user.email,
          otpCode: otpHash(OtpPurpose.USER_INVITATION, user.email, otp),
          token: invitationHash(token),
          purpose: OtpPurpose.USER_INVITATION,
          expiresAt: new Date(Date.now() + 30 * 60_000),
          used: false,
          failedAttempts: 0,
        }),
      );
      try {
        await this.mail.sendUserInvitation(user.email, otp, token);
      } catch {
        throw new ServiceUnavailableException(
          'Invitation could not be delivered',
        );
      }
    });
    return { message: 'Invitation resent' };
  }

  async activateUser(dto: ActivateUserDto) {
    const email = dto.email.trim().toLowerCase();
    this.rate.check('verify', `invitation:${email}`);
    validateNewPassword(dto.password);
    const user = await this.users.findOne({
      where: { email },
      relations: ['organization'],
    });
    if (
      !user ||
      user.role !== UserRole.CONTROLLER ||
      !user.isActive ||
      user.isActivated ||
      !user.organization?.isActive
    ) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    const activated = await this.dataSource.transaction(async (manager) => {
      const entry = await manager.getRepository(PasswordOtp).findOne({
        where: {
          userId: user.id,
          purpose: OtpPurpose.USER_INVITATION,
          used: false,
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry || entry.expiresAt.getTime() < Date.now()) return false;
      const maxAttempts = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? 5);
      if (entry.failedAttempts >= maxAttempts) return false;
      if (
        entry.otpCode !== otpHash(OtpPurpose.USER_INVITATION, email, dto.otp) ||
        entry.token !== invitationHash(dto.token)
      ) {
        entry.failedAttempts += 1;
        if (entry.failedAttempts >= maxAttempts) entry.used = true;
        await manager.save(entry);
        return false;
      }
      await manager.update(User, user.id, {
        password: await bcrypt.hash(dto.password, 12),
        isActivated: true,
        tokenVersion: user.tokenVersion + 1,
      });
      await manager.update(
        PasswordOtp,
        { userId: user.id, purpose: OtpPurpose.USER_INVITATION, used: false },
        { used: true },
      );
      await this.auditTrail.record(
        {
          actorId: user.id,
          actorRole: 'Controller',
          organizationId: user.organizationId,
          action: 'USER_ACTIVATED',
          entityType: 'user',
          entityId: user.id,
          after: { isActive: true },
        },
        manager,
      );
      return true;
    });
    if (!activated)
      throw new BadRequestException('Invalid or expired invitation');
    this.sessions.invalidateUser(user.id);
    return { message: 'User activated successfully' };
  }

  async findAll(
    search = '',
    organizationId?: string,
    rawPage = 1,
    rawPageSize = 20,
  ) {
    if (organizationId && !isUUID(organizationId))
      throw new BadRequestException('Invalid organization ID');
    const page = Math.max(
      1,
      Number.isFinite(rawPage) ? Math.floor(rawPage) : 1,
    );
    const pageSize = Math.min(
      100,
      Math.max(1, Number.isFinite(rawPageSize) ? Math.floor(rawPageSize) : 20),
    );
    const qb = this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.equipment', 'e')
      .leftJoinAndSelect('e.monitors', 'd')
      .leftJoinAndSelect('u.organization', 'o')
      .where('u.role = :role', { role: UserRole.CONTROLLER });
    if (organizationId)
      qb.andWhere('u.organization_id = :organizationId', { organizationId });
    if (search.trim())
      qb.andWhere(
        '(LOWER(u.name) LIKE :search OR LOWER(u.email) LIKE :search)',
        { search: `%${search.trim().toLowerCase()}%` },
      );
    const [items, total] = await qb
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items: items.map(managedUserSummary), total, page, pageSize };
  }

  async findOne(id: string) {
    return managedUserSummary(await this.userEntity(id));
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userEntity(id);
    if (user.role !== UserRole.CONTROLLER)
      throw new BadRequestException('Only Controllers can be managed here');
    user.name = dto.name.trim();
    await this.users.save(user);
    return this.findOne(id);
  }

  async deactivate(id: string, actorId?: string) {
    const user = await this.userEntity(id);
    if (user.role !== UserRole.CONTROLLER)
      throw new BadRequestException('Only Controllers can be managed here');
    user.isActive = false;
    user.tokenVersion += 1;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(user);
      await this.auditTrail.record(
        {
          actorId,
          actorRole: 'Admin',
          organizationId: user.organizationId,
          action: 'USER_DEACTIVATED',
          entityType: 'user',
          entityId: id,
          after: { isActive: false },
        },
        manager,
      );
    });
    this.sessions.invalidateUser(id);
    return this.findOne(id);
  }

  async reactivate(id: string, actorId?: string) {
    const user = await this.userEntity(id);
    if (user.role !== UserRole.CONTROLLER || !user.organization?.isActive)
      throw new BadRequestException('Active organization required');
    await this.dataSource.transaction(async (manager) => {
      if (!user.isActive)
        await this.entitlements.lockAndCheck(
          user.organizationId!,
          'controllers',
          manager,
        );
      user.isActive = true;
      await manager.save(user);
      await this.auditTrail.record(
        {
          actorId,
          actorRole: 'Admin',
          organizationId: user.organizationId,
          action: 'USER_REACTIVATED',
          entityType: 'user',
          entityId: id,
          after: { isActive: true },
        },
        manager,
      );
    });
    return this.findOne(id);
  }

  async assignDevices(id: string, dto: AssignDevicesDto, actorId?: string) {
    const user = await this.userEntity(id);
    if (user.role !== UserRole.CONTROLLER || !user.organizationId)
      throw new BadRequestException('Controller required');
    user.equipment = await this.validEquipment(
      dto.equipmentIds,
      dto.deviceIds,
      user.organizationId,
    );
    user.tokenVersion += 1;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(user);
      await this.auditTrail.record(
        {
          actorId,
          actorRole: 'Admin',
          organizationId: user.organizationId,
          action: 'PERMISSION_ASSIGNMENT_CHANGED',
          entityType: 'user',
          entityId: id,
          after: { assignmentCount: user.equipment.length },
        },
        manager,
      );
    });
    this.sessions.invalidateUser(id);
    return this.findOne(id);
  }

  private async validEquipment(
    equipmentIds: string[] | undefined,
    deviceIds: string[] | undefined,
    organizationId: string,
  ): Promise<Equipment[]> {
    if (equipmentIds && deviceIds)
      throw new BadRequestException('Use equipmentIds only');
    let ids = equipmentIds ?? [];
    if (deviceIds) {
      const devices = await this.devices.find({
        where: { id: In(deviceIds), organizationId },
      });
      if (
        devices.length !== new Set(deviceIds).size ||
        devices.some((d) => !d.currentEquipmentId)
      )
        throw new BadRequestException(
          'One or more monitors are invalid for this organization',
        );
      ids = devices.map((d) => d.currentEquipmentId!);
    }
    if (!ids.length) return [];
    const unique = [...new Set(ids)];
    const rows = await this.equipment.find({
      where: { id: In(unique), organizationId },
    });
    if (rows.length !== unique.length)
      throw new BadRequestException(
        'One or more equipment records are invalid for this organization',
      );
    return rows;
  }

  private async userEntity(id: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      relations: ['equipment', 'equipment.monitors', 'organization'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
