// src/keyword-prompts/dto/create-keyword-prompt.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsInt, IsEmail, MinLength, MaxLength, Min, Max } from 'class-validator';

export class CreateKeywordPromptDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  keyword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  prompt: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  sampleAnswer: string;

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