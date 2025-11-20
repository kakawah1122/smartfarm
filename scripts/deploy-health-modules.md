# 健康管理云函数模块化部署指南

## 部署前准备
- 确保已备份项目：✅ 已完成（backup-2025-11-20T07-47-08）
- 确保在开发环境测试：建议先在开发环境验证

## 第一批部署（当前）

### 1. health-cost 云函数部署

#### 步骤1：安装依赖
```bash
cd cloudfunctions/health-cost
npm install
```

#### 步骤2：上传部署
在微信开发者工具中：
1. 右键点击 `cloudfunctions/health-cost` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成提示

### 2. health-overview 云函数部署

#### 步骤1：安装依赖
```bash
cd cloudfunctions/health-overview
npm install
```

#### 步骤2：上传部署
在微信开发者工具中：
1. 右键点击 `cloudfunctions/health-overview` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成提示

## 功能测试清单

### health-cost 测试点
- [ ] 批次成本计算（财务 → 成本分析）
- [ ] 治疗成本统计（健康 → 效果分析）
- [ ] 健康率计算（健康 → 首页卡片）

### health-overview 测试点
- [ ] 健康概览（健康管理首页）
- [ ] 批次健康汇总（全部批次模式）
- [ ] 仪表盘数据（今日数据卡片）
- [ ] 首页健康卡片（主页）

## 验证命令

在微信开发者工具控制台执行：

```javascript
// 测试 health-cost
wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'calculate_health_rate'
  }
}).then(res => {
  console.log('health-cost 测试结果:', res.result)
})

// 测试 health-overview  
wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'get_homepage_health_overview'
  }
}).then(res => {
  console.log('health-overview 测试结果:', res.result)
})
```

## 监控要点

部署后观察：
1. **功能是否正常**：所有测试点通过
2. **性能变化**：响应时间是否改善
3. **错误日志**：云开发控制台是否有报错
4. **降级机制**：故意让新云函数失败，检查是否降级到原逻辑

## 回滚方案

如果出现问题：

### 快速回滚（推荐）
1. 不需要修改代码
2. 在云开发控制台删除新云函数
3. health-management 会自动使用原逻辑

### 代码回滚
```bash
# 恢复 health-management 原始版本
git checkout HEAD -- cloudfunctions/health-management/index.js
```

## 成功标准

- ✅ 所有测试点通过
- ✅ 无新增报错
- ✅ 性能有所提升或至少不下降
- ✅ 降级机制正常工作

## 下一批部署计划

如果第一批成功，继续部署：
- health-prevention（预防管理）
- health-abnormal（异常管理）
- health-treatment（治疗管理）

---
**提示**：建议在非高峰期部署，随时准备回滚。
