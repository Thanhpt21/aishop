// src/keyword-prompts/dto/keyword-prompt-response.dto.ts
export class KeywordPromptResponseDto {
  id: number;
  keyword: string;
  prompt: string;
  sampleAnswer: string;
  additionalInfo?: string;
  priority: number;
  ownerEmail?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(keywordPrompt: any) {
    this.id = keywordPrompt.id;
    this.keyword = keywordPrompt.keyword;
    this.prompt = keywordPrompt.prompt;
    this.sampleAnswer = keywordPrompt.sampleAnswer;
    this.additionalInfo = keywordPrompt.additionalInfo;
    this.priority = keywordPrompt.priority;
    this.ownerEmail = keywordPrompt.ownerEmail;
    this.createdAt = keywordPrompt.createdAt;
    this.updatedAt = keywordPrompt.updatedAt;
  }
}