// src/training-config/dto/create-training-config.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateTrainingConfigDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  modelType: string;

  @IsNotEmpty()
  @IsObject()
  parameters: any;

  @IsOptional()
  @IsObject()
  preprocessingSteps?: any;

  @IsOptional()
  @IsObject()
  features?: any;
}