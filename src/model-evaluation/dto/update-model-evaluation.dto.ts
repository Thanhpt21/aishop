// src/model-evaluation/dto/update-model-evaluation.dto.ts
import { IsOptional, IsString, IsNumber, Min, Max, IsObject } from 'class-validator';

export class UpdateModelEvaluationDto {
  @IsOptional()
  @IsObject()
  testDataset?: any;

  @IsOptional()
  @IsObject()
  metrics?: any;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overallScore?: number;

  @IsOptional()
  @IsObject()
  details?: any;
}