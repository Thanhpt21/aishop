import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { AdminController } from './admin/admin.controller';
import { TrainingSessionModule } from './training/training-session.module';
import { TrainingDataModule } from './training-data/training-data.module';
import { DeployedModelModule } from './deployed-model/deployed-model.module';
import { ModelEvaluationModule } from './model-evaluation/model-evaluation.module';
import { TrainingConfigModule } from './training-config/training-config.module';
import { ExampleQAModule } from './example-qa/example-qa.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
     UsersModule, 
     ChatModule,
    TrainingSessionModule,
    TrainingDataModule,
    DeployedModelModule,
    ModelEvaluationModule,
    TrainingConfigModule,
    ExampleQAModule,
    ProductModule
    ],
  controllers: [AdminController],
})
export class AppModule {}
