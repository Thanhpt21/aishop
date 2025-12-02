import { Controller, Post, Body, Get, Param, Request, UseGuards, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('v1')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() body: any, @Request() req: any) {
    const userId = req.user?.userId;
    return this.chatService.handleChat({...body, userId});
  }

  @Get('messages')
  async getMessagesByUserId(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');
    return this.chatService.getMessagesByUser(userId);
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  // THÊM CÁC ENDPOINTS MỚI CHO ANALYTICS VÀ EXAMPLE QA
  @Get('conversations/:id/analytics')
  async getConversationAnalytics(@Param('id') id: string) {
    return this.chatService.getConversationAnalytics(id);
  }

  @Get('analytics/example-qa')
  async getExampleQAAnalytics() {
    return this.chatService.getExampleQAAnalytics();
  }

  // ENDPOINT ĐỂ TEST EXAMPLE QA MATCHING
  @Post('test-example-qa')
  async testExampleQAMatching(@Body() body: { prompt: string }) {
    const result = await this.chatService.findAnswerFromExampleQA(body.prompt);
    return {
      success: true,
      data: result
    };
  }
}