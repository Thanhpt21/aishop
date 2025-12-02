// src/models/models.module.ts
import { Module } from '@nestjs/common';
import { DeployedModelService } from './deployed-model.service';
import { DeployedModelController } from './deployed-model.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DeployedModelController],
  providers: [DeployedModelService, PrismaService],
  exports: [DeployedModelService],
})
export class DeployedModelModule {}