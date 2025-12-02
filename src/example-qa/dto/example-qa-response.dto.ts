export class ExampleQAResponseDto {
  id: string;
  question: string;
  answer: string;
  intent?: string;
  category?: string;
  language: string;
  isActive: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;

  constructor(exampleQA: any) {
    this.id = exampleQA.id;
    this.question = exampleQA.question;
    this.answer = exampleQA.answer;
    this.intent = exampleQA.intent ?? undefined;
    this.category = exampleQA.category ?? undefined;
    this.language = exampleQA.language;
    this.isActive = exampleQA.isActive;
    this.tags = exampleQA.tags;
    this.createdAt = exampleQA.createdAt;
    this.updatedAt = exampleQA.updatedAt;
  }
}