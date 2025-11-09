// 🌟 THÊM ĐỊNH NGHĨA HÀM EXCLUDE Ở ĐÂY
function exclude<User, Key extends keyof User>(
  user: User,
  keys: Key[]
): Omit<User, Key> {
  const result = { ...user };
  for (let key of keys) {
    delete result[key];
  }
  return result as Omit<User, Key>;
}




import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; password: string; name?: string }) {
    const hash = await bcrypt.hash(data.password, 10);
    const newUser = await this.prisma.user.create({
      data: { email: data.email, password: hash, name: data.name },
    });
    
    // 🌟 LOẠI BỎ PASSWORD TRƯỚC KHI TRẢ VỀ
    return exclude(newUser, ['password']);
  }
}
