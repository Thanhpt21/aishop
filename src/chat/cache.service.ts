import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
  client: any;
  private isRedisConnected = false;

  async onModuleInit() {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || '6379';
      const redisPassword = process.env.REDIS_PASSWORD || '';
      
      const url = process.env.REDIS_URL || 
        `redis://${redisPassword ? `:${redisPassword}@` : ''}${redisHost}:${redisPort}`;
      
      console.log(`🔌 Attempting to connect to Redis at ${redisHost}:${redisPort}...`);
      
      this.client = createClient({ 
        url,
        socket: {
          connectTimeout: 5000, // 5 seconds timeout
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.log('❌ Redis reconnection attempts exhausted');
              return false; // Stop reconnecting
            }
            console.log(`🔄 Redis reconnecting... attempt ${retries}`);
            return Math.min(retries * 100, 3000);
          }
        }
      });
      
      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err.message);
        this.isRedisConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isRedisConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('⚠️ Redis disconnected');
        this.isRedisConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      console.log('⚠️ Application will continue without Redis cache (DB cache only)');
      this.isRedisConnected = false;
      this.client = null; // Prevent further Redis calls
    }
  }

  async set(key: string, value: string, ttlSec?: number) {
    if (!this.isRedisConnected || !this.client) {
      // Silent fail - không log nữa để tránh spam
      return;
    }

    try {
      if (ttlSec) {
        await this.client.set(key, value, { EX: ttlSec });
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`❌ Redis SET error for ${key}:`, error.message);
      this.isRedisConnected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isRedisConnected || !this.client) {
      // Silent fail - trả về null để fallback sang DB
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`❌ Redis GET error for ${key}:`, error.message);
      this.isRedisConnected = false;
      return null;
    }
  }

  // Thêm method để check health
  isHealthy(): boolean {
    return this.isRedisConnected;
  }
}