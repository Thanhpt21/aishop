// src/training-data/dto/create-training-data.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class CreateTrainingDataDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsNotEmpty()
  @IsString()
  input: string;

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