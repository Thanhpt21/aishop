// src/training-config/training-config.module.ts
import { Module } from '@nestjs/common';
import { TrainingConfigService } from './training-config.service';
import { TrainingConfigController } from './training-config.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TrainingConfigController],
  providers: [TrainingConfigService, PrismaService],
  exports: [TrainingConfigService],
})
export class TrainingConfigModule {}