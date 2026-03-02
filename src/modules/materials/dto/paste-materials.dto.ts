import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddMaterialDto } from './add-material.dto';

export class PasteMaterialsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddMaterialDto)
  materials: AddMaterialDto[];
}
