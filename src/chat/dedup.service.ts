import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from './cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DedupService {
  constructor(private cache: CacheService, private prisma: PrismaService) {}

  normalizePrompt(prompt: string) {
    return (prompt || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '');
  }

  hashPrompt(normalized: string) {
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  async checkCache(hash: string) {
    const key = `prompt:${hash}`;
    const respId = await this.cache.get(key);
    if (!respId) return null;
    const resp = await this.prisma.response.findUnique({ where: { id: respId }});
    return resp ? { id: resp.id, text: resp.content, source: 'cached' } : null;
  }

  async setCache(hash: string, responseId: string) {
    const key = `prompt:${hash}`;
    const ttl = parseInt(process.env.PROMPT_CACHE_TTL || '604800', 10);
    await this.cache.set(key, responseId, ttl);
  }
}
