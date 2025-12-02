// src/training-config/dto/update-training-config.dto.ts
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateTrainingConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  modelType?: string;

  @IsOptional()
  @IsObject()
  parameters?: any;

  @IsOptional()
  @IsObject()
  preprocessingSteps?: any;

  @IsOptional()
  @IsObject()
  features?: any;
}