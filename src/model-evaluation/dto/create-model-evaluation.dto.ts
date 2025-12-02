// src/model-evaluation/dto/create-model-evaluation.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max, IsObject } from 'class-validator';

export class CreateModelEvaluationDto {
  @IsNotEmpty()
  @IsString()
  trainingSessionId: string;

  @IsOptional()
  @IsObject()
  testDataset?: any;

  @IsNotEmpty()
  @IsObject()
  metrics: any;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overallScore?: number;

  @IsOptional()
  @IsObject()
  details?: any;
}