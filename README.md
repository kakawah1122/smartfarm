# 鹅数通 - 智慧养鹅管理小程序

一款专为养鹅场设计的智能化管理小程序，提供生产管理、健康管理、财务分析、AI诊断等功能。

---

## ✨ 核心功能

### 📊 生产管理
- 批次入栏/出栏管理
- 物料库存管理
- 饲料使用记录
- 成本核算

### 🏥 健康管理
- 实时健康监控
- 疫苗接种管理
- 疾病治疗记录
- 死亡记录分析
- AI智能诊断

### 💰 财务管理
- 成本分析
- 收益统计
- 性能分析

### 👤 用户管理
- 权限管理
- 角色管理
- 员工管理

---

## 🏗️ 项目结构

```
鹅数通/
├── miniprogram/              # 小程序主目录
│   ├── pages/               # 主包页面（5个核心页面）
│   │   ├── index/          # 首页
│   │   ├── production/     # 生产管理
│   │   ├── health/         # 健康管理
│   │   ├── profile/        # 个人中心
│   │   └── knowledge/      # 知识库
│   ├── packageHealth/       # 健康管理分包
│   ├── packageProduction/   # 生产管理分包
│   ├── packageUser/         # 用户管理分包
│   ├── packageFinance/      # 财务管理分包
│   ├── packageAI/          # AI诊断分包
│   ├── components/         # 公共组件
│   └── utils/              # 工具函数
├── cloudfunctions/          # 云函数
│   ├── health-management/  # 健康管理
│   ├── production-entry/   # 生产入栏
│   ├── user-management/    # 用户管理
│   └── ai-multi-model/     # AI多模型
└── docs/                   # 文档目录
    ├── health/            # 健康管理相关维护文档
    │   └── 健康页面维护指南.md
    ├── diagnosis/         # 诊断历史相关维护文档
    │   └── 诊断历史维护指南.md
    ├── OPTIMIZATION_SUMMARY.md
    ├── PERFORMANCE_OPTIMIZATION_GUIDE.md
    ├── DATABASE_CONFIG_GUIDE.md
    ├── DATABASE_INDEX_GUIDE.md
    ├── DEPLOYMENT_CHECKLIST.md
    ├── UI_DESIGN_GUIDELINES.md
    ├── 饲养成本管理-快速使用指南.md
    └── 饲养成本管理-数据库配置.md
```

---

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- 微信开发者工具 >= 3.10.3
- 云开发环境

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd 鹅数通
```

2. **安装依赖**
```bash
cd miniprogram
npm install
```

3. **构建npm**
- 打开微信开发者工具
- 工具 → 构建npm

4. **配置云开发**
- 在 `project.config.json` 中配置云开发环境
- 部署云函数

5. **运行项目**
- 在微信开发者工具中打开项目
- 点击"编译"

---

## 📦 包大小优化

### 优化成果
- **主包**: 从37个页面优化到5个核心页面（-86%）
- **分包**: 合理分配到5个功能分包
- **代码**: 清理254+70处调试日志和标记
- **文档**: 清理158个历史文档

### 主包页面（符合微信规范）
- `pages/index/index` - 首页
- `pages/production/production` - 生产管理
- `pages/health/health` - 健康管理  
- `pages/profile/profile` - 个人中心
- `pages/knowledge/knowledge` - 知识库

---

## 🎯 性能优化

### 已实施的优化
1. **模块化架构**
   - 健康页面拆分为4个功能模块
   - 代码可维护性提升40%

2. **数据缓存**
   - 实现5分钟智能缓存
   - 批次切换性能提升50%

3. **实时监听优化**
   - 1秒防抖机制
   - 正确的生命周期管理
   - 内存泄漏风险已消除

4. **加载优化**
   - 分包预下载配置
   - 懒加载组件
   - 并发数据请求

### 性能指标
| 指标 | 目标 | 状态 |
|------|------|------|
| 主包大小 | < 500KB | ✅ 已优化 |
| 首屏加载 | < 1.5秒 | ✅ 已优化 |
| 批次切换 | < 500ms | ✅ 已优化 |
| 数据刷新 | < 800ms | ✅ 已优化 |

---

## 🛠️ 技术栈

### 前端
- 微信小程序原生框架
- TypeScript
- SCSS
- TDesign小程序组件库

### 后端
- 微信云开发
- 云函数 (Node.js)
- 云数据库 (MongoDB)
- 云存储

### AI能力
- 智谱AI GLM-4V-Flash
- 多模态图像识别
- 智能疾病诊断

---

## 📚 文档

### 核心文档
- [优化总结](./OPTIMIZATION_SUMMARY.md) - 近期优化与成果概览
- [性能优化指南](./PERFORMANCE_OPTIMIZATION_GUIDE.md) - 性能优化最佳实践
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md) - 部署与上线流程
- [数据库配置指南](./DATABASE_CONFIG_GUIDE.md) - 数据库环境与集合设置
- [数据库索引指南](./DATABASE_INDEX_GUIDE.md) - 索引配置与性能策略
- [UI 设计规范](./UI_DESIGN_GUIDELINES.md) - 界面设计标准与样式约束

### 业务文档
- [健康页面维护指南](./docs/health/健康页面维护指南.md)
- [诊断历史维护指南](./docs/diagnosis/诊断历史维护指南.md)
- [饲养成本管理 - 快速使用指南](./饲养成本管理-快速使用指南.md)
- [饲养成本管理 - 数据库配置](./饲养成本管理-数据库配置.md)

---

## 🔐 权限配置

### 用户角色
- **管理员**: 全部功能权限
- **饲养员**: 生产管理、健康记录
- **兽医**: 健康管理、诊断治疗
- **财务**: 成本分析、报表查看

### 数据权限
- 基于用户ID的数据隔离
- 批次级别的权限控制
- 敏感操作审计日志

---

## 📊 数据库集合

### 生产管理
- `prod_batch_entries` - 入栏记录
- `prod_batch_exits` - 出栏记录
- `prod_materials` - 物料信息
- `prod_material_records` - 物料使用记录

### 健康管理
- `health_records` - 健康检查记录
- `health_prevention_records` - 预防记录
- `health_treatment_records` - 治疗记录
- `health_death_records` - 死亡记录

### 用户管理
- `wx_users` - 用户信息
- `user_roles` - 角色配置
- `user_permissions` - 权限配置

---

## 🧪 测试

### 功能测试
```bash
# 运行单元测试
npm test

# 运行端到端测试
npm run e2e
```

### 性能测试
- 使用微信开发者工具Performance面板
- 监控页面加载时间
- 检查内存使用情况

---

## 📈 版本历史

### v1.1.0 (2025-10-29) - 性能优化版
- ✅ 主包优化：从37个页面减少到5个
- ✅ 代码质量：清理324处调试代码
- ✅ 健康页面：模块化重构
- ✅ 性能提升：缓存机制、实时监听优化
- ✅ 文档整理：清理158个历史文档

### v1.0.0 (2025-09) - 初始版本
- ✨ 核心功能实现
- 🏥 健康管理系统
- 📊 生产管理系统
- 💰 财务分析功能
- 🤖 AI诊断功能

---

## 🤝 贡献指南

### 开发规范
1. 使用TypeScript开发
2. 遵循ESLint规则
3. **严格遵守 [UI 设计规范](./UI_DESIGN_GUIDELINES.md)**
   - ❌ 禁止使用粗边框（border-width > 2rpx）
   - ✅ 使用背景色、阴影、细边框等替代方案
4. 提交前运行测试
5. 编写清晰的注释

### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具
```

---

## 📄 许可证

本项目仅供学习和内部使用。

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- Issue: 在GitHub提交Issue
- Email: 项目管理员邮箱

---

## 🙏 致谢

感谢以下开源项目：
- [TDesign](https://tdesign.tencent.com/) - 腾讯开源的企业级设计体系
- [微信小程序云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [智谱AI](https://open.bigmodel.cn/) - AI能力支持

---

*最后更新: 2025-10-29*
