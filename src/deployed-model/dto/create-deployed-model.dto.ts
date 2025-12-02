// src/models/dto/create-deployed-model.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';

export class CreateDeployedModelDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  version: string;

  @IsNotEmpty()
  @IsString()
  modelType: string;

  @IsNotEmpty()
  @IsString()
  modelPath: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  latency?: number;

  @IsOptional()
  @IsString()
  trainingSessionId?: string;
}