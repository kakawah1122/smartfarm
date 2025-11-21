# 📊 死亡记录成本分解逻辑

## 一、成本计算公式

### 单只损失成本
```
单只损失成本 = 鹅苗成本 + 饲养成本分摊 + 预防成本分摊 + 治疗成本分摊
```

### 各项成本分摊计算（✨已更新）

1. **鹅苗成本**
   - 直接使用入栏单价
   - 公式：`entryUnitCost = batch.unitPrice`

2. **饲养成本分摊**
   - 包括饲料成本 + 物料成本
   - 公式：`avgBreedingCost = (饲料总成本 + 物料总成本) ÷ 总饲喂数量`
   - 分摊基数：累计所有投喂记录的饲喂数量

3. **预防成本分摊**
   - 包括所有预防用药、疫苗成本（来自待办任务执行）
   - 公式：`avgPreventionCost = 预防总成本 ÷ 实际预防数量`
   - 分摊基数：任务的目标数量或实际预防数量

4. **治疗成本分摊**
   - 包括所有治疗用药成本（不管治愈/死亡/进行中）
   - 公式：`avgTreatmentCost = 治疗总成本 ÷ 病鹅数量`
   - 分摊基数：AI诊断的受影响数量（累计所有病鹅）

### 总损失计算
```
总损失 = 单只损失成本 × 死亡数量
```

## 二、数据来源

### 1. 批次信息（prod_batch_entries）
- `unitPrice`：入栏单价（鹅苗成本）
- `currentQuantity`：当前存栏数（用于分摊计算）

### 2. 饲养成本
- **投喂记录**（feed_usage_records）
  - 字段：`totalCost`（根级别）
  - 查询条件：`batchNumber = batch.batchNumber`
  
- **物料记录**（prod_material_records）
  - 字段：`totalCost`（根级别）
  - 查询条件：`batchId = batchId AND type = 'use'`

### 3. 预防成本（health_prevention_records）
- 字段：`costInfo.totalCost`（嵌套对象）
- 查询条件：`batchId = batchId AND isDeleted = false`

### 4. 治疗成本（health_treatment_records）
- 兼容多种数据结构：
  - 标准结构：`costInfo.totalCost`
  - 统计记录：`curedMedicationCost`（所有用药成本）
  - 其他结构：`totalCost` 或 `amount`
- 查询条件：`batchId = batchId`

## 三、显示逻辑

### 前端显示条件
```html
<!-- 始终显示鹅苗成本 -->
<view wx:if="{{record.costBreakdown.entryUnitCost}}">
  鹅苗成本：¥{{record.costBreakdown.entryUnitCost}}
</view>

<!-- 非零时显示饲养成本 -->
<view wx:if="{{record.costBreakdown.breedingCost && record.costBreakdown.breedingCost !== '0.00'}}">
  饲养成本：¥{{record.costBreakdown.breedingCost}}
</view>

<!-- 非零时显示预防成本 -->
<view wx:if="{{record.costBreakdown.preventionCost && record.costBreakdown.preventionCost !== '0.00'}}">
  预防成本：¥{{record.costBreakdown.preventionCost}}
</view>

<!-- 始终显示治疗成本（即使为0） -->
<view wx:if="{{record.costBreakdown.treatmentCost}}">
  治疗成本：¥{{record.costBreakdown.treatmentCost || '0.00'}}
</view>
```

## 四、实际示例

假设某批次数据：
- 入栏单价：¥40.00
- 当前存栏：100只
- **总饲喂数量**：1000只次（10次投喂，每次100只）
- 饲料总成本：¥180.00
- 物料总成本：¥0.00
- **实际预防数量**：200只次（2次预防，每次100只）
- 预防总成本：¥200.00  
- **病鹅数量**：20只（AI诊断受影响数量）
- 治疗总成本：¥2000.00
- 死亡数量：1只（病鹅死亡）

计算过程：
```
饲养成本分摊 = 180 ÷ 1000 = ¥0.18/只次
预防成本分摊 = 200 ÷ 200 = ¥1.00/只次
治疗成本分摊 = 2000 ÷ 20 = ¥100.00/只（只分摊给病鹅）

单只损失成本 = 40 + 0.18 + 1.00 + 100.00 = ¥141.18
总损失 = 141.18 × 1 = ¥141.18
```

**注意**：
- 如果死亡的是健康鹅，则无治疗成本分摊
- 如果死亡的是病鹅，治疗成本完全计入（药已使用）

## 五、已修复的问题

### 1. 治疗成本计算问题
- **问题**：只支持 `costInfo.totalCost` 结构
- **修复**：兼容多种数据结构（curedMedicationCost、totalCost、amount）

### 2. 治疗成本不显示问题
- **问题**：前端条件过严（`treatmentCost !== '0.00'`）
- **修复**：放宽条件，始终显示治疗成本项

### 3. 业务逻辑理解
- **原则**：治疗成本是已发生成本，不管治疗结果如何
- **计算**：包含所有治疗用药成本总和

## 六、部署步骤

1. **部署云函数**
   ```
   云开发控制台 → health-cost
   右键 → 上传并部署：云端安装依赖
   ```

2. **重新创建死亡记录**
   - 死亡记录创建时会调用 `calculateBatchCost`
   - 自动计算并保存成本分解

3. **查看云函数日志**
   - 查看 `[calculateBatchCost] 成本计算结果`
   - 验证治疗成本是否正确计算

## 七、注意事项

1. **成本分摊基于当前存栏数**
   - 如果存栏数为0，分摊成本为0
   - 建议在批次未完全清栏前记录死亡

2. **历史数据更新**
   - 可调用 `recalculateDeathCost` 重新计算历史记录成本
   - 批量更新：`recalculateAllDeathCosts`

3. **数据一致性**
   - 确保治疗记录关联正确的 `batchId`
   - 成本数据应为数字类型或可转换的字符串

---
最后更新：2025-11-21
