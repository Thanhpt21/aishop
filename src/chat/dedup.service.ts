import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from './cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DedupService {
  constructor(
    private cache: CacheService, 
    private prisma: PrismaService
  ) {}

  normalizePrompt(prompt: string) {
    return (prompt || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, '');
  }

  hashPrompt(normalized: string) {
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check cache - Thử Redis trước, nếu không có thì fallback sang Database
   * @returns { id, text, source, usage, products } hoặc null
   */
  async checkCache(hash: string): Promise<{ id: string; text: string; source: string; usage: any; products?: any[] } | null> {
    const key = `prompt:${hash}`;
    
    // Thử lấy từ Redis trước
    const respId = await this.cache.get(key);
    
    if (respId) {
      console.log('✅ Redis cache HIT');
      const resp = await this.prisma.response.findUnique({ 
        where: { id: respId },
        select: { id: true, content: true, usage: true }
      });
      
      if (resp) {
        // Lấy products từ usage (không phải metadata)
        const usage = resp.usage as any;
        return { 
          id: resp.id, 
          text: resp.content, 
          source: 'cached',
          usage: resp.usage || {},
          products: usage?.products || [] // Lấy từ usage.products
        };
      }
    }
    
    // Nếu Redis không có, fallback sang Database (silent - không log nữa)
    const dbResp = await this.prisma.response.findUnique({
      where: { hash },
      select: { id: true, content: true, usage: true }
    });
    
    if (dbResp) {
      console.log('✅ Database cache HIT');
      
      // Đồng bộ lại vào Redis (silent fail)
      await this.setCache(hash, dbResp.id);
      
      // Lấy products từ usage (không phải metadata)
      const usage = dbResp.usage as any;
      return {
        id: dbResp.id,
        text: dbResp.content,
        source: 'cached',
        usage: dbResp.usage || {},
        products: usage?.products || [] // Lấy từ usage.products
      };
    }
    
    // Cache miss hoàn toàn
    return null;
  }

  /**
   * Set cache - Lưu vào Redis (silent fail)
   */
  async setCache(hash: string, responseId: string) {
    const key = `prompt:${hash}`;
    const ttl = parseInt(process.env.PROMPT_CACHE_TTL || '604800', 10); // 7 days
    
    // Silent fail - không throw error
    try {
      await this.cache.set(key, responseId, ttl);
    } catch (error) {
      console.warn('⚠️ Failed to set Redis cache:', error.message);
    }
  }
}