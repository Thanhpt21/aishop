import { IsOptional, IsString, IsBoolean, IsArray, IsEmail } from 'class-validator';

export class UpdateExampleQADto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

    @IsOptional()
  @IsEmail()
  ownerEmail?: string; 
}