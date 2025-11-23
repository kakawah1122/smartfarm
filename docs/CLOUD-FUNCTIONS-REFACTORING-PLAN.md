# 云函数架构优化拆分计划

生成时间：2025-11-23 18:15

## 🎯 优化目标

根据**单一职责原则**和**微服务最佳实践**，将大型云函数拆分为模块化、高内聚、低耦合的独立服务。

### 核心原则
- ✅ **单一职责**：每个云函数处理一个业务领域
- ✅ **高内聚**：相关功能聚合在一起
- ✅ **低耦合**：模块间通过标准接口通信
- ✅ **性能优化**：减少跨函数调用，提高响应速度
- ✅ **可维护性**：便于调试、测试和扩展
- ⚠️ **零破坏**：不影响前端UI和现有功能

## 📊 现状分析

### 问题云函数

| 云函数 | Action数量 | 调用频率 | 问题 |
|--------|-----------|---------|------|
| **health-management** | 81个 | 81次/天 | 严重违反单一职责，"上帝函数"反模式 |
| **user-management** | ~30个 | 49次/天 | 职责过多，混合用户、权限、审批 |
| **production-entry** | ~20个 | 38次/天 | 入栏、批次、统计混合 |

### 性能影响
- **冷启动慢**：大函数加载时间长（>3秒）
- **内存占用高**：单函数>256MB
- **调试困难**：81个case难以维护
- **并发受限**：单函数并发上限100

## 🚀 拆分方案

### 一、health-management 拆分（优先级：高）

将81个action拆分为6个独立云函数：

#### 1. **health-records** （健康记录管理）
```javascript
// 15个相关action
- create_health_record
- list_health_records  
- update_health_record
- delete_health_record
- get_health_record_detail
- get_health_records_by_status
- get_batch_health_summary
- calculate_health_rate
// ... 健康记录CRUD和查询
```
**预期效果**：响应时间↓40%，内存占用↓50%

#### 2. **health-treatment** （治疗管理）
```javascript
// 20个相关action
- create_treatment_record
- update_treatment_record
- get_treatment_record_detail
- submit_treatment_plan
- update_treatment_progress
- complete_treatment_as_cured
- complete_treatment_as_died
- get_ongoing_treatments
- add_treatment_note
- add_treatment_medication
// ... 治疗全流程管理
```
**预期效果**：独立治疗流程，便于扩展

#### 3. **health-abnormal** （异常诊断管理）✅ 已存在
```javascript
// 10个相关action（部分已迁移）
- create_abnormal_record
- get_abnormal_record_detail
- list_abnormal_records
- correct_abnormal_diagnosis
- create_treatment_from_abnormal
// ... 异常记录管理
```
**优化建议**：完成剩余action迁移

#### 4. **health-death** （死亡记录管理）
```javascript
// 12个相关action
- create_death_record
- list_death_records
- get_death_stats
- get_death_record_detail
- create_death_record_with_finance
- correct_death_diagnosis
- create_death_from_vaccine
// ... 死亡记录和统计
```
**预期效果**：独立死亡统计，提高查询效率

#### 5. **health-prevention** （预防保健管理）✅ 已存在
```javascript
// 10个相关action（部分已迁移）
- create_prevention_record
- list_prevention_records
- get_prevention_dashboard
- get_prevention_tasks_by_batch
- complete_prevention_task
- update_prevention_effectiveness
// ... 预防和疫苗管理
```
**优化建议**：完成剩余action迁移

#### 6. **health-overview** （数据概览和统计）✅ 已存在
```javascript
// 14个相关action（待迁移）
- get_health_overview
- get_all_batches_health_summary
- get_dashboard_snapshot
- get_health_dashboard_complete
- get_homepage_health_overview
- calculate_batch_cost
- calculate_treatment_cost
// ... 综合统计和仪表盘
```
**下一步**：前端调用迁移

### 二、user-management 拆分（优先级：中）

拆分为3个独立云函数：

#### 1. **user-core** （用户核心功能）
```javascript
// 用户基础管理
- create_user
- update_user
- get_user_info
- delete_user
- update_avatar
```

#### 2. **user-permission** （权限管理）
```javascript
// 权限和角色
- assign_role
- check_permission
- get_user_permissions
- update_permissions
```

#### 3. **user-approval** （审批流程）✅ 已独立
```javascript
// 审批相关（已独立）
- submit_approval
- approve_request
- reject_request
- get_pending_approvals
```

### 三、AI功能整合（优先级：中）

#### 1. **ai-services** （AI服务统一入口）
```javascript
// 整合所有AI功能
- ai_diagnosis（来自ai-diagnosis）
- ai_inventory_count（来自ai-multi-model）
- ai_learning_case（来自ai-learning-cases）
- ai_prompt_optimization
```
**优势**：
- 统一AI服务入口
- 共享模型配置
- 统一计费管理
- Few-shot Learning共享

#### 2. **ai-learning-cases** 增强
```javascript
// 增强学习能力
- save_case（保存学习案例）
- get_similar_cases（获取相似案例）
- update_threshold（动态阈值）
- generate_few_shot_prompts（生成Few-shot提示）
- analyze_accuracy_trends（分析准确率趋势）
```
**目标**：持续提升AI诊断准确率

## 📈 性能预期

### 整体优化效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **平均响应时间** | 800ms | 400ms | ↓50% |
| **冷启动时间** | 3-5秒 | 1-2秒 | ↓60% |
| **内存占用** | 256MB | 128MB | ↓50% |
| **并发能力** | 100 | 600 | ↑500% |
| **代码可维护性** | 低 | 高 | ↑200% |

### 调用链路优化

**优化前**：
```
前端 → health-management(81 actions) → 数据库
         ↓ (平均800ms)
```

**优化后**：
```
前端 → health-records(15 actions) → 数据库
         ↓ (平均300ms)
```

## 🛡️ 安全迁移策略

### 第一阶段：准备（1天）
1. ✅ 创建新云函数框架
2. ✅ 复制共享代码（collections.js、database-manager.js）
3. ✅ 设置环境变量

### 第二阶段：并行运行（3天）
1. 新云函数部署但不启用
2. 灰度切换（10% → 50% → 100%）
3. 监控错误率和性能

### 第三阶段：切换（2天）
1. 前端代码批量替换云函数名
2. 使用映射表兼容旧调用
3. 回退机制准备

### 第四阶段：清理（1天）
1. 确认所有功能正常
2. 删除旧的action
3. 优化和精简代码

## 🔧 实施代码示例

### 1. 云函数路由映射（兼容层）
```javascript
// cloud-function-router.js
const FUNCTION_MAPPING = {
  // health-management拆分映射
  'create_health_record': 'health-records',
  'create_treatment_record': 'health-treatment',
  'create_abnormal_record': 'health-abnormal',
  'create_death_record': 'health-death',
  'create_prevention_record': 'health-prevention',
  'get_health_overview': 'health-overview',
  // ... 完整映射表
}

// 智能路由函数
exports.route = async (action, data) => {
  const targetFunction = FUNCTION_MAPPING[action]
  if (!targetFunction) {
    throw new Error(`Unknown action: ${action}`)
  }
  
  return await wx.cloud.callFunction({
    name: targetFunction,
    data: { action, ...data }
  })
}
```

### 2. 前端调用适配器
```javascript
// utils/cloud-adapter.js
class CloudAdapter {
  static async call(functionName, action, data) {
    // 新架构直接调用
    if (USE_NEW_ARCHITECTURE) {
      const mapping = FUNCTION_MAPPING[action]
      if (mapping) {
        return await safeCloudCall({
          name: mapping,
          data: { action, ...data }
        })
      }
    }
    
    // 兼容旧架构
    return await safeCloudCall({
      name: functionName,
      data: { action, ...data }
    })
  }
}
```

### 3. 共享模块提取
```javascript
// cloudfunctions/common/health-common.js
module.exports = {
  // 共享业务逻辑
  calculateHealthRate: require('./calculate-health-rate'),
  validateHealthData: require('./validate-health-data'),
  formatHealthRecord: require('./format-health-record'),
  // 共享工具函数
  generateRecordId: require('./generate-record-id'),
  DatabaseManager: require('./database-manager'),
  Collections: require('./collections')
}
```

## 📝 注意事项

### ⚠️ 必须遵守
1. **不破坏前端UI**：保持所有返回数据格式不变
2. **向后兼容**：支持新旧两种调用方式
3. **数据一致性**：使用同一个collections.js配置
4. **权限验证**：保持原有权限逻辑
5. **错误处理**：统一错误格式

### ✅ 最佳实践
1. **渐进式迁移**：一次迁移一个模块
2. **充分测试**：每个action都要测试
3. **监控先行**：先部署监控，后迁移功能
4. **文档同步**：及时更新API文档
5. **版本控制**：使用版本号管理API

## 📅 实施计划

### Week 1（2025-11-24 ~ 2025-11-30）
- [ ] Day 1-2：拆分health-records云函数
- [ ] Day 3-4：拆分health-treatment云函数  
- [ ] Day 5：测试和调试

### Week 2（2025-12-01 ~ 2025-12-07）
- [ ] Day 1-2：拆分health-death云函数
- [ ] Day 3-4：完善health-abnormal和health-prevention
- [ ] Day 5：前端调用迁移

### Week 3（2025-12-08 ~ 2025-12-14）
- [ ] Day 1-2：整合AI服务
- [ ] Day 3-4：增强ai-learning-cases
- [ ] Day 5：性能测试和优化

## 🎯 成功标准

1. **功能完整**：所有功能正常运行
2. **性能提升**：响应时间减少50%
3. **代码质量**：每个云函数<500行
4. **零事故**：无生产环境故障
5. **可扩展**：新功能易于添加

---

**制定人**：系统架构团队  
**审核人**：技术负责人  
**状态**：待执行
