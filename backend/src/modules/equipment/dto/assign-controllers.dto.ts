import { ArrayUnique, IsArray, IsUUID } from 'class-validator';
export class AssignControllersDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  controllerIds!: string[];
}
