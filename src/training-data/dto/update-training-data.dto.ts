// src/training-data/dto/update-training-data.dto.ts
import { IsOptional, IsString, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class UpdateTrainingDataDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  input?: string;

  @IsOptional()
  @IsString()
  output?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore?: number;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  trainingSessionId?: string;
}