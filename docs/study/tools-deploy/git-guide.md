# Git使用指南

Git是一个分布式版本控制系统，用于跟踪文件变化和协作开发。本文将介绍Git的基本概念和常用命令。

## 什么是Git？

Git是由Linus Torvalds为Linux内核开发而创建的分布式版本控制系统。它允许团队成员协作开发项目，同时跟踪代码变更历史。

## Git的基本概念

### 仓库(Repository)
Git仓库是存储项目文件和历史记录的地方，分为本地仓库和远程仓库。

### 工作区、暂存区和仓库
- **工作区**：项目的实际文件所在的地方
- **暂存区**：临时存放文件更改的地方
- **仓库**：存储提交历史的地方

### 分支(Branch)
分支允许你在同一个项目中并行开发不同的功能，而不会相互干扰。

## Git基本操作

### 初始化仓库
```bash
# 在现有目录中初始化Git仓库
git init

# 克隆远程仓库
git clone https://github.com/username/repository.git
```

### 配置用户信息
```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

### 基本工作流程
```bash
# 查看文件状态
git status

# 添加文件到暂存区
git add filename.txt     # 添加特定文件
git add .               # 添加所有文件

# 提交更改
git commit -m "提交信息"

# 查看提交历史
git log
```

## 分支操作

### 创建和切换分支
```bash
# 查看所有分支
git branch

# 创建新分支
git branch feature-login

# 切换分支
git checkout feature-login

# 创建并切换到新分支
git checkout -b feature-register
```

### 合并分支
```bash
# 切换到要合并到的分支（通常是main/master）
git checkout main

# 合并指定分支到当前分支
git merge feature-login
```

### 删除分支
```bash
# 删除已合并的分支
git branch -d feature-login

# 强制删除未合并的分支
git branch -D feature-login
```

## 远程仓库操作

### 推送和拉取
```bash
# 推送到远程仓库
git push origin main

# 从远程仓库拉取最新更改
git pull origin main

# 推送新分支到远程仓库
git push -u origin feature-new
```

### 查看远程仓库
```bash
# 查看远程仓库信息
git remote -v

# 添加远程仓库
git remote add origin https://github.com/username/repo.git
```

## 常用Git命令总结

| 命令 | 说明 |
|------|------|
| `git init` | 初始化Git仓库 |
| `git clone <url>` | 克隆远程仓库 |
| `git status` | 查看文件状态 |
| `git add <file>` | 添加文件到暂存区 |
| `git commit -m "message"` | 提交更改 |
| `git log` | 查看提交历史 |
| `git checkout <branch>` | 切换分支 |
| `git branch` | 查看/创建分支 |
| `git merge <branch>` | 合并分支 |
| `git push` | 推送到远程仓库 |
| `git pull` | 从远程仓库拉取 |

## 解决冲突

当多人修改同一文件的相同部分时，可能会发生冲突：

```bash
# 当pull或merge出现冲突时，编辑冲突文件
# 冲突标记：
<<<<<<< HEAD
你的更改
=======
别人的更改
>>>>>>> branch-name

# 解决冲突后，添加文件并提交
git add conflicted-file.txt
git commit -m "解决冲突"
```

## 最佳实践

1. **频繁提交**：小而频繁的提交比大而少的提交更容易管理
2. **有意义的提交信息**：写清楚明确的提交信息
3. **使用分支**：为不同功能创建独立分支
4. **定期同步**：经常从远程仓库拉取最新更改
5. **.gitignore文件**：忽略不需要版本控制的文件

## 总结

Git是现代软件开发中不可或缺的工具，掌握其基本操作对于团队协作和个人项目管理都非常重要。通过不断实践，你会更加熟练地使用Git进行版本控制。