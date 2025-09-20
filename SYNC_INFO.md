# 🔄 Repository Sync Information

> 📖 **Language**: [English](#) | [中文版本](SYNC_INFO_ZH.md)

## 📋 Repository Nature

**This is an automatically synchronized mirror repository**

- 🎯 **Source Repository**: https://cnb.cool/EnderRealm/public/MCBEPackCrypt
- 🔄 **Sync Frequency**: Automatically syncs every 24 hours
- ⏰ **Sync Time**: Daily at UTC 00:00 (Beijing Time 08:00)
- 🛠️ **Manual Sync**: Supports manual triggering via GitHub Actions

## ⚠️ Important Notice

- 📝 **Do not commit code directly to this repository**, all changes will be overwritten during the next sync
- 🔗 **To contribute code**, please go to the source repository
- 📊 **Issues and PRs** should be submitted to the source repository

## 🚀 Sync Features

### Automatic Sync
- Uses GitHub Actions scheduled tasks
- Automatically checks source repository updates daily
- Automatically syncs code, tags, and commit history

### Manual Sync
1. Go to the "Actions" page of this repository
2. Select the "Sync Repository" workflow
3. Click the "Run workflow" button

## 🔧 Technical Implementation

- **Workflow File**: `.github/workflows/sync-repo.yml`
- **Protection Mechanism**: Automatically backs up and restores GitHub Actions configuration
- **Smart Detection**: Only executes sync operations when changes are detected

## 📞 Contact

For questions or suggestions, please:
1. Visit the source repository: https://cnb.cool/EnderRealm/public/MCBEPackCrypt
2. Contact the original project maintainers

---

*This document is maintained by the automatic sync system, last updated: [AUTO_UPDATE_TIME]*