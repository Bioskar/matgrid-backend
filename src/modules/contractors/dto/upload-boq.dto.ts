import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadBOQFileDto {
  @ApiPropertyOptional({
    description: 'Project ID to associate parsed materials with',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}
