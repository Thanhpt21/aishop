import { Controller, Post, Body, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('v1')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ============ MAIN CHAT ENDPOINT ============
  @Post('chat')
  async chat(@Body() body: any, @Request() req: any) {
    const userId = req.user?.userId;
    const ownerEmail = req.user?.email;
    return this.chatService.handleChat({ ...body, userId, ownerEmail });
  }

  // ============ CONVERSATION ENDPOINTS ============
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  // ============ USER MESSAGES ============
  @Get('messages')
  async getMessagesByUserId(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        data: []
      };
    }
    
    const messages = await this.chatService.getMessages(userId);
    return {
      success: true,
      data: messages
    };
  }

}