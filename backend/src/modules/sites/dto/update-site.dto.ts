import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSiteDto } from './create-site.dto';
export class UpdateSiteDto extends PartialType(
  OmitType(CreateSiteDto, ['organizationId'] as const),
) {}
