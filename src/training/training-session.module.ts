// src/training/training.module.ts
import { Module } from '@nestjs/common';
import { TrainingSessionService } from './training-session.service';
import { TrainingSessionController } from './training-session.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TrainingSessionController],
  providers: [TrainingSessionService, PrismaService],
  exports: [TrainingSessionService],
})
export class TrainingSessionModule {}