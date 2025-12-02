import { Module } from '@nestjs/common';
import { ExampleQAService } from './example-qa.service';
import { ExampleQAController } from './example-qa.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ExampleQAController],
  providers: [ExampleQAService, PrismaService],
  exports: [ExampleQAService],
})
export class ExampleQAModule {}