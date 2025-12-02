// src/training-data/training-data.module.ts
import { Module } from '@nestjs/common';
import { TrainingDataService } from './training-data.service';
import { TrainingDataController } from './training-data.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TrainingDataController],
  providers: [TrainingDataService, PrismaService],
  exports: [TrainingDataService],
})
export class TrainingDataModule {}