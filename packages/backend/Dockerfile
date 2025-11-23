FROM node:20-slim

# 1. 安装系统依赖（包括 git）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 2. 设置工作目录
WORKDIR /app

# 3. 先复制 package.json / package-lock.json
COPY package*.json ./

# 4. 安装依赖
RUN npm install --production=false

# 5. 复制源码
COPY . .

# 6. 构建（如果需要）
RUN npm run build

# 7. 启动命令（根据你的项目来）
CMD ["node", "dist/server.js"]
