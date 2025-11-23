# 使用 Node.js 官方镜像
FROM node:20-slim

# 安装 OpenSSL (Prisma 需要)
RUN apt-get update -y && apt-get install -y openssl

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml (如果有)
COPY package.json ./
# 如果有 pnpm-lock.yaml，取消注释下一行
# COPY pnpm-lock.yaml ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 编译 TypeScript
RUN npm run build

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["npm", "start"]
