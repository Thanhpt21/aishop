// src/models/dto/update-deployed-model.dto.ts
import { IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateDeployedModelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  modelType?: string;

  @IsOptional()
  @IsString()
  modelPath?: string;

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