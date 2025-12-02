// src/training/dto/create-training-session.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max, IsEnum, IsObject } from 'class-validator';

export class CreateTrainingSessionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  datasetConfig?: any;

  @IsNotEmpty()
  @IsString()
  dataSource: string;

  @IsNotEmpty()
  @IsString()
  modelType: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  baseModel?: string;

  @IsOptional()
  @IsObject()
  parameters?: any;
}