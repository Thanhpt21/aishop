// src/training/dto/update-training-session.dto.ts
import { IsOptional, IsString, IsNumber, Min, Max, IsObject, IsEnum } from 'class-validator';

export class UpdateTrainingSessionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  datasetConfig?: any;

  @IsOptional()
  @IsString()
  dataSource?: string;

  @IsOptional()
  @IsString()
  modelType?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  baseModel?: string;

  @IsOptional()
  @IsObject()
  parameters?: any;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  currentStep?: string;
}