# 云函数重新部署指南

## 为什么需要重新部署？

我们修改了22个云函数的`package.json`，添加了超时配置（`cloudbaseConfig.timeout`）。这些配置只有在重新部署后才会生效。

## 需要重新部署的云函数清单（22个）

### AI类云函数（3个，20秒超时）
- [ ] ai-diagnosis
- [ ] ai-multi-model
- [ ] process-ai-diagnosis

### 数据处理类云函数（5个，10秒超时）
- [ ] health-management
- [ ] production-material
- [ ] user-management
- [ ] production-entry
- [ ] finance-management

### 迁移类云函数（2个，20秒超时）
- [ ] role-migration
- [ ] task-migration

### 轻量级云函数（12个，5秒超时）
- [ ] breeding-todo
- [ ] dynamic-file-manager
- [ ] login
- [ ] notification-management
- [ ] permission-check
- [ ] production-dashboard
- [ ] production-exit
- [ ] production-management
- [ ] production-upload
- [ ] register
- [ ] setup-health-permissions
- [ ] user-approval
- [ ] weather

## 部署方式

### 方式1：使用微信开发者工具（推荐）

1. **打开微信开发者工具**
2. **进入云开发控制台**：
   - 点击工具栏"云开发"按钮
   - 或者点击菜单：工具 → 云开发

3. **上传并部署云函数**：
   - 点击"云函数"标签
   - 在云函数列表中，找到需要部署的云函数
   - 右键点击云函数文件夹
   - 选择"上传并部署：云端安装依赖"

4. **批量部署**：
   - 可以按住Ctrl/Cmd选择多个云函数
   - 右键选择"上传并部署：云端安装依赖"

5. **验证部署**：
   - 查看部署日志
   - 确认显示"上传成功"

### 方式2：使用命令行工具

```bash
# 安装微信开发者工具CLI（如未安装）
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署单个云函数
tcb fn deploy ai-diagnosis --envId cloud1-3gdruqkn67e1cbe2

# 批量部署（推荐）
tcb fn deploy ai-diagnosis ai-multi-model process-ai-diagnosis \
  health-management production-material user-management \
  production-entry finance-management role-migration \
  task-migration breeding-todo dynamic-file-manager \
  login notification-management permission-check \
  production-dashboard production-exit production-management \
  production-upload register setup-health-permissions \
  user-approval weather --envId cloud1-3gdruqkn67e1cbe2
```

## 部署注意事项

### 1. 选择"云端安装依赖"
- ✅ 推荐：上传并部署：云端安装依赖
- ❌ 不推荐：上传并部署：不安装依赖（会导致依赖缺失）

### 2. 等待部署完成
- 每个云函数部署需要30秒-2分钟
- 不要在部署过程中关闭开发者工具
- 查看控制台日志确认部署成功

### 3. 检查部署状态
在云开发控制台中：
- 云函数列表应显示"运行中"状态
- 点击云函数名称，查看"配置信息"
- 确认"超时时间"显示为设置的值

## 验证超时配置是否生效

### 方法1：查看云函数配置
1. 在微信云开发控制台
2. 点击云函数名称
3. 查看"配置信息"标签
4. 确认"超时时间"字段：
   - AI类应显示：20秒
   - 数据处理类应显示：10秒
   - 轻量级应显示：5秒

### 方法2：测试功能
1. **测试AI诊断**：
   - 打开小程序
   - 进入AI诊断页面
   - 上传图片并提交诊断
   - 观察是否能在20秒内完成（之前可能3秒就超时）

2. **测试健康管理**：
   - 进入健康管理页面
   - 查询批次健康记录
   - 应能在10秒内加载完成

3. **查看云函数日志**：
   - 在云开发控制台查看云函数调用日志
   - 查找"timeout"或"超时"关键词
   - 确认没有超时错误

## 常见问题

### Q1: 部署失败怎么办？
**A**: 检查以下几点：
- 网络连接是否正常
- 云开发环境ID是否正确
- 是否有权限操作该环境
- 尝试重新部署

### Q2: 部署后配置没有生效？
**A**: 
- 确认选择了"云端安装依赖"
- 检查package.json文件是否正确保存
- 尝试清除缓存后重新部署
- 在云开发控制台手动修改超时配置

### Q3: 可以在云开发控制台直接修改超时吗？
**A**: 可以，但不推荐：
- 登录[微信云开发控制台](https://console.cloud.tencent.com/)
- 选择对应云函数
- 点击"函数配置"
- 修改"超时时间"
- 保存配置

但这种方式不会更新本地代码，下次部署会覆盖。

## 部署后的验证清单

### 基础验证
- [ ] 所有22个云函数部署成功
- [ ] 云函数状态显示"运行中"
- [ ] 没有部署错误日志

### 功能验证
- [ ] AI诊断功能正常（不再3秒超时）
- [ ] 健康管理查询正常
- [ ] 用户登录注册正常
- [ ] 生产管理功能正常
- [ ] 财务管理功能正常

### 配置验证
- [ ] AI类云函数超时为20秒
- [ ] 数据处理类云函数超时为10秒
- [ ] 轻量级云函数超时为5秒

## 预期效果

部署完成后，您应该看到：

1. **AI诊断不再超时**
   - 以前：经常在3秒就超时失败
   - 现在：有20秒时间完成诊断，成功率显著提升

2. **数据加载更稳定**
   - 复杂查询不再超时
   - 用户体验改善

3. **系统整体更可靠**
   - 减少"请求超时"错误
   - 提升用户满意度

## 下一步

部署完成后，请：
1. 测试关键功能（特别是AI诊断）
2. 查看云函数日志，确认没有超时错误
3. 继续执行其他优化步骤（数据库配置、分包等）

---

**重要提示**：如果您使用的是CI/CD自动部署，请确保在部署流程中也包含这些云函数的更新。

