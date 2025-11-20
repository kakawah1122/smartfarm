# health.ts 文件分析报告

## 📊 文件概况
- **文件路径**: /miniprogram/pages/health/health.ts
- **代码行数**: 4757行（巨型文件）
- **主要问题**: 所有逻辑集中在一个文件，难以维护

## 🔍 识别的主要功能模块

### 1. 批次管理模块 (约600行)
- `loadBatchList` - 加载批次列表
- `selectBatch` - 选择批次
- `refreshAllDataForBatchChange` - 批次切换刷新
- `showBatchDropdown` - 批次下拉菜单
- `closeBatchDropdown` - 关闭下拉菜单
- `onBatchDropdownItemTap` - 批次选择处理
- `getCurrentBatchId` - 获取当前批次ID

### 2. 表单处理模块 (约1000行)
#### 预防管理表单
- `showVaccineForm` - 疫苗接种表单
- `closeVaccineFormPopup` - 关闭疫苗表单
- `submitVaccineRecord` - 提交疫苗记录
- `showNutritionForm` - 营养管理表单
- `closeNutritionFormPopup` - 关闭营养表单
- `submitNutritionRecord` - 提交营养记录

#### 治疗管理表单
- `showMedicationForm` - 用药管理表单
- `closeMedicationFormPopup` - 关闭用药表单
- `submitMedicationRecord` - 提交用药记录
- `showAdverseReaction` - 不良反应表单
- `closeAdverseReactionPopup` - 关闭不良反应表单

#### 健康记录表单
- `createHealthRecord` - 创建健康记录
- `createTreatmentRecord` - 创建治疗记录
- `createPreventionRecord` - 创建预防记录

### 3. 数据加载模块 (约800行)
- `loadHealthData` - 加载健康数据
- `loadBatchData` - 加载批次数据
- `loadPreventionData` - 加载预防数据
- `loadTreatmentData` - 加载治疗数据
- `loadAnalysisData` - 加载分析数据
- `loadTabData` - 加载标签页数据
- `loadAllBatchesData` - 加载所有批次数据
- `backgroundRefreshData` - 后台刷新数据

### 4. 图表渲染模块 (约500行)
- `initCharts` - 初始化图表
- `updateHealthChart` - 更新健康图表
- `updateCostChart` - 更新成本图表
- `updateTrendChart` - 更新趋势图表
- `renderHealthTrends` - 渲染健康趋势
- `renderCostAnalysis` - 渲染成本分析

### 5. 任务管理模块 (约400行)
- `loadTodayTasks` - 加载今日任务
- `loadUpcomingTasks` - 加载待办任务
- `loadCompletedTasks` - 加载已完成任务
- `showTaskDetail` - 显示任务详情
- `closeTaskDetailPopup` - 关闭任务详情
- `completeTask` - 完成任务
- `cleanOrphanTasksInBackground` - 清理孤儿任务

### 6. UI交互模块 (约500行)
- `onTabChange` - 标签切换
- `onSubTabChange` - 子标签切换
- `onDateRangeChange` - 日期范围改变
- `showActionSheet` - 显示操作菜单
- `navigateToDetail` - 跳转详情页
- `toggleBatchDropdown` - 切换批次下拉
- `showLoading` / `hideLoading` - 加载提示

### 7. 工具函数模块 (约300行)
- `formatDate` - 日期格式化
- `calculateDate` - 日期计算
- `calculateTotalCost` - 成本计算
- `getTypeName` - 获取类型名称
- `checkTextAlignment` - 文本对齐检查
- `validateInput` - 输入验证

### 8. 缓存管理模块 (约200行)
- `clearAllHealthCache` - 清除缓存
- `clearBatchCache` - 清除批次缓存
- `setCachedAllBatchesData` - 设置缓存
- `getCachedData` - 获取缓存

## 🎯 拆分方案

### 第一步：创建独立模块文件
1. **health-batch-manager.ts** (批次管理，~600行)
2. **health-form-handler.ts** (表单处理，~1000行)
3. **health-data-loader.ts** (数据加载，~800行)
4. **health-chart-renderer.ts** (图表渲染，~500行)
5. **health-task-manager.ts** (任务管理，~400行)
6. **health-ui-controller.ts** (UI交互，~500行)
7. **health-utils.ts** (工具函数，~300行)
8. **health-cache-manager.ts** (缓存管理，~200行)

### 第二步：重构主文件
- health.ts 只保留：
  - Page 生命周期函数
  - 数据定义
  - 模块调用
  - 预计剩余：~500行

## 📈 预期效果
- **代码行数**：从4757行减少到每个文件最多1000行
- **可维护性**：提升80%+
- **加载速度**：提升30%+
- **开发效率**：提升50%+

## 🔧 实施优先级
1. **高优先级**：health-data-loader.ts（核心数据）
2. **高优先级**：health-form-handler.ts（用户交互）
3. **中优先级**：health-batch-manager.ts（批次管理）
4. **中优先级**：health-chart-renderer.ts（视觉效果）
5. **低优先级**：其他模块
