import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthSessionService } from '../auth/auth-session.service';
import { Device } from '../devices/device.entity';
import { User } from '../users/user.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from './organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    private readonly sessions: AuthSessionService,
  ) {}

  async list(search = '') {
    const query = this.organizations
      .createQueryBuilder('o')
      .loadRelationCountAndMap('o.controllerCount', 'o.users', 'u', (q) =>
        q.andWhere('u.role = :role', { role: UserRole.CONTROLLER }),
      )
      .loadRelationCountAndMap('o.deviceCount', 'o.devices')
      .orderBy('o.name', 'ASC');
    if (search.trim())
      query.where('LOWER(o.name) LIKE :search', {
        search: `%${search.trim().toLowerCase()}%`,
      });
    return (await query.getMany()).map((organization) =>
      this.summary(organization),
    );
  }

  async create(dto: CreateOrganizationDto) {
    const name = dto.name.trim();
    if (name.length < 2)
      throw new BadRequestException(
        'Organization name must have at least two characters',
      );
    if (await this.organizations.exists({ where: { name } }))
      throw new BadRequestException('Organization name already exists');
    const organization = await this.organizations.save(
      this.organizations.create({
        name,
        contactEmail: dto.contactEmail?.trim().toLowerCase() ?? null,
        contactPhone: dto.contactPhone?.trim() ?? null,
        isActive: true,
      }),
    );
    return this.detail(organization.id);
  }

  async detail(id: string) {
    const organization = await this.organizations.findOne({ where: { id } });
    if (!organization) throw new NotFoundException('Organization not found');
    const [controllers, devices] = await Promise.all([
      this.users.find({
        where: { organizationId: id, role: UserRole.CONTROLLER },
        order: { name: 'ASC' },
      }),
      this.devices.find({
        where: { organizationId: id },
        order: { name: 'ASC' },
      }),
    ]);
    return {
      ...this.summary(organization),
      controllerCount: controllers.length,
      deviceCount: devices.length,
      controllers: controllers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        isActivated: user.isActivated,
      })),
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        location: device.location,
        isActive: device.isActive,
      })),
    };
  }

  async mySummary(organizationId: string | null) {
    if (!organizationId) throw new NotFoundException('Organization not found');
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return this.summary(organization);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const organization = await this.organizations.findOne({ where: { id } });
    if (!organization) throw new NotFoundException('Organization not found');
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2)
        throw new BadRequestException(
          'Organization name must have at least two characters',
        );
      organization.name = name;
    }
    if (dto.contactEmail !== undefined)
      organization.contactEmail = dto.contactEmail.trim().toLowerCase();
    if (dto.contactPhone !== undefined)
      organization.contactPhone = dto.contactPhone.trim();
    await this.organizations.save(organization);
    return this.detail(id);
  }

  async setActive(id: string, active: boolean) {
    const organization = await this.organizations.findOne({ where: { id } });
    if (!organization) throw new NotFoundException('Organization not found');
    organization.isActive = active;
    await this.organizations.save(organization);
    if (!active) {
      const controllers = await this.users.find({
        where: { organizationId: id, role: UserRole.CONTROLLER },
        select: { id: true },
      });
      controllers.forEach((user) => this.sessions.invalidateUser(user.id));
    }
    return this.detail(id);
  }

  private summary(organization: Organization) {
    return {
      id: organization.id,
      name: organization.name,
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      controllerCount:
        (organization as Organization & { controllerCount?: number })
          .controllerCount ?? 0,
      deviceCount:
        (organization as Organization & { deviceCount?: number }).deviceCount ??
        0,
    };
  }
}
