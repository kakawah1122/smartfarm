# 健康管理模块完整部署指南

## 概述

本文档详细说明了健康管理模块从零开始的完整部署流程，包括环境配置、数据库设置、云函数部署、权限配置和功能测试。

## 系统架构

### 技术栈
- **前端**: 微信小程序 + TDesign UI组件库
- **后端**: 微信云开发 + Node.js云函数
- **数据库**: 微信云数据库（MongoDB）
- **AI服务**: 外部AI大模型API（可选）
- **存储**: 微信云存储

### 模块结构
```
健康管理模块/
├── 前端页面/
│   ├── 健康中心主页 (health.*)
│   ├── AI智能诊断 (ai-diagnosis.*)
│   └── 诊断历史 (diagnosis-history.*)
├── 云函数/
│   ├── health-management (核心业务逻辑)
│   ├── ai-diagnosis (AI诊断服务)
│   └── setup-health-permissions (权限配置)
├── 数据库集合/
│   ├── health_records (健康记录)
│   ├── ai_diagnosis_records (AI诊断记录)
│   ├── treatment_records (治疗记录)
│   └── 其他业务集合...
└── 配置文件/
    ├── 数据库权限配置
    ├── 环境变量配置
    └── 部署脚本
```

## 部署前准备

### 1. 环境要求
- **开发工具**: 微信开发者工具 (最新稳定版)
- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **微信云开发环境**: 已创建并配置

### 2. 权限要求
- 小程序开发者权限
- 云开发环境管理权限
- 数据库操作权限

### 3. 准备工作清单
- [ ] 确认微信小程序AppID
- [ ] 确认云开发环境ID
- [ ] 准备AI诊断API密钥（如需要）
- [ ] 备份现有数据（如有）

## 第一阶段：环境配置

### 1. 克隆或更新代码

```bash
# 如果是新项目
git clone [项目仓库地址]
cd [项目目录]

# 如果是现有项目更新
git pull origin main
```

### 2. 安装依赖

```bash
# 项目根目录安装小程序依赖
npm install

# 安装各个云函数依赖
cd cloudfunctions/health-management && npm install && cd -
cd cloudfunctions/ai-diagnosis && npm install && cd -
cd cloudfunctions/setup-health-permissions && npm install && cd -
```

### 3. 配置开发工具

1. 打开微信开发者工具
2. 导入项目，选择项目根目录
3. 设置AppID（在project.config.json中确认）
4. 启用云开发（工具栏 -> 云开发）
5. 选择对应的云开发环境

### 4. 验证基础环境

```bash
# 运行环境检查脚本
./setup-health-database.sh
```

## 第二阶段：数据库配置

### 1. 创建数据库集合

#### 方式一：使用云函数自动创建

1. 在微信开发者工具中右击`cloudfunctions/setup-health-permissions`
2. 选择"上传并部署：云端安装依赖"
3. 在云开发控制台调用云函数：

```javascript
// 调用参数
{
  "action": "create_collections"
}
```

#### 方式二：手动创建集合

在云开发控制台 -> 数据库 -> 集合管理中创建以下集合：
- `health_records`
- `death_records`
- `followup_records`
- `cure_records`
- `prevention_records`
- `vaccine_plans`
- `treatment_records`
- `ai_diagnosis_records`
- `health_alerts`

### 2. 配置数据库权限

#### 自动配置（推荐）

调用权限配置云函数：

```javascript
// 在云开发控制台调用 setup-health-permissions
{
  "action": "setup_permissions",
  "testMode": true
}
```

#### 手动配置

按照`health-database-permissions.md`文档逐个配置权限规则：

**标准集合权限**（适用于大部分集合）：
- 读取权限：`auth.openid != null`
- 写入权限：`auth.openid == resource._openid`

**特殊集合权限**：
- `health_alerts`集合：
  - 读取权限：`auth.openid != null`
  - 写入权限：`false`

### 3. 创建数据库索引

#### 通过云函数获取索引配置

```javascript
// 调用 setup-health-permissions
{
  "action": "setup_indexes"
}
```

#### 手动创建关键索引

在云开发控制台为各集合创建以下索引：

**health_records**:
```javascript
{ "_openid": 1, "createTime": -1 }
{ "animalId": 1, "createTime": -1 }
{ "severity": 1, "createTime": -1 }
```

**ai_diagnosis_records**:
```javascript
{ "_openid": 1, "createTime": -1 }
{ "status": 1, "createTime": -1 }
{ "confidence": -1, "createTime": -1 }
```

**treatment_records**:
```javascript
{ "_openid": 1, "createTime": -1 }
{ "status": 1, "createTime": -1 }
{ "diagnosisId": 1 }
```

## 第三阶段：云函数部署

### 1. 配置环境变量

#### AI诊断云函数环境变量

在云开发控制台 -> 云函数 -> `ai-diagnosis` -> 配置 -> 环境变量：

```bash
AI_DIAGNOSIS_API_URL=your_ai_api_url
AI_DIAGNOSIS_API_KEY=your_ai_api_key
```

### 2. 部署云函数

#### 方式一：使用开发者工具

1. 右击`cloudfunctions/health-management`
2. 选择"上传并部署：云端安装依赖"
3. 重复步骤1-2部署其他云函数：
   - `ai-diagnosis`
   - `setup-health-permissions`

#### 方式二：使用命令行（如已配置CLI）

```bash
wx-cli cloudfunctions:deploy health-management
wx-cli cloudfunctions:deploy ai-diagnosis
wx-cli cloudfunctions:deploy setup-health-permissions
```

### 3. 验证云函数部署

在云开发控制台 -> 云函数列表中确认所有函数状态为"部署成功"。

## 第四阶段：功能测试

### 1. 数据库权限测试

```javascript
// 调用 setup-health-permissions 验证权限
{
  "action": "verify_permissions",
  "collection": "health_records"
}
```

对每个关键集合重复此测试。

### 2. 前端页面测试

#### 健康管理中心主页测试
1. 在小程序中导航到健康管理页面
2. 验证四个Tab是否正常显示：
   - 预防管理
   - 健康监控  
   - 诊疗管理
   - 效果分析
3. 检查数据加载是否正常

#### AI诊断功能测试
1. 导航到AI诊断页面
2. 输入测试症状数据
3. 上传测试图片（可选）
4. 提交诊断请求
5. 验证诊断结果显示

#### 诊断历史测试
1. 导航到诊断历史页面
2. 验证历史记录列表显示
3. 测试筛选和查看详情功能

### 3. 云函数业务逻辑测试

#### health-management云函数测试

```javascript
// 测试创建健康记录
{
  "action": "create_health_record",
  "animalId": "TEST001", 
  "symptoms": "测试症状",
  "severity": "mild",
  "location": "测试地点"
}

// 测试获取健康概览
{
  "action": "get_health_overview"
}
```

#### ai-diagnosis云函数测试

```javascript
// 测试AI诊断
{
  "action": "start_diagnosis",
  "symptoms": "发热、咳嗽",
  "affectedCount": 5,
  "dayAge": 30,
  "temperature": 25
}
```

## 第五阶段：生产环境配置

### 1. 环境切换

1. 在`project.config.json`中配置生产环境ID
2. 重新部署云函数到生产环境
3. 在生产环境重复数据库配置步骤

### 2. 性能优化配置

#### 数据库连接池配置
```javascript
// 在云函数中添加连接池配置
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})
```

#### 缓存配置
考虑为高频查询数据添加缓存机制。

### 3. 监控和日志配置

1. 启用云函数日志收集
2. 配置关键指标监控
3. 设置异常告警

## 第六阶段：用户权限和角色配置

### 1. 用户角色定义

根据业务需求定义用户角色：
- **管理员**: 全部功能访问权限
- **饲养员**: 基础健康记录和诊断功能
- **兽医**: 诊断和治疗功能
- **观察员**: 只读权限

### 2. 权限验证机制

在关键云函数中添加角色验证：

```javascript
// 示例：角色验证函数
function validateUserRole(openid, requiredRole) {
  // 实现角色验证逻辑
  return db.collection('users')
    .where({ _openid: openid })
    .get()
    .then(res => {
      const user = res.data[0]
      return user && user.role === requiredRole
    })
}
```

## 故障排除

### 常见问题及解决方案

#### 1. 云函数部署失败
**症状**: 云函数上传失败或运行异常
**解决方案**: 
- 检查Node.js版本兼容性
- 验证package.json依赖配置
- 检查代码语法错误
- 查看云函数运行日志

#### 2. 数据库权限错误
**症状**: 前端无法读取/写入数据
**解决方案**:
- 验证用户登录状态
- 检查权限规则配置
- 确认集合名称正确
- 使用权限测试云函数验证

#### 3. AI诊断功能异常
**症状**: AI诊断无响应或错误
**解决方案**:
- 检查API密钥配置
- 验证外部API可用性  
- 查看云函数日志
- 测试模拟诊断功能

#### 4. 页面显示异常
**症状**: 页面空白或组件显示错误
**解决方案**:
- 检查TDesign组件版本
- 验证样式文件加载
- 检查数据绑定逻辑
- 查看小程序开发者工具控制台

### 日志和调试

#### 启用详细日志
```javascript
// 在云函数中添加详细日志
console.log('函数调用参数:', event)
console.log('用户信息:', wxContext)
console.log('数据库操作结果:', result)
```

#### 前端调试
```javascript
// 在页面中添加调试信息
console.log('页面数据:', this.data)
console.log('云函数调用结果:', result)
```

## 维护和更新

### 定期维护任务
1. **数据库优化**: 定期检查和优化数据库索引
2. **日志清理**: 清理过期的操作日志
3. **性能监控**: 监控云函数执行时间和数据库查询性能
4. **安全审计**: 定期检查权限配置和访问日志

### 版本更新流程
1. 在开发环境测试新功能
2. 备份生产环境数据
3. 部署到预发布环境验证
4. 发布到生产环境
5. 监控系统运行状态

## 技术支持

### 文档参考
- [微信云开发官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/)
- [TDesign组件库文档](https://tdesign.tencent.com/miniprogram/)
- `health-database-design.md` - 数据库设计文档
- `health-database-permissions.md` - 权限配置文档

### 联系方式
如遇到部署问题，请参考项目README或联系技术支持团队。

---

**部署完成检查清单**

- [ ] 所有云函数部署成功
- [ ] 数据库集合创建完成
- [ ] 数据库权限配置正确
- [ ] 数据库索引创建完成
- [ ] 环境变量配置正确
- [ ] 前端页面功能正常
- [ ] AI诊断功能测试通过
- [ ] 用户权限验证正常
- [ ] 生产环境配置完成
- [ ] 监控和日志配置完成

**祝您部署顺利！** 🎉
