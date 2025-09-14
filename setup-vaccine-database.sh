#!/bin/bash

# 疫苗接种功能数据库集合创建脚本
# 使用方法：chmod +x setup-vaccine-database.sh && ./setup-vaccine-database.sh

set -e

echo "🩹 疫苗接种功能数据库集合创建向导"
echo "=================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "\n${BLUE}📋 $1${NC}"
    echo "----------------------------------------"
}

# 检查疫苗功能需要的集合
check_required_collections() {
    print_step "检查疫苗接种功能需要的数据库集合"
    
    local required_collections=(
        "prevention_records"
        "finance_records" 
        "overview_stats"
    )
    
    print_info "疫苗接种功能需要以下数据库集合："
    for collection in "${required_collections[@]}"; do
        echo "  • $collection"
    done
    
    echo ""
    print_warning "注意：这些集合需要在微信云开发控制台中手动创建"
    print_info "因为微信云开发不支持通过脚本直接创建集合"
}

# 生成权限配置
generate_permission_configs() {
    print_step "生成数据库权限配置"
    
    # 创建权限配置目录
    mkdir -p database-configs
    
    # prevention_records 权限配置
    cat > database-configs/prevention_records_permissions.json << 'EOF'
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
EOF

    # finance_records 权限配置  
    cat > database-configs/finance_records_permissions.json << 'EOF'
{
  "read": "auth.openid != null && (auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance'])",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance']"
}
EOF

    # overview_stats 权限配置
    cat > database-configs/overview_stats_permissions.json << 'EOF'
{
  "read": "auth.openid != null", 
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager'] || auth.openid == resource._openid"
}
EOF

    print_success "权限配置文件已生成到 database-configs/ 目录"
}

# 生成索引创建脚本
generate_index_configs() {
    print_step "生成数据库索引配置"
    
    # prevention_records 索引
    cat > database-configs/prevention_records_indexes.js << 'EOF'
// prevention_records 集合索引配置
// 在微信云开发控制台 -> 数据库 -> 索引 中创建

// 1. 批次查询索引（复合索引）
{
  "batchId": 1,
  "createdAt": -1
}

// 2. 任务关联索引
{
  "vaccination.taskId": 1
}

// 3. 记录类型索引
{
  "recordType": 1,
  "preventionType": 1
}

// 4. 时间范围查询索引
{
  "createdAt": -1
}
EOF

    # finance_records 索引
    cat > database-configs/finance_records_indexes.js << 'EOF'
// finance_records 集合索引配置
// 在微信云开发控制台 -> 数据库 -> 索引 中创建

// 1. 批次和日期查询索引
{
  "batchId": 1,
  "date": -1
}

// 2. 类型和分类索引
{
  "type": 1,
  "category": 1,
  "date": -1
}

// 3. 关联记录索引
{
  "relatedRecord.recordId": 1
}

// 4. 金额排序索引
{
  "amount": -1,
  "date": -1
}
EOF

    # overview_stats 索引
    cat > database-configs/overview_stats_indexes.js << 'EOF'
// overview_stats 集合索引配置
// 在微信云开发控制台 -> 数据库 -> 索引 中创建

// 1. 批次和月份查询索引
{
  "batchId": 1,
  "month": -1
}

// 2. 统计汇总索引
{
  "month": -1,
  "updatedAt": -1
}
EOF

    print_success "索引配置文件已生成到 database-configs/ 目录"
}

# 生成测试云函数
generate_test_function() {
    print_step "生成数据库测试云函数"
    
    mkdir -p test-functions
    
    cat > test-functions/test-vaccine-collections.js << 'EOF'
// 测试疫苗接种功能数据库集合
// 可以在云函数中运行此代码来验证集合创建

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const testResults = []
  
  // 测试集合列表
  const collections = [
    'prevention_records',
    'finance_records', 
    'overview_stats'
  ]
  
  for (const collection of collections) {
    try {
      // 尝试查询集合（不获取数据，只检查访问权限）
      await db.collection(collection).limit(1).get()
      testResults.push({
        collection,
        status: 'success',
        message: `✅ ${collection} 集合可访问`
      })
    } catch (error) {
      testResults.push({
        collection,
        status: 'error', 
        message: `❌ ${collection} 集合访问失败: ${error.message}`
      })
    }
  }
  
  // 测试写入权限（插入测试数据）
  try {
    const testRecord = {
      test: true,
      createdAt: new Date(),
      message: '这是测试数据，创建成功后可以删除'
    }
    
    await db.collection('prevention_records').add({
      data: testRecord
    })
    
    testResults.push({
      collection: 'prevention_records',
      status: 'success',
      message: '✅ prevention_records 写入权限正常'
    })
  } catch (error) {
    testResults.push({
      collection: 'prevention_records', 
      status: 'error',
      message: `❌ prevention_records 写入失败: ${error.message}`
    })
  }
  
  return {
    success: testResults.every(r => r.status === 'success'),
    results: testResults,
    summary: `${testResults.filter(r => r.status === 'success').length}/${testResults.length} 项测试通过`
  }
}
EOF

    print_success "测试云函数已生成到 test-functions/ 目录"
}

# 生成操作指南
generate_setup_guide() {
    print_step "生成操作指南"
    
    cat > vaccine-database-setup-guide.md << 'EOF'
# 疫苗接种功能数据库创建指南

## 🎯 目标
为疫苗接种功能创建必要的数据库集合和权限配置。

## 📋 必需集合
- `prevention_records` - 预防记录
- `finance_records` - 财务记录  
- `overview_stats` - 概览统计

## 🔧 创建步骤

### 步骤 1: 登录微信云开发控制台
1. 访问：https://console.cloud.tencent.com/tcb
2. 选择你的小程序环境
3. 进入"数据库"模块

### 步骤 2: 创建集合
1. 点击"新建集合"
2. 逐个创建以下集合：
   - `prevention_records`
   - `finance_records` 
   - `overview_stats`

### 步骤 3: 配置权限
对每个集合：
1. 点击集合名称进入详情
2. 切换到"权限设置"标签  
3. 复制对应的权限配置代码：
   - `prevention_records`: `database-configs/prevention_records_permissions.json`
   - `finance_records`: `database-configs/finance_records_permissions.json`
   - `overview_stats`: `database-configs/overview_stats_permissions.json`

### 步骤 4: 创建索引
对每个集合：
1. 进入"索引"标签
2. 点击"新建索引"
3. 根据对应的索引配置文件创建索引：
   - `prevention_records`: `database-configs/prevention_records_indexes.js`
   - `finance_records`: `database-configs/finance_records_indexes.js`
   - `overview_stats`: `database-configs/overview_stats_indexes.js`

### 步骤 5: 测试验证
1. 在云函数中部署测试代码：`test-functions/test-vaccine-collections.js`
2. 调用测试云函数验证集合创建成功
3. 检查返回结果确保所有集合都可访问

## ✅ 验证清单
- [ ] prevention_records 集合已创建
- [ ] finance_records 集合已创建  
- [ ] overview_stats 集合已创建
- [ ] 所有集合权限已配置
- [ ] 必要索引已创建
- [ ] 测试验证通过

## 🚨 注意事项
1. 财务记录权限较严格，只有管理员和财务人员可访问
2. 所有记录都需要包含 _openid 字段
3. 建议定期备份重要数据
4. 索引创建可能需要几分钟时间

## 📞 问题排查
如果遇到问题，请检查：
1. 用户角色是否正确配置
2. 权限规则是否正确复制
3. 集合名称是否拼写正确
4. 云函数是否有足够权限
EOF

    print_success "操作指南已生成：vaccine-database-setup-guide.md"
}

# 主函数
main() {
    echo "开始设置疫苗接种功能数据库..."
    echo ""
    
    # 执行各个步骤
    check_required_collections
    generate_permission_configs
    generate_index_configs  
    generate_test_function
    generate_setup_guide
    
    print_step "设置完成"
    print_success "所有配置文件已生成！"
    echo ""
    print_info "接下来的步骤："
    echo "  1. 阅读 vaccine-database-setup-guide.md"
    echo "  2. 在微信云开发控制台中创建集合"
    echo "  3. 配置权限和索引"
    echo "  4. 使用测试云函数验证"
    echo ""
    print_warning "注意：需要在微信云开发控制台中手动创建集合"
    print_info "详细步骤请参考：vaccine-database-setup-guide.md"
    
    echo ""
    echo "📁 生成的文件："
    echo "  • vaccine-database-setup-guide.md - 详细操作指南"
    echo "  • database-configs/ - 权限和索引配置"
    echo "  • test-functions/ - 测试验证代码"
}

# 运行主函数
main
