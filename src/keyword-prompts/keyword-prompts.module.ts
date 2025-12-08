// src/keyword-prompts/keyword-prompts.module.ts
import { Module } from '@nestjs/common';
import { KeywordPromptsService } from './keyword-prompts.service';
import { KeywordPromptsController } from './keyword-prompts.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [KeywordPromptsController],
  providers: [KeywordPromptsService, PrismaService],
  exports: [KeywordPromptsService],
})
export class KeywordPromptsModule {}