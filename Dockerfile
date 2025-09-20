FROM node:18-alpine

# 创建工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖，用于构建）
RUN npm ci

# 复制源代码和配置文件
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY .env.example ./

# 构建后端和前端
RUN npm run build:backend && npm run build:frontend

# 清理开发依赖
RUN npm prune --production

# 创建临时文件目录
RUN mkdir -p temp

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动命令 - 运行服务器
CMD ["npm", "start"]