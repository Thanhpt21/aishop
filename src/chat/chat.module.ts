import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DedupService } from './dedup.service';
import { CacheService } from './cache.service';
import { OpenAiService } from './openai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SmartAdjusterService } from './smart-adjuster.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService, DedupService, CacheService, OpenAiService, SmartAdjusterService],
})
export class ChatModule {}
