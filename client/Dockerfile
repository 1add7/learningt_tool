# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# 先拷贝包管理文件以利用层缓存
COPY package*.json pnpm-lock.yaml* ./
RUN npm install

# 拷贝源码并构建
COPY . .
RUN npm run build-only

# ---- runtime stage ----
FROM nginx:alpine AS runtime

# 使用项目自带的 nginx 配置（含 /api 反向代理到 server:3000）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物到 nginx 默认静态目录
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
