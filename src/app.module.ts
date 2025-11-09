import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { AdminController } from './admin/admin.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ChatModule],
  controllers: [AdminController],
})
export class AppModule {}
