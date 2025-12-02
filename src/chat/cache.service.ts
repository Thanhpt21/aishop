// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { createClient } from 'redis';

// @Injectable()
// export class CacheService implements OnModuleInit {
//   client: any;
//   async onModuleInit() {
//     const url = process.env.REDIS_URL || `redis://:${process.env.REDIS_PASSWORD||''}@${process.env.REDIS_HOST||'redis'}:${process.env.REDIS_PORT||'6379'}`;
//     this.client = createClient({ url });
//     this.client.on('error', (err) => console.error('Redis Client Error', err));
//     await this.client.connect();
//   }

//   async set(key: string, value: string, ttlSec?: number) {
//     if (ttlSec) {
//       await this.client.set(key, value, { EX: ttlSec });
//     } else {
//       await this.client.set(key, value);
//     }
//   }

//   async get(key: string) {
//     return await this.client.get(key);
//   }
// }

import { Injectable, OnModuleInit } from '@nestjs/common';
// import { createClient } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
  client: any;
  async onModuleInit() {
    // COMMENT TOÀN BỘ REDIS CODE:
    // const url = process.env.REDIS_URL || `redis://:${process.env.REDIS_PASSWORD||''}@${process.env.REDIS_HOST||'redis'}:${process.env.REDIS_PORT||'6379'}`;
    // this.client = createClient({ url });
    // this.client.on('error', (err) => console.error('Redis Client Error', err));
    // await this.client.connect();
    
    console.log('CacheService initialized (Redis disabled)');
  }

  async set(key: string, value: string, ttlSec?: number) {
    // Tạm bỏ qua cache
    console.log(`Cache set skipped: ${key}`);
  }

  async get(key: string) {
    // Tạm bỏ qua cache  
    console.log(`Cache get skipped: ${key}`);
    return null;
  }
}