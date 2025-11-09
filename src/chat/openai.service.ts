import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenAiService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!this.apiKey) console.warn('OPENAI_API_KEY not set - using echo fallback');
  }

  async callOpenAI(prompt: string, metadata?: any) {
    if (!this.apiKey) {
      return { text: `Echo: ${prompt}`, usage: {} };
    }
    try {
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: metadata?.system || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: metadata?.max_tokens || 512,
        temperature: metadata?.temperature ?? 0.2
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      const choices = resp.data?.choices || [];
      const text = (choices[0] && (choices[0].message?.content || choices[0].text)) || resp.data?.text || '';
      return { text, usage: resp.data?.usage || {} };
    } catch (err: any) {
      console.error('OpenAI call failed', err?.response?.data || err.message);
      throw new Error('OpenAI API call failed');
    }
  }
}
