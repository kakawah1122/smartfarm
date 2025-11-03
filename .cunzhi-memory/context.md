# 项目上下文信息

## 项目概述

**项目名称**：鹅数通  
**项目类型**：微信小程序云开发项目  
**技术栈**：微信小程序、云开发、TDesign组件库、TypeScript

## 项目规范

本项目有完整的开发规范文档，**所有开发工作必须严格遵循项目规范**。

- **项目规范文档**：`PROJECT_RULES.md`（项目根目录）
- **项目记忆规则**：`.cunzhi-memory/rules.md`
- **UI设计规范**：`UI_DESIGN_GUIDELINES.md`

## 核心规范要点

1. **数据库集合规范**：必须使用 `shared-config/collections.js` 中定义的集合常量，禁止硬编码集合名称
2. **云函数规范**：使用小写字母和下划线命名，必须使用 try-catch 错误处理
3. **包大小限制**：主包≤2MB，分包≤2MB，总包≤16MB
4. **性能优化**：必须使用分包、按需加载、懒加载等优化手段
5. **安全规范**：敏感数据必须通过云函数处理，禁止客户端直接操作

## 项目结构

- `miniprogram/` - 小程序前端代码
- `cloudfunctions/` - 云函数代码
- `shared-config/` - 共享配置文件（包含集合定义）
- `docs/` - 项目文档

## 分包结构

- `packageProduction` - 生产管理模块
- `packageHealth` - 健康管理模块
- `packageUser` - 用户管理模块
- `packageFinance` - 财务管理模块
- `packageAI` - AI诊断模块
