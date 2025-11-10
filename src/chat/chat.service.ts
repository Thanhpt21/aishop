import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DedupService } from './dedup.service';
import { OpenAiService } from './openai.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private dedup: DedupService,
    private openai: OpenAiService,
  ) {}

  async handleChat(body: any) {
    const { conversationId, prompt, metadata, userId } = body;
    if (!prompt?.trim()) throw new Error('prompt required');

    const normalized = this.dedup.normalizePrompt(prompt);
    const hash = this.dedup.hashPrompt(normalized);

    // 1. TẠO HOẶC LẤY CONVERSATION NGAY TỪ ĐẦU
    let convId: string;
    if (conversationId) {
      convId = conversationId;
    } else {
      const conv = await this.prisma.conversation.create({
        data: { userId: userId || null }
      });
      convId = conv.id;
    }

    // 2. LƯU TIN NHẮN USER TRƯỚC (luôn luôn lưu)
    await this.prisma.message.create({
      data: {
        conversationId: convId,
        userId: userId || null,
        role: 'user',
        content: prompt,
        source: 'user',
      },
    });

    // 3. KIỂM TRA CACHE
    const cached = await this.dedup.checkCache(hash);
    if (cached) {
      // Lưu tin nhắn assistant từ cache
      await this.prisma.message.create({
        data: {
          conversationId: convId,
          userId: userId || null,
          role: 'assistant',
          content: cached.text,
          source: 'cached',
        },
      });

      return {
        cached: true,
        conversationId: convId,
        response: cached,
        usage: {},
      };
    }

    // 4. GỌI OPENAI
    const aiResponse = await this.openai.callOpenAI(
      prompt + ' Chỉ tư vấn về máy tính, laptop, phần cứng, phần mềm, lập trình. Từ chối mọi câu hỏi khác.',
      metadata
    );

    // 5. LƯU TẤT CẢ TRONG TRANSACTION (an toàn tuyệt đối)
    const result = await this.prisma.$transaction(async (tx) => {
      // Lưu tin nhắn assistant
      await tx.message.create({
        data: {
          conversationId: convId,
          userId: userId || null,
          role: 'assistant',
          content: aiResponse.text,
          source: 'openai',
        },
      });

      // Lưu response + hash
      const resp = await tx.response.upsert({
        where: { hash },
        update: {}, // nếu đã tồn tại thì không update gì
        create: { hash, content: aiResponse.text, usage: aiResponse.usage || {} },
      });


      await tx.promptHash.create({
        data: {
          promptHash: hash,
          responseId: resp.id,
          normalizedPrompt: normalized,
        },
      });

      // Cache cho lần sau
      await this.dedup.setCache(hash, resp.id);

      return resp;
    });

    return {
      cached: false,
      conversationId: convId,
      response: {
        id: result.id,
        text: result.content,
      },
      usage: aiResponse.usage || {},
    };
  }

  async getConversation(id: string) {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  async getMessages(id: string) {
    return this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' }});
  }

async getMessagesByUser(userId: string) {

  // Lấy tất cả conversation có user này
  const conversations = await this.prisma.conversation.findMany({
    where: { userId },
    select: { id: true, userId: true, createdAt: true },
  });

  const conversationIds = conversations.map(c => c.id);

  if (!conversationIds.length) {
    return [];
  }

  // Lấy tất cả message trong các conversation đó (user + assistant)
  const messages = await this.prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  return messages;
}

}
