// src/product/dto/product-response.dto.ts
export class ProductResponseDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  category?: string;
  brand?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(product: any) {
    this.id = product.id;
    this.name = product.name;
    this.description = product.description ?? undefined;
    this.price = product.price;
    this.weight = product.weight ?? undefined;
    this.length = product.length ?? undefined;
    this.width = product.width ?? undefined;
    this.height = product.height ?? undefined;
    this.category = product.category ?? undefined;
    this.brand = product.brand ?? undefined;
    this.isActive = product.isActive;
    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }
}