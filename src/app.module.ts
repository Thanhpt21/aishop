import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { AdminController } from './admin/admin.controller';
import { ExampleQAModule } from './example-qa/example-qa.module';
import { ProductModule } from './product/product.module';
import { KeywordPromptsModule } from './keyword-prompts/keyword-prompts.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
     UsersModule, 
     ChatModule,
    ExampleQAModule,
    ProductModule,
    KeywordPromptsModule
    ],
  controllers: [AdminController],
})
export class AppModule {}
