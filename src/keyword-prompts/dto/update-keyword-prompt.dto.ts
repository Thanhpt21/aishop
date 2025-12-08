// src/keyword-prompts/dto/update-keyword-prompt.dto.ts
import { IsOptional, IsString, IsInt, IsEmail, MinLength, MaxLength, Min, Max } from 'class-validator';

export class UpdateKeywordPromptDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  sampleAnswer?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsInt()
  @Min(-999)
  @Max(999)
  priority?: number;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}