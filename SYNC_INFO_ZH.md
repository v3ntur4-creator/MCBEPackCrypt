# 🔄 仓库同步说明

> 📖 **语言版本**: [English](SYNC_INFO.md) | [中文](#)

## 📋 仓库性质

**这是一个自动同步的镜像仓库**

- 🎯 **源仓库**: https://cnb.cool/EnderRealm/public/MCBEPackCrypt
- 🔄 **同步频率**: 每24小时自动同步一次
- ⏰ **同步时间**: 每天 UTC 00:00（北京时间 08:00）
- 🛠️ **手动同步**: 支持通过 GitHub Actions 手动触发

## ⚠️ 重要提醒

- 📝 **请勿直接在此仓库提交代码**，所有更改会在下次同步时被覆盖
- 🔗 **如需贡献代码**，请前往源仓库进行操作
- 📊 **Issue 和 PR** 建议在源仓库提交

## 🚀 同步功能

### 自动同步
- 使用 GitHub Actions 定时任务
- 每日自动检查源仓库更新
- 自动同步代码、标签和提交历史

### 手动同步
1. 进入本仓库的 "Actions" 页面
2. 选择 "Sync Repository" 工作流
3. 点击 "Run workflow" 按钮

## 🔧 技术实现

- **工作流文件**: `.github/workflows/sync-repo.yml`
- **保护机制**: 自动备份和恢复 GitHub Actions 配置
- **智能检测**: 仅在检测到更改时执行同步操作

## 📞 联系方式

如有问题或建议，请：
1. 访问源仓库：https://cnb.cool/EnderRealm/public/MCBEPackCrypt
2. 联系原项目维护者

---

*此文档由自动同步系统维护，最后更新时间：2025-09-20 05:44:12 UTC*