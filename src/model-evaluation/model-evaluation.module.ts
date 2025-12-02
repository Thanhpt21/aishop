// src/model-evaluation/model-evaluation.module.ts
import { Module } from '@nestjs/common';
import { ModelEvaluationService } from './model-evaluation.service';
import { ModelEvaluationController } from './model-evaluation.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ModelEvaluationController],
  providers: [ModelEvaluationService, PrismaService],
  exports: [ModelEvaluationService],
})
export class ModelEvaluationModule {}