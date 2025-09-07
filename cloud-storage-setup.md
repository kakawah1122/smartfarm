# 云存储配置指南

## 📁 存储文件夹结构

```
cloud-storage/
├── avatars/                    # 用户头像图片
│   ├── user_{openid}.jpg      # 用户头像文件
│   └── default.png            # 默认头像
├── health-images/              # 健康记录相关图片
│   ├── symptoms/              # 症状图片
│   ├── treatment/             # 治疗过程图片
│   └── recovery/              # 恢复情况图片
├── ai-diagnosis-images/        # AI诊断相关图片
│   ├── input/                 # 诊断输入图片
│   └── analysis/              # 分析结果图片
├── production-images/          # 生产记录图片
│   ├── entry/                 # 入栏图片
│   ├── exit/                  # 出栏图片
│   └── daily/                 # 日常管理图片
├── material-images/            # 物料相关图片
│   ├── feed/                  # 饲料图片
│   ├── medicine/              # 药品图片
│   └── equipment/             # 设备图片
├── weather-images/             # 天气相关图片
│   └── conditions/            # 天气状况图片
├── documents/                  # 文档文件
│   ├── reports/               # 报告文件
│   ├── certificates/          # 证书文件
│   └── manuals/              # 使用手册
└── exports/                   # 导出文件
    ├── health-data/          # 健康数据导出
    ├── production-data/      # 生产数据导出
    └── user-data/           # 用户数据导出
```

## 🔐 存储权限配置

### 基础权限设置
```json
{
  "read": true,
  "write": "resource.openid == auth.openid"
}
```

### 详细权限配置

| 文件夹 | 读权限 | 写权限 | 说明 |
|--------|--------|--------|------|
| `avatars/` | ✅ 公开读取 | ✅ 仅文件所有者 | 用户头像 |
| `health-images/` | ✅ 仅文件所有者 | ✅ 仅文件所有者 | 健康记录图片 |
| `ai-diagnosis-images/` | ✅ 仅文件所有者 | ✅ 仅文件所有者 | AI诊断图片 |
| `production-images/` | ✅ 仅文件所有者 | ✅ 仅文件所有者 | 生产记录图片 |
| `material-images/` | ✅ 仅文件所有者 | ✅ 仅文件所有者 | 物料图片 |
| `weather-images/` | ✅ 公开读取 | ❌ 仅云函数 | 天气图片 |
| `documents/` | ✅ 仅文件所有者 | ✅ 仅文件所有者 | 文档文件 |
| `exports/` | ✅ 仅文件所有者 | ❌ 仅云函数 | 导出文件 |

## 📋 配置步骤

### 1. 创建存储环境
1. 登录**微信云开发控制台**
2. 进入**存储**模块
3. 点击"新建文件夹"

### 2. 创建文件夹结构
按照上述目录结构逐级创建文件夹

### 3. 配置文件夹权限
为每个文件夹设置适当的权限规则

### 4. 上传默认文件
上传默认头像等必要的初始文件

## 🔧 权限规则详解

### 用户头像权限 (avatars/)
```json
{
  "read": true,
  "write": "resource.openid == auth.openid"
}
```
- **读权限**：公开，所有用户可查看头像
- **写权限**：仅文件所有者可修改

### 私有图片权限 (health-images/, production-images/ 等)
```json
{
  "read": "resource.openid == auth.openid",
  "write": "resource.openid == auth.openid"
}
```
- **读写权限**：仅文件所有者可访问

### 系统文件权限 (exports/, weather-images/)
```json
{
  "read": "resource.openid == auth.openid",
  "write": false
}
```
- **读权限**：仅文件所有者可读取
- **写权限**：仅云函数可写入

## 📝 文件命名规范

### 用户相关文件
```
{openid}_{timestamp}_{type}.{ext}
例：oxxx123_1640995200000_avatar.jpg
```

### 记录相关文件
```
{record_type}_{record_id}_{index}.{ext}
例：health_H123456_001.jpg
```

### 导出文件
```
{data_type}_export_{timestamp}.{ext}
例：health_data_export_1640995200000.xlsx
```

## ⚠️ 注意事项

1. **文件大小限制**
   - 单个文件最大 100MB
   - 图片建议压缩后上传

2. **文件格式建议**
   - 图片：JPG, PNG, WEBP
   - 文档：PDF, DOC, XLSX
   - 导出：JSON, CSV, XLSX

3. **安全建议**
   - 定期清理临时文件
   - 监控存储使用量
   - 备份重要数据

4. **性能优化**
   - 使用CDN加速访问
   - 图片懒加载
   - 定期清理无用文件
