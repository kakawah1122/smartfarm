# health-management 云函数 Action 分类分析

## 统计概览
总计 67 个 action，按功能模块分为 6 大类。

## 模块分类

### 1. 预防管理模块 (10个)
- `create_prevention_record` - 创建预防记录
- `list_prevention_records` - 列出预防记录
- `get_prevention_dashboard` / `getPreventionDashboard` - 获取预防看板
- `get_prevention_tasks_by_batch` / `getPreventionTasksByBatch` - 获取批次预防任务
- `get_batch_prevention_comparison` / `getBatchPreventionComparison` - 批次预防对比
- `complete_prevention_task` / `completePreventionTask` - 完成预防任务
- `update_prevention_effectiveness` - 更新预防效果

### 2. 异常管理模块 (7个)  
- `create_abnormal_record` - 创建异常记录
- `get_abnormal_record_detail` - 获取异常记录详情
- `get_abnormal_records` - 获取异常记录列表
- `list_abnormal_records` - 列出异常记录
- `correct_abnormal_diagnosis` - 纠正异常诊断
- `create_health_record` - 创建健康记录
- `get_health_records_by_status` - 按状态获取健康记录

### 3. 治疗管理模块 (18个)
- `create_treatment_from_abnormal` - 从异常创建治疗
- `create_treatment_from_vaccine` - 从疫苗创建治疗
- `create_treatment_from_diagnosis` - 从诊断创建治疗
- `create_treatment_record` - 创建治疗记录
- `get_treatment_record_detail` - 获取治疗记录详情
- `update_treatment_record` - 更新治疗记录
- `submit_treatment_plan` - 提交治疗计划
- `complete_treatment_as_cured` - 完成治疗（治愈）
- `complete_treatment_as_died` - 完成治疗（死亡）
- `get_ongoing_treatments` - 获取进行中的治疗
- `get_treatment_history` - 获取治疗历史
- `update_treatment_progress` - 更新治疗进度
- `get_treatment_detail` - 获取治疗详情
- `add_treatment_note` - 添加治疗备注
- `add_treatment_medication` - 添加治疗用药
- `update_treatment_plan` - 更新治疗计划
- `get_cured_records_list` - 获取治愈记录列表
- `calculate_treatment_cost` - 计算治疗成本

### 4. 死亡管理模块 (8个)
- `create_death_record` / `createDeathRecord` - 创建死亡记录
- `create_death_from_vaccine` - 从疫苗创建死亡记录
- `list_death_records` / `listDeathRecords` - 列出死亡记录
- `get_death_stats` / `getDeathStats` - 获取死亡统计
- `create_death_record_with_finance` - 创建死亡记录（含财务）
- `get_death_records_list` - 获取死亡记录列表
- `get_death_record_detail` - 获取死亡记录详情
- `correct_death_diagnosis` - 纠正死亡诊断

### 5. 成本计算模块 (5个)
- `calculate_batch_cost` / `calculateBatchCost` - 计算批次成本
- `calculate_treatment_cost` - 计算治疗成本
- `calculate_batch_treatment_costs` - 计算批次治疗成本
- `calculate_health_rate` - 计算健康率
- `recalculate_death_cost` - 重算死亡成本
- `recalculate_all_death_costs` - 重算所有死亡成本

### 6. 综合数据模块 (12个)
- `get_health_overview` - 获取健康概览
- `get_all_batches_health_summary` - 获取所有批次健康汇总
- `get_dashboard_snapshot` - 获取仪表盘快照
- `get_health_dashboard_complete` - 获取完整健康仪表盘
- `get_homepage_health_overview` - 获取首页健康概览
- `create_ai_diagnosis` - 创建AI诊断
- `get_batch_prompt_data` - 获取批次提示数据
- `get_diagnosis_history` - 获取诊断历史
- `get_batch_complete_data` - 获取批次完整数据

### 7. 数据修复模块 (7个)
- `fix_diagnosis_treatment_status` - 修复诊断治疗状态
- `fix_treatment_records_openid` - 修复治疗记录openid
- `fix_batch_death_count` - 修复批次死亡数
- `sync_vaccine_costs_to_finance` - 同步疫苗成本到财务

## 拆分建议

基于单一职责原则，建议拆分为以下独立云函数：

1. **health-prevention** - 预防管理（10个action）
2. **health-abnormal** - 异常管理（7个action）  
3. **health-treatment** - 治疗管理（18个action）
4. **health-death** - 死亡管理（8个action）
5. **health-cost** - 成本计算（5个action）
6. **health-overview** - 综合数据（12个action）
7. **health-fix** - 数据修复（7个action）

## 实施策略

1. **保持向后兼容**：health-management 作为路由层，根据action分发到对应的新云函数
2. **逐步迁移**：先创建新云函数，测试通过后再修改路由
3. **共享代码**：将公共函数抽取到 shared-utils 目录
4. **统一返回格式**：所有云函数保持 {success: boolean, data/error} 格式

## 注意事项

- 不修改前端调用代码，保持API接口不变
- 新云函数之间通过数据库交互，避免相互调用
- 每个云函数独立部署，独立测试
- 保留原始云函数作为备份，直到新架构稳定
