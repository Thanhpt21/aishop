import { Controller, Post, Body, Get, Param, Request } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('v1')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() body: any, @Request() req: any) {
    const userId = req.user?.userId;
    return this.chatService.handleChat({...body, userId});
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
