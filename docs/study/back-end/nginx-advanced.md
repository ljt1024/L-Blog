# Nginx深入解析：CentOS与Ubuntu系统下的安装与配置

Nginx是一款高性能的HTTP和反向代理服务器，也是一个IMAP/POP3/SMTP代理服务器。它以其高并发、高性能和低资源消耗而闻名，是现代Web架构中不可或缺的组件。本文将详细介绍在CentOS和Ubuntu系统下Nginx的安装、配置和管理操作。

## 1. Nginx简介

Nginx（发音为"engine-x"）是由Igor Sysoev开发的开源Web服务器，于2004年首次发布。它的设计目标是解决C10K问题（即如何让单台服务器同时处理一万个以上的客户端连接），采用事件驱动的异步架构。

### 1.1 Nginx的主要特性

- **高性能**：采用事件驱动的异步非阻塞处理模型
- **高并发**：能够处理数万个并发连接
- **低资源消耗**：内存占用小，CPU利用率低
- **反向代理**：支持HTTP、HTTPS、TCP、UDP协议的反向代理
- **负载均衡**：支持多种负载均衡算法
- **静态文件服务**：高效的静态文件处理能力
- **SSL/TLS支持**：原生支持HTTPS加密传输
- **模块化架构**：可通过模块扩展功能

### 1.2 Nginx与其他Web服务器对比

| 特性 | Nginx | Apache |
|------|-------|--------|
| 架构 | 事件驱动、异步非阻塞 | 进程/线程驱动、同步阻塞 |
| 内存占用 | 低 | 高 |
| 并发处理 | 强 | 一般 |
| 静态文件处理 | 快 | 较慢 |
| 动态内容处理 | 需要外部处理器 | 内置模块 |

## 2. CentOS系统下Nginx安装

### 2.1 使用yum安装（推荐方式）

```bash
# 添加Nginx官方仓库
sudo tee /etc/yum.repos.d/nginx.repo <<-'EOF'
[nginx]
name=nginx repo
baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=0
enabled=1
EOF

# 更新yum缓存
sudo yum clean all
sudo yum makecache

# 安装Nginx
sudo yum install nginx -y

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查Nginx状态
sudo systemctl status nginx
```

### 2.2 从源码编译安装

```bash
# 安装依赖包
sudo yum groupinstall "Development Tools" -y
sudo yum install pcre-devel zlib-devel openssl-devel -y

# 下载Nginx源码
cd /tmp
wget http://nginx.org/download/nginx-1.24.0.tar.gz
tar -zxvf nginx-1.24.0.tar.gz
cd nginx-1.24.0

# 配置编译选项
./configure \
--prefix=/usr/local/nginx \
--sbin-path=/usr/local/nginx/sbin/nginx \
--conf-path=/usr/local/nginx/conf/nginx.conf \
--error-log-path=/var/log/nginx/error.log \
--http-log-path=/var/log/nginx/access.log \
--pid-path=/var/run/nginx.pid \
--lock-path=/var/run/nginx.lock \
--with-http_ssl_module \
--with-http_v2_module \
--with-http_realip_module \
--with-http_stub_status_module

# 编译和安装
make && sudo make install

# 创建systemd服务文件
sudo tee /etc/systemd/system/nginx.service <<-'EOF'
[Unit]
Description=The NGINX HTTP and reverse proxy server
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=/var/run/nginx.pid
ExecStartPre=/usr/local/nginx/sbin/nginx -t
ExecStart=/usr/local/nginx/sbin/nginx
ExecReload=/bin/kill -s HUP $MAINPID
KillSignal=SIGQUIT
TimeoutStopSec=5
KillMode=process
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd配置
sudo systemctl daemon-reload

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 2.3 防火墙配置

```bash
# 开放HTTP和HTTPS端口
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 或者直接开放端口
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 3. Ubuntu系统下Nginx安装

### 3.1 使用apt安装（推荐方式）

```bash
# 更新软件包索引
sudo apt update

# 安装Nginx
sudo apt install nginx -y

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查Nginx状态
sudo systemctl status nginx
```

### 3.2 使用官方PPA安装最新版本

```bash
# 添加Nginx官方PPA
sudo add-apt-repository ppa:nginx/stable -y

# 更新软件包索引
sudo apt update

# 安装Nginx
sudo apt install nginx -y

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 3.3 从源码编译安装

```bash
# 安装依赖包
sudo apt update
sudo apt install build-essential libpcre3-dev libssl-dev zlib1g-dev -y

# 下载Nginx源码
cd /tmp
wget http://nginx.org/download/nginx-1.24.0.tar.gz
tar -zxvf nginx-1.24.0.tar.gz
cd nginx-1.24.0

# 配置编译选项
./configure \
--prefix=/usr/local/nginx \
--sbin-path=/usr/local/nginx/sbin/nginx \
--conf-path=/usr/local/nginx/conf/nginx.conf \
--error-log-path=/var/log/nginx/error.log \
--http-log-path=/var/log/nginx/access.log \
--pid-path=/var/run/nginx.pid \
--lock-path=/var/run/nginx.lock \
--with-http_ssl_module \
--with-http_v2_module \
--with-http_realip_module \
--with-http_stub_status_module

# 编译和安装
make && sudo make install

# 创建systemd服务文件
sudo tee /etc/systemd/system/nginx.service <<-'EOF'
[Unit]
Description=The NGINX HTTP and reverse proxy server
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=/var/run/nginx.pid
ExecStartPre=/usr/local/nginx/sbin/nginx -t
ExecStart=/usr/local/nginx/sbin/nginx
ExecReload=/bin/kill -s HUP $MAINPID
KillSignal=SIGQUIT
TimeoutStopSec=5
KillMode=process
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd配置
sudo systemctl daemon-reload

# 启动Nginx服务
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 3.4 防火墙配置

```bash
# 开放HTTP和HTTPS端口
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

# 或者直接开放端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 4. Nginx基本配置

### 4.1 主配置文件结构

Nginx的主要配置文件位于：
- CentOS: `/etc/nginx/nginx.conf` 或 `/usr/local/nginx/conf/nginx.conf`
- Ubuntu: `/etc/nginx/nginx.conf`

```nginx
# 主配置区段
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

# 加载模块
include /usr/share/nginx/modules/*.conf;

# 事件处理模型
events {
    worker_connections 1024;
}

# HTTP服务器配置
http {
    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
                    
    access_log /var/log/nginx/access.log main;
    
    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # MIME类型映射
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

### 4.2 创建虚拟主机配置

```nginx
# 创建站点配置文件
# CentOS: /etc/nginx/conf.d/example.com.conf
# Ubuntu: /etc/nginx/sites-available/example.com

server {
    listen 80;
    server_name example.com www.example.com;
    
    # 网站根目录
    root /var/www/example.com;
    index index.html index.htm index.php;
    
    # 访问日志
    access_log /var/log/nginx/example.com.access.log;
    error_log /var/log/nginx/example.com.error.log;
    
    # 网站根目录访问规则
    location / {
        try_files $uri $uri/ =404;
    }
    
    # PHP处理（如果需要）
    location ~ \.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.3 启用站点（Ubuntu）

```bash
# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/

# 测试配置文件语法
sudo nginx -t

# 重新加载Nginx配置
sudo systemctl reload nginx
```

## 5. Nginx常用管理命令

### 5.1 服务管理命令

```bash
# 启动Nginx
sudo systemctl start nginx

# 停止Nginx
sudo systemctl stop nginx

# 重启Nginx
sudo systemctl restart nginx

# 重新加载配置（不中断服务）
sudo systemctl reload nginx

# 查看Nginx状态
sudo systemctl status nginx

# 设置开机自启
sudo systemctl enable nginx

# 禁用开机自启
sudo systemctl disable nginx
```

### 5.2 Nginx二进制命令

```bash
# 测试配置文件语法
sudo nginx -t

# 重新加载配置
sudo nginx -s reload

# 优雅地停止Nginx
sudo nginx -s quit

# 强制停止Nginx
sudo nginx -s stop

# 查看Nginx版本和编译信息
nginx -V

# 查看Nginx版本
nginx -v
```

## 6. Nginx反向代理配置

### 6.1 基本反向代理

```nginx
server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.2 负载均衡配置

```nginx
# 定义上游服务器组
upstream backend {
    server 127.0.0.1:3000 weight=3;
    server 127.0.0.1:3001 weight=2;
    server 127.0.0.1:3002 backup;
}

server {
    listen 80;
    server_name app.example.com;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 7. Nginx SSL配置

### 7.1 获取SSL证书（Let's Encrypt）

```bash
# 安装Certbot
# CentOS
sudo yum install certbot python3-certbot-nginx -y

# Ubuntu
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d example.com -d www.example.com

# 自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 7.2 手动配置SSL

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    # SSL证书配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/private.key;
    
    # SSL安全设置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # 网站配置
    root /var/www/example.com;
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ =404;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

## 8. Nginx性能优化

### 8.1 工作进程优化

```nginx
# nginx.conf中的优化配置
user nginx;
worker_processes auto;  # 根据CPU核心数自动设置
worker_rlimit_nofile 65535;  # 单个工作进程最大打开文件数

events {
    worker_connections 4096;  # 单个工作进程最大连接数
    use epoll;  # 使用epoll事件模型（Linux）
    multi_accept on;  # 允许一次接受多个连接
}
```

### 8.2 缓存优化

```nginx
http {
    # 文件缓存
    open_file_cache max=200000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # 输出缓冲区
    output_buffers 1 32k;
    postpone_output 1460;
    
    # 客户端缓冲区
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 2 1k;
    
    # 超时设置
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
}
```

### 8.3 Gzip压缩

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
```

## 9. Nginx安全配置

### 9.1 基本安全措施

```nginx
server {
    # 隐藏版本号
    server_tokens off;
    
    # 防止图片盗链
    location ~* \.(gif|jpg|jpeg|png|bmp|swf)$ {
        valid_referers none blocked *.example.com example.com;
        if ($invalid_referer) {
            return 403;
        }
    }
    
    # 防止文件注入
    location ~ \.php$ {
        include /etc/nginx/fastcgi_params;
        fastcgi_intercept_errors on;
        fastcgi_pass 127.0.0.1:9000;
    }
    
    # 限制请求方法
    if ($request_method !~ ^(GET|HEAD|POST)$ ) {
        return 405;
    }
    
    # 限制访问敏感文件
    location ~ /\.ht {
        deny all;
    }
    
    location ~ ^/(README|INSTALL|LICENSE|CHANGELOG|UPGRADE)$ {
        deny all;
    }
    
    location ~ ^/(bin|cache|tmp)/ {
        deny all;
    }
}
```

### 9.2 速率限制

```nginx
# 在http块中定义限制区域
http {
    # 限制每个IP的请求速率（每秒10个请求）
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    # 限制每个IP的连接数
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    
    server {
        # 应用连接限制
        limit_conn conn_limit_per_ip 10;
        
        # 应用请求速率限制
        location /api/ {
            limit_req zone=api burst=20 nodelay;
        }
    }
}
```

## 10. Nginx故障排除

### 10.1 常见问题及解决方案

#### 1. 413 Request Entity Too Large

```nginx
# 在http、server或location块中增加客户端最大主体大小
client_max_body_size 100M;
```

#### 2. 502 Bad Gateway

```nginx
# 检查后端服务是否运行
sudo systemctl status your_backend_service

# 增加超时时间
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
```

#### 3. 504 Gateway Timeout

```nginx
# 增加FastCGI超时时间
fastcgi_connect_timeout 300s;
fastcgi_send_timeout 300s;
fastcgi_read_timeout 300s;
```

### 10.2 日志分析

```bash
# 查看访问日志
sudo tail -f /var/log/nginx/access.log

# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 统计IP访问次数
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# 查找404错误
sudo grep " 404 " /var/log/nginx/access.log

# 查找500错误
sudo grep " 500 " /var/log/nginx/access.log
```

## 11. Nginx监控

### 11.1 启用stub_status模块

```nginx
server {
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

访问 `http://your_server/nginx_status` 可以看到类似以下的信息：
```
Active connections: 291 
server accepts handled requests
 16630948 16630948 31070465 
Reading: 6 Writing: 179 Waiting: 106 
```

### 11.2 使用第三方监控工具

```bash
# 安装ngxtop用于实时监控
pip install ngxtop

# 实时监控访问日志
ngxtop -l /var/log/nginx/access.log

# 显示状态码统计
ngxtop top status

# 显示请求最多的路径
ngxtop top request_path
```

## 总结

Nginx作为现代Web架构中的关键组件，掌握其在不同操作系统下的安装、配置和管理对于后端开发人员至关重要。本文详细介绍了：

1. 在CentOS和Ubuntu系统下安装Nginx的多种方法
2. Nginx的基本配置和虚拟主机设置
3. 反向代理和负载均衡配置
4. SSL证书配置和HTTPS支持
5. 性能优化技巧
6. 安全配置措施
7. 常见问题排查和解决方案
8. 监控和日志分析方法

通过合理配置Nginx，我们可以显著提升Web应用的性能、安全性和可扩展性。在实际应用中，应根据具体需求调整配置参数，并定期监控系统性能，确保服务的稳定运行。