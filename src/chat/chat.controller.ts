import { Controller, Post, Body, Get, Param, Request, UseGuards } from '@nestjs/common';
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


}
