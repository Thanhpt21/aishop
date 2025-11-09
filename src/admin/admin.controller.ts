import { Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('v1/admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Post('export-training')
  async exportTraining() {
    const messages = await this.prisma.message.findMany({ take: 1000, orderBy: { createdAt: 'desc' }});
    const rows = messages.map(m => ({ prompt: m.content, completion: m.content }));
    const out = rows.map(r => JSON.stringify(r)).join('\n');
    const file = path.join(process.cwd(), 'training_export.jsonl');
    fs.writeFileSync(file, out);
    return { path: file, rows: rows.length };
  }
}
