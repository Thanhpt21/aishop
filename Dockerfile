FROM node:20-alpine

WORKDIR /app

# Chỉ cần cài openssl cho Prisma
RUN apk add --no-cache openssl3

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]