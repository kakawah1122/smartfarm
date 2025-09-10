#!/bin/bash

# setup-health-database.sh - 健康管理模块数据库配置脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_title() {
    echo ""
    print_message $BLUE "=========================================="
    print_message $BLUE "$1"
    print_message $BLUE "=========================================="
    echo ""
}

print_step() {
    print_message $YELLOW "步骤: $1"
}

print_success() {
    print_message $GREEN "✅ $1"
}

print_error() {
    print_message $RED "❌ $1"
}

print_warning() {
    print_message $YELLOW "⚠️  $1"
}

# 检查依赖
check_dependencies() {
    print_title "检查依赖环境"
    
    # 检查Node.js
    if command -v node > /dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js已安装: $NODE_VERSION"
    else
        print_error "未找到Node.js，请先安装Node.js"
        exit 1
    fi
    
    # 检查npm
    if command -v npm > /dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm已安装: $NPM_VERSION"
    else
        print_error "未找到npm，请先安装npm"
        exit 1
    fi
    
    # 检查微信开发者工具CLI（可选）
    if command -v wx-cli > /dev/null 2>&1; then
        print_success "微信开发者工具CLI已安装"
    else
        print_warning "未找到微信开发者工具CLI，某些自动化功能可能不可用"
    fi
}

# 安装云函数依赖
install_dependencies() {
    print_title "安装云函数依赖"
    
    # 健康管理云函数依赖
    if [ -d "cloudfunctions/health-management" ]; then
        print_step "安装 health-management 云函数依赖"
        cd cloudfunctions/health-management
        npm install
        cd - > /dev/null
        print_success "health-management 依赖安装完成"
    fi
    
    # AI诊断云函数依赖
    if [ -d "cloudfunctions/ai-diagnosis" ]; then
        print_step "安装 ai-diagnosis 云函数依赖"
        cd cloudfunctions/ai-diagnosis
        npm install
        cd - > /dev/null
        print_success "ai-diagnosis 依赖安装完成"
    fi
    
    # 权限配置云函数依赖
    if [ -d "cloudfunctions/setup-health-permissions" ]; then
        print_step "安装 setup-health-permissions 云函数依赖"
        cd cloudfunctions/setup-health-permissions
        npm install
        cd - > /dev/null
        print_success "setup-health-permissions 依赖安装完成"
    fi
}

# 生成权限配置文档
generate_config_docs() {
    print_title "生成权限配置文档"
    
    cat > "database-permissions-guide.md" << 'EOF'
# 健康管理模块数据库权限配置指南

## 快速配置步骤

### 1. 登录微信云开发控制台
访问：https://console.cloud.tencent.com/tcb

### 2. 选择您的云开发环境
确保选择正确的环境（开发/生产）

### 3. 进入数据库管理
控制台 -> 数据库 -> 集合管理

### 4. 配置集合权限
为以下集合配置权限规则：

#### 标准权限集合（创建者读写，其他用户只读）
- `health_records` - 健康记录
- `death_records` - 死亡记录  
- `followup_records` - 跟进记录
- `cure_records` - 治愈记录
- `prevention_records` - 预防记录
- `vaccine_plans` - 疫苗计划
- `treatment_records` - 治疗记录
- `ai_diagnosis_records` - AI诊断记录

**权限规则：**
- 读取权限：`auth.openid != null`
- 写入权限：`auth.openid == resource._openid`

#### 特殊权限集合
- `health_alerts` - 健康预警
  - 读取权限：`auth.openid != null`
  - 写入权限：`false` (只能通过云函数操作)

### 5. 配置数据库索引
在每个集合的索引管理中创建以下索引：

#### health_records
- `{_openid: 1, createTime: -1}`
- `{animalId: 1, createTime: -1}`
- `{severity: 1, createTime: -1}`

#### ai_diagnosis_records
- `{_openid: 1, createTime: -1}`
- `{status: 1, createTime: -1}`
- `{confidence: -1, createTime: -1}`

#### treatment_records
- `{_openid: 1, createTime: -1}`
- `{status: 1, createTime: -1}`
- `{diagnosisId: 1}`

#### health_alerts
- `{severity: 1, createTime: -1}`
- `{status: 1, createTime: -1}`
- `{isDeleted: 1, createTime: -1}`

### 6. 配置云函数环境变量
为 `ai-diagnosis` 云函数配置以下环境变量：
- `AI_DIAGNOSIS_API_URL` - AI诊断API地址
- `AI_DIAGNOSIS_API_KEY` - AI诊断API密钥

### 7. 部署云函数
使用微信开发者工具或命令行部署以下云函数：
- `health-management`
- `ai-diagnosis` 
- `setup-health-permissions`

### 8. 测试权限配置
部署 `setup-health-permissions` 云函数后，可以调用以下方法测试：
- `verify_permissions` - 验证集合权限
- `create_collections` - 创建缺失的集合
- `setup_indexes` - 查看索引配置建议

## 故障排除

### 常见问题
1. **权限拒绝错误**
   - 检查用户登录状态
   - 验证权限规则是否正确设置

2. **集合不存在**
   - 使用 setup-health-permissions 云函数创建集合
   - 手动在控制台创建集合

3. **云函数调用失败**
   - 检查云函数是否正确部署
   - 验证环境变量配置

### 联系支持
如遇到问题，请查看：
- 微信云开发官方文档
- 项目README文件
- health-database-permissions.md 详细配置文档
EOF

    print_success "权限配置指南已生成: database-permissions-guide.md"
}

# 验证配置
verify_setup() {
    print_title "验证配置"
    
    # 检查关键文件
    REQUIRED_FILES=(
        "cloudfunctions/health-management/index.js"
        "cloudfunctions/ai-diagnosis/index.js"
        "cloudfunctions/setup-health-permissions/index.js"
        "health-database-design.md"
        "health-database-permissions.md"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            print_success "$file 存在"
        else
            print_error "$file 缺失"
        fi
    done
    
    # 检查云函数依赖
    CLOUDFUNCTION_DIRS=(
        "cloudfunctions/health-management"
        "cloudfunctions/ai-diagnosis"
        "cloudfunctions/setup-health-permissions"
    )
    
    for dir in "${CLOUDFUNCTION_DIRS[@]}"; do
        if [ -d "$dir/node_modules" ]; then
            print_success "$dir 依赖已安装"
        else
            print_warning "$dir 依赖未安装"
        fi
    done
}

# 主函数
main() {
    print_title "健康管理模块数据库配置脚本"
    
    # 检查是否在正确的目录
    if [ ! -f "project.config.json" ]; then
        print_error "请在小程序项目根目录下运行此脚本"
        exit 1
    fi
    
    # 执行配置步骤
    check_dependencies
    install_dependencies
    generate_config_docs
    verify_setup
    
    print_title "配置完成"
    print_success "健康管理模块数据库配置脚本执行完成！"
    echo ""
    print_message $BLUE "后续步骤："
    echo "1. 阅读 database-permissions-guide.md 配置指南"
    echo "2. 在微信云开发控制台配置数据库权限"
    echo "3. 部署云函数到云开发环境"
    echo "4. 使用 setup-health-permissions 云函数验证配置"
    echo ""
    print_message $GREEN "祝您配置顺利！"
}

# 运行主函数
main "$@"
