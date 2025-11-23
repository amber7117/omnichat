# syntax=docker/dockerfile:1

########################
# 1. 构建阶段 (builder)
########################
FROM node:20-slim AS builder

WORKDIR /app

# 1) 修正源为 https 并安装 git + ca-certificates
RUN set -eux; \
    if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      git \
      ca-certificates; \
    rm -rf /var/lib/apt/lists/*

# 2) 只复制依赖声明，利用缓存
COPY package*.json ./
COPY prisma ./prisma

# 3) 安装依赖（加日志输出，失败时打印 npm 日志）
RUN set -eux; \
    npm install || (echo '===== NPM LOG START =====' && \
                    ls -R /root/.npm/_logs || true && \
                    cat /root/.npm/_logs/*-debug-0.log || true && \
                    echo '===== NPM LOG END =====' && \
                    exit 1)

# 4) 复制完整源码
COPY . .

# 5) 编译 TypeScript
RUN npm run build

# 检查 dist 目录结构 (调试用)
RUN ls -R dist

########################
# 2. 运行阶段 (runtime)
########################
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# 运行时需要 openssl (Prisma), git (npm install 可能需要), 和 pnpm (如果应用需要)
RUN set -eux; \
    if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
      git; \
    rm -rf /var/lib/apt/lists/*; \
    npm install -g pnpm

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

EXPOSE 3001

CMD ["npm", "start"]
