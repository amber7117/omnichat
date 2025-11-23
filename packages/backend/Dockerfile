FROM node:20-slim

WORKDIR /app

# 先复制依赖文件
COPY package*.json ./

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

RUN npm install

# 再复制项目源码
COPY . .

# 构建 TypeScript
RUN npm run build

# 启动
CMD ["node", "dist/server.js"]