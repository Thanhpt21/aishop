// src/product/dto/product-response.dto.ts
export class ProductResponseDto {
  id: string;
  name: string;
  slug: string; 
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
    this.slug = product.slug;
    this.description = product.description;
    this.price = product.price;
    this.weight = product.weight;
    this.length = product.length;
    this.width = product.width;
    this.height = product.height;
    this.category = product.category;
    this.brand = product.brand;
    this.isActive = product.isActive;
    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }
}