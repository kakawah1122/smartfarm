#!/usr/bin/env node

/**
 * 前端云函数调用迁移脚本
 * 将直接调用health-management的代码迁移到使用smartCloudCall
 */

const fs = require('fs');
const path = require('path');

// 需要更新的文件列表
const filesToUpdate = [
  {
    path: 'miniprogram/pages/health/health-data-manager.ts',
    description: '健康数据管理器',
    updates: [
      {
        old: `safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_batch_complete_data',`,
        new: `smartCloudCall('get_batch_complete_data', {`
      },
      {
        old: `safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_abnormal_list',`,
        new: `smartCloudCall('get_abnormal_list', {`
      }
    ]
  },
  {
    path: 'miniprogram/pages/health/helpers/cloud-helper.ts',
    description: '云助手',
    updates: [
      {
        old: `safeCloudCall({
      name: 'health-management',
      data: {
        action: 'get_dashboard_snapshot',`,
        new: `smartCloudCall('get_dashboard_snapshot', {`
      },
      {
        old: `safeCloudCall({
      name: 'health-management',
      data: {
        action: 'getPreventionDashboard',`,
        new: `smartCloudCall('getPreventionDashboard', {`
      },
      {
        old: `safeCloudCall({
      name: 'health-management',
      data: {
        action: 'get_batch_complete_data',`,
        new: `smartCloudCall('get_batch_complete_data', {`
      }
    ]
  }
];

// 生成更新后的代码示例
function generateUpdatedCode() {
  return `
// ========== 前端调用迁移示例 ==========

// 1. 导入智能路由函数
import { smartCloudCall } from '@/utils/cloud-adapter'

// 2. 旧调用方式（直接调用health-management）
// ❌ 不推荐
const oldWay = await safeCloudCall({
  name: 'health-management',
  data: {
    action: 'create_health_record',
    batchId: 'batch-001',
    totalCount: 100,
    healthyCount: 95,
    sickCount: 5
  }
})

// 3. 新调用方式（使用智能路由）
// ✅ 推荐
const newWay = await smartCloudCall('create_health_record', {
  batchId: 'batch-001',
  totalCount: 100,
  healthyCount: 95,
  sickCount: 5
})

// 4. 批量更新示例
class HealthService {
  // 创建健康记录
  static async createHealthRecord(data: any) {
    return await smartCloudCall('create_health_record', data)
  }
  
  // 获取批次健康汇总
  static async getBatchHealthSummary(batchId: string) {
    return await smartCloudCall('get_batch_health_summary', { batchId })
  }
  
  // 计算健康率
  static async calculateHealthRate(batchId: string) {
    return await smartCloudCall('calculate_health_rate', { batchId })
  }
  
  // 按状态查询健康记录
  static async getHealthRecordsByStatus(batchId: string, status: string) {
    return await smartCloudCall('get_health_records_by_status', {
      batchId,
      status,
      limit: 20
    })
  }
}

// 5. 错误处理
try {
  const result = await smartCloudCall('create_health_record', data)
  
  if (result.success) {
    wx.showToast({ title: '创建成功' })
  } else {
    wx.showToast({ title: result.error || '创建失败', icon: 'none' })
  }
} catch (error) {
  console.error('调用失败:', error)
  wx.showToast({ title: '网络错误', icon: 'none' })
}
`;
}

// 生成Service层封装
function generateServiceLayer() {
  return `
/**
 * 健康管理服务层
 * 封装所有健康相关的云函数调用
 */

import { smartCloudCall } from '@/utils/cloud-adapter'

export class HealthManagementService {
  // ========== 健康记录管理 ==========
  
  /**
   * 创建健康记录
   */
  static async createHealthRecord(data: {
    batchId: string
    totalCount: number
    healthyCount: number
    sickCount: number
    deadCount: number
    symptoms?: string[]
    diagnosis?: string
    treatment?: string
    notes?: string
  }) {
    return await smartCloudCall('create_health_record', data)
  }
  
  /**
   * 获取健康记录列表
   */
  static async listHealthRecords(batchId: string, page = 1, pageSize = 20) {
    return await smartCloudCall('list_health_records', {
      batchId,
      page,
      pageSize
    })
  }
  
  /**
   * 更新健康记录
   */
  static async updateHealthRecord(recordId: string, updates: any) {
    return await smartCloudCall('update_health_record', {
      recordId,
      ...updates
    })
  }
  
  /**
   * 删除健康记录
   */
  static async deleteHealthRecord(recordId: string) {
    return await smartCloudCall('delete_health_record', {
      recordId
    })
  }
  
  /**
   * 获取健康记录详情
   */
  static async getHealthRecordDetail(recordId: string) {
    return await smartCloudCall('get_health_record_detail', {
      recordId
    })
  }
  
  /**
   * 按状态查询健康记录
   */
  static async getHealthRecordsByStatus(
    batchId: string,
    status: 'abnormal' | 'treating',
    limit = 20
  ) {
    return await smartCloudCall('get_health_records_by_status', {
      batchId,
      status,
      limit
    })
  }
  
  /**
   * 获取批次健康汇总
   */
  static async getBatchHealthSummary(batchId: string) {
    return await smartCloudCall('get_batch_health_summary', {
      batchId
    })
  }
  
  /**
   * 计算健康率
   */
  static async calculateHealthRate(batchId: string) {
    return await smartCloudCall('calculate_health_rate', {
      batchId
    })
  }
  
  // ========== 治疗管理 ==========
  
  /**
   * 创建治疗记录
   */
  static async createTreatmentRecord(data: any) {
    return await smartCloudCall('create_treatment_record', data)
  }
  
  /**
   * 更新治疗记录
   */
  static async updateTreatmentRecord(treatmentId: string, updates: any) {
    return await smartCloudCall('update_treatment_record', {
      treatmentId,
      ...updates
    })
  }
  
  /**
   * 获取治疗记录详情
   */
  static async getTreatmentRecordDetail(treatmentId: string) {
    return await smartCloudCall('get_treatment_record_detail', {
      treatmentId
    })
  }
  
  /**
   * 获取进行中的治疗
   */
  static async getOngoingTreatments(batchId: string) {
    return await smartCloudCall('get_ongoing_treatments', {
      batchId
    })
  }
  
  /**
   * 添加治疗备注
   */
  static async addTreatmentNote(treatmentId: string, note: string) {
    return await smartCloudCall('add_treatment_note', {
      treatmentId,
      note
    })
  }
  
  /**
   * 添加用药记录
   */
  static async addTreatmentMedication(treatmentId: string, medication: any) {
    return await smartCloudCall('add_treatment_medication', {
      treatmentId,
      medication
    })
  }
  
  /**
   * 标记治疗完成（治愈）
   */
  static async completeTreatmentAsCured(treatmentId: string, curedCount: number) {
    return await smartCloudCall('complete_treatment_as_cured', {
      treatmentId,
      curedCount
    })
  }
  
  /**
   * 标记治疗完成（死亡）
   */
  static async completeTreatmentAsDied(treatmentId: string, diedCount: number, deathDetails: any) {
    return await smartCloudCall('complete_treatment_as_died', {
      treatmentId,
      diedCount,
      deathDetails
    })
  }
  
  // ========== 死亡记录管理 ==========
  
  /**
   * 创建死亡记录
   */
  static async createDeathRecord(data: any) {
    return await smartCloudCall('create_death_record', data)
  }
  
  /**
   * 获取死亡记录列表
   */
  static async listDeathRecords(batchId: string, page = 1, pageSize = 20) {
    return await smartCloudCall('list_death_records', {
      batchId,
      page,
      pageSize
    })
  }
  
  /**
   * 获取死亡统计
   */
  static async getDeathStats(batchId: string) {
    return await smartCloudCall('get_death_stats', {
      batchId
    })
  }
  
  /**
   * 获取死亡记录详情
   */
  static async getDeathRecordDetail(recordId: string) {
    return await smartCloudCall('get_death_record_detail', {
      recordId
    })
  }
}
`;
}

// 主函数
function main() {
  console.log('========================================');
  console.log('前端云函数调用迁移指南');
  console.log('========================================\n');
  
  console.log('## 1. 更新导入语句\n');
  console.log('在需要调用云函数的文件顶部添加:');
  console.log("import { smartCloudCall } from '@/utils/cloud-adapter'\n");
  
  console.log('## 2. 替换调用方式\n');
  console.log('### 旧方式（需要替换）:');
  console.log(`await safeCloudCall({
  name: 'health-management',
  data: {
    action: 'create_health_record',
    ...params
  }
})\n`);
  
  console.log('### 新方式（推荐）:');
  console.log(`await smartCloudCall('create_health_record', params)\n`);
  
  console.log('## 3. 需要更新的文件\n');
  
  // 列出所有需要更新的文件
  const searchResult = `
以下文件需要更新（包含health-management调用）:
  
1. pages/health/health.ts (28处)
2. pages/health/health-data-manager.ts (2处)
3. pages/health/health-form-handler.ts (2处)
4. pages/health/helpers/cloud-helper.ts (5处)
5. pages/health/modules/health-batch-module.ts (1处)
6. pages/health/modules/health-data-loader-v2.ts (1处)
7. pages/health/modules/health-data-service.ts (1处)
8. packageHealth/treatment-record/treatment-data-service.ts (9处)
9. packageHealth/treatment-record/treatment-record.ts (多处)
10. packageHealth/treatment-records-list/treatment-records-list.ts (1处)
11. packageHealth/vaccine-records-list/vaccine-records-list.ts (3处)
`;
  
  console.log(searchResult);
  
  console.log('## 4. Service层封装（推荐）\n');
  
  // 生成Service层文件
  const serviceLayerPath = path.join(__dirname, '..', 'miniprogram', 'services', 'health-management-service.ts');
  const serviceLayerCode = generateServiceLayer();
  
  // 确保目录存在
  const serviceDir = path.dirname(serviceLayerPath);
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }
  
  // 写入Service层文件
  fs.writeFileSync(serviceLayerPath, serviceLayerCode);
  console.log('✅ 已生成Service层文件: miniprogram/services/health-management-service.ts\n');
  
  console.log('## 5. 迁移步骤\n');
  console.log('1. 先更新utils/cloud-adapter.ts（已完成）');
  console.log('2. 创建Service层封装（已生成）');
  console.log('3. 逐个文件替换调用方式');
  console.log('4. 测试功能是否正常');
  console.log('5. 部署新云函数到云端\n');
  
  console.log('## 6. 代码示例\n');
  const exampleCode = generateUpdatedCode();
  console.log(exampleCode);
  
  console.log('\n## 7. 注意事项\n');
  console.log('⚠️ 确保新云函数已部署到云端');
  console.log('⚠️ 先在开发环境测试');
  console.log('⚠️ 保留回退方案（USE_NEW_ARCHITECTURE开关）');
  console.log('⚠️ 监控错误日志\n');
  
  console.log('========================================');
  console.log('迁移准备完成！');
  console.log('========================================');
}

// 执行
main();
