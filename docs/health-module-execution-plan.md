# Health 页面模块化执行计划

## 🚨 核心原则（必须严格遵守）

1. **不改动任何UI样式** - 所有 WXML 和 SCSS 文件保持不变
2. **不破坏任何功能** - 每个功能必须完全正常工作
3. **遵守项目规则** - 严格按照 PROJECT_RULES.md 执行
4. **渐进式重构** - 一个模块一个模块地进行，每次验证

---

## 📋 执行任务列表

### ✅ 已完成任务
- [x] 分析 health.ts 代码结构
- [x] 创建 health-data-loader-v2.ts 数据加载模块
- [x] 修复数据显示问题
- [x] 恢复所有功能正常运行

### 🔄 待执行任务

---

## 1️⃣ health-form-module.ts（高优先级）

### 目标
提取所有表单相关逻辑到独立模块，包括：
- 表单验证
- 数据提交
- 错误处理
- 状态管理

### 需要提取的功能
```typescript
// 需要从 health.ts 中提取的表单相关函数
- handlePreventionSubmit()      // 预防任务提交
- handleTreatmentSubmit()        // 治疗记录提交
- handleDiagnosisSubmit()        // 诊断记录提交
- validateFormData()             // 表单验证
- resetForm()                    // 表单重置
- showFormDialog()               // 显示表单弹窗
- hideFormDialog()               // 隐藏表单弹窗
```

### 执行步骤
1. **创建 health-form-module.ts**
   ```typescript
   export class HealthFormHandler {
     // 预防表单处理
     static async handlePreventionForm(data: any) { }
     
     // 治疗表单处理
     static async handleTreatmentForm(data: any) { }
     
     // 表单验证
     static validateForm(type: string, data: any) { }
     
     // 表单重置
     static resetForm(page: any, formType: string) { }
   }
   ```

2. **在 health.ts 中调用**
   ```typescript
   import { HealthFormHandler } from './modules/health-form-module'
   
   // 原有函数改为调用模块
   handlePreventionSubmit(e: any) {
     return HealthFormHandler.handlePreventionForm(e.detail)
   }
   ```

3. **验证点**
   - [ ] 所有表单提交功能正常
   - [ ] 验证规则生效
   - [ ] 错误提示正确显示
   - [ ] UI 完全无变化

---

## 2️⃣ health-chart-module.ts（中优先级）

### 目标
提取图表渲染相关逻辑，包括：
- 数据格式化
- 图表配置
- 动态更新

### 需要提取的功能
```typescript
// 图表相关函数
- initCharts()                  // 初始化图表
- updateHealthTrendChart()      // 更新健康趋势图
- updateCostAnalysisChart()     // 更新成本分析图
- formatChartData()             // 格式化图表数据
- getChartOptions()             // 获取图表配置
```

### 执行步骤
1. **创建 health-chart-module.ts**
   ```typescript
   export class HealthChartManager {
     // 获取图表配置
     static getChartConfig(type: string, data: any) { }
     
     // 格式化数据
     static formatData(type: string, rawData: any) { }
     
     // 更新图表
     static updateChart(chartInstance: any, data: any) { }
   }
   ```

2. **保持原有 canvas 组件不变**
   - 不修改 WXML 中的 canvas 标签
   - 不改动任何样式

3. **验证点**
   - [ ] 图表显示正常
   - [ ] 数据更新正确
   - [ ] 交互功能正常
   - [ ] 样式完全一致

---

## 3️⃣ health-batch-module.ts（中优先级）

### 目标
集中处理批次相关逻辑：
- 批次列表管理
- 批次切换
- 批次数据过滤

### 需要提取的功能
```typescript
// 批次管理函数
- loadBatchList()               // 加载批次列表
- handleBatchChange()           // 批次切换
- filterDataByBatch()           // 按批次过滤数据
- getCurrentBatchInfo()         // 获取当前批次信息
- calculateBatchStats()         // 计算批次统计
```

### 执行步骤
1. **创建 health-batch-module.ts**
   ```typescript
   export class HealthBatchManager {
     // 获取批次列表
     static async getBatchList() { }
     
     // 切换批次
     static switchBatch(batchId: string) { }
     
     // 过滤数据
     static filterByBatch(data: any, batchId: string) { }
   }
   ```

2. **保留原有交互逻辑**
   - 下拉选择器不变
   - 切换动画保持
   - 数据刷新机制不变

3. **验证点**
   - [ ] 批次列表正确加载
   - [ ] 切换批次数据正确更新
   - [ ] 全部批次汇总正确
   - [ ] UI 交互流畅

---

## 4️⃣ 重构 health.ts（低优先级）

### 目标
清理已模块化的代码，保留核心逻辑

### 执行原则
1. **只移除已模块化的代码**
2. **保留所有UI相关代码**
3. **保留生命周期函数**
4. **保留数据绑定**

### 预期结果
- 文件从 4758 行减少到约 2000 行
- 代码结构更清晰
- 维护性提升

---

## 5️⃣ 测试验证（高优先级）

### 测试清单
#### 功能测试
- [ ] 健康概览数据显示
- [ ] 预防管理功能
- [ ] 治疗管理功能
- [ ] 效果分析功能
- [ ] 实时监测功能

#### 交互测试
- [ ] 批次切换
- [ ] 标签页切换
- [ ] 表单提交
- [ ] 数据刷新
- [ ] 下拉加载

#### 性能测试
- [ ] 页面加载速度
- [ ] 数据更新速度
- [ ] 内存占用

#### UI测试
- [ ] 样式无变化
- [ ] 布局无错位
- [ ] 动画正常
- [ ] 响应式正常

---

## 6️⃣ 文档更新（低优先级）

### 需要更新的文档
1. **技术架构文档**
   - 模块划分说明
   - 接口定义
   - 数据流程图

2. **开发指南**
   - 模块使用方法
   - 扩展指南
   - 注意事项

3. **API文档**
   - 各模块方法说明
   - 参数说明
   - 返回值说明

---

## ⚠️ 风险控制

### 每个任务必须
1. **先备份原文件**
2. **小步提交**
3. **立即测试**
4. **发现问题立即回滚**

### 禁止操作
- ❌ 修改任何 WXML 文件
- ❌ 修改任何 SCSS/CSS 文件  
- ❌ 改变数据结构
- ❌ 删除任何功能
- ❌ 引入新的依赖

### 允许操作
- ✅ 提取逻辑到模块
- ✅ 优化代码结构
- ✅ 添加类型定义
- ✅ 改进错误处理
- ✅ 增加代码注释

---

## 📅 时间规划

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| health-form-module | 1小时 | 高 |
| health-chart-module | 45分钟 | 中 |
| health-batch-module | 45分钟 | 中 |
| 重构 health.ts | 30分钟 | 低 |
| 测试验证 | 1小时 | 高 |
| 文档更新 | 30分钟 | 低 |

**总计：约4.5小时**

---

## 🎯 成功标准

1. **所有功能100%正常工作**
2. **UI/UX 完全无变化**
3. **性能不降反升**
4. **代码可维护性显著提升**
5. **无新增bug**

---

## 📝 执行记录

### 2024-11-20
- ✅ 创建执行计划
- ✅ 设定待办事项
- ⏳ 等待执行...
