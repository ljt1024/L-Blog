# Docker容器化部署指南

Docker是一个开源的应用容器引擎，让开发者可以打包他们的应用以及依赖包到一个可移植的容器中，然后发布到任何流行的Linux机器或Windows机器上，也可以实现虚拟化。

## 什么是Docker？

Docker是一个开源的容器化平台，它允许开发者将应用及其依赖项打包到轻量级、可移植的容器中。容器与虚拟机不同，它们共享宿主机的操作系统内核，因此更加轻量级和高效。

### Docker的核心概念

1. **镜像（Image）**：只读模板，用于创建容器
2. **容器（Container）**：镜像的运行实例
3. **仓库（Registry）**：存储镜像的地方，如Docker Hub
4. **Dockerfile**：用于构建镜像的文本文件

## Docker安装

### Windows系统安装

1. 下载Docker Desktop for Windows
2. 运行安装程序
3. 启动Docker Desktop

### macOS系统安装

1. 下载Docker Desktop for Mac
2. 将Docker.dmg拖拽到Applications文件夹
3. 启动Docker

### Linux系统安装（Ubuntu为例）

```bash
# 更新apt包索引
sudo apt-get update

# 安装必要的包
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release

# 添加Docker官方GPG密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 设置稳定版仓库
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 更新apt包索引
sudo apt-get update

# 安装Docker Engine
sudo apt-get install docker-ce docker-ce-cli containerd.io

# 验证安装
sudo docker run hello-world
```

## Docker基本命令

### 镜像操作

```bash
# 搜索镜像
docker search nginx

# 拉取镜像
docker pull nginx

# 查看本地镜像
docker images

# 删除镜像
docker rmi nginx

# 构建镜像
docker build -t myapp .
```

### 容器操作

```bash
# 运行容器
docker run nginx

# 运行容器并指定名称和端口映射
docker run --name mynginx -p 8080:80 -d nginx

# 查看运行中的容器
docker ps

# 查看所有容器（包括停止的）
docker ps -a

# 停止容器
docker stop mynginx

# 启动已停止的容器
docker start mynginx

# 重启容器
docker restart mynginx

# 删除容器
docker rm mynginx

# 进入容器
docker exec -it mynginx /bin/bash
```

### 容器日志和信息

```bash
# 查看容器日志
docker logs mynginx

# 查看容器详细信息
docker inspect mynginx

# 查看容器资源使用情况
docker stats mynginx
```

## Dockerfile详解

Dockerfile是用来构建Docker镜像的文本文件，包含了一系列指令。

### 基本语法

```dockerfile
# 基础镜像
FROM ubuntu:20.04

# 维护者信息
LABEL maintainer="your-email@example.com"

# 设置工作目录
WORKDIR /app

# 复制文件
COPY . /app

# 安装依赖
RUN apt-get update && apt-get install -y python3

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["python3", "app.py"]
```

### 常用指令说明

1. **FROM**：指定基础镜像
2. **LABEL**：为镜像添加元数据
3. **WORKDIR**：设置工作目录
4. **COPY**：复制文件到镜像中
5. **ADD**：复制文件，支持URL和解压tar文件
6. **RUN**：执行命令并创建新的镜像层
7. **ENV**：设置环境变量
8. **EXPOSE**：声明端口
9. **CMD**：容器启动时执行的命令
10. **ENTRYPOINT**：容器入口点

## 构建和推送镜像

### 构建镜像

```bash
# 在Dockerfile所在目录执行
docker build -t myapp:v1.0 .

# 指定Dockerfile路径
docker build -f /path/to/Dockerfile -t myapp:v1.0 .
```

### 推送镜像到仓库

```bash
# 登录Docker Hub
docker login

# 给镜像打标签
docker tag myapp:v1.0 username/myapp:v1.0

# 推送镜像
docker push username/myapp:v1.0
```

## Docker Compose

Docker Compose是用于定义和运行多容器Docker应用程序的工具。

### 安装Docker Compose

```bash
# 下载Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### docker-compose.yml示例

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      - DB_HOST=db
      - DB_PORT=5432

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Docker Compose常用命令

```bash
# 启动所有服务
docker-compose up

# 后台启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs

# 构建服务
docker-compose build
```

## Docker网络

### 网络类型

1. **bridge**：默认网络驱动
2. **host**：移除网络隔离
3. **none**：禁用网络功能
4. **overlay**：跨主机网络

### 网络操作命令

```bash
# 查看网络
docker network ls

# 创建网络
docker network create mynetwork

# 连接容器到网络
docker network connect mynetwork mycontainer

# 断开容器与网络的连接
docker network disconnect mynetwork mycontainer
```

## Docker数据持久化

### 数据卷（Volumes）

```bash
# 创建数据卷
docker volume create myvolume

# 查看数据卷
docker volume ls

# 使用数据卷运行容器
docker run -v myvolume:/app/data nginx

# 删除数据卷
docker volume rm myvolume
```

### 绑定挂载（Bind Mounts）

```bash
# 使用绑定挂载运行容器
docker run -v /host/path:/container/path nginx
```

## Docker最佳实践

### 镜像优化

1. **使用合适的基础镜像**：选择较小的基础镜像，如alpine
2. **多阶段构建**：减小最终镜像大小
3. **合理利用缓存**：将变化较少的指令放在前面
4. **删除不必要的文件**：及时清理临时文件和缓存

### 安全实践

1. **不要以root用户运行容器**
2. **定期更新基础镜像**
3. **扫描镜像漏洞**
4. **限制容器资源使用**

### 多阶段构建示例

```dockerfile
# 构建阶段
FROM node:14 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# 运行阶段
FROM node:14-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## 常见问题和解决方案

### 权限问题

```bash
# 如果遇到权限问题，可以使用sudo运行Docker命令
sudo docker ps

# 或者将用户添加到docker组
sudo usermod -aG docker $USER
```

### 容器无法访问外网

```bash
# 检查Docker网络配置
docker network inspect bridge

# 重启Docker服务
sudo systemctl restart docker
```

### 磁盘空间不足

```bash
# 清理未使用的镜像和容器
docker system prune -a

# 清理未使用的数据卷
docker volume prune
```

## 总结

Docker作为现代应用部署的标准工具，极大地简化了应用的部署和管理。通过容器化技术，开发者可以确保应用在不同环境中的一致性，提高了开发和部署的效率。

掌握Docker需要理解其核心概念，包括镜像、容器、Dockerfile、Compose等。在实际使用中，还需要关注安全性、性能优化和最佳实践等方面。

随着容器编排技术的发展，如Kubernetes等工具也逐渐成为生产环境的标准，但Docker作为基础仍然非常重要。