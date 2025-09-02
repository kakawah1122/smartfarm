# 云函数部署指南

## 重要更新说明

为了支持数据持久化和养殖场名称功能，我们已经更新了云函数代码。你需要重新部署云函数才能使功能正常工作。

## 需要部署的云函数

### 1. 登录云函数 (login)
**位置**: `cloudfunctions/login/`
**更新内容**: 
- 添加了 `farmName` 字段支持
- 确保数据库结构包含养殖场名称
- 优化返回数据结构

### 2. 注册云函数 (register)
**位置**: `cloudfunctions/register/`
**状态**: 已经支持 `farmName`，但建议重新部署确保一致性

## 部署步骤

### 方法一：使用微信开发者工具
1. 打开微信开发者工具
2. 在项目中找到 `cloudfunctions` 文件夹
3. 右键点击 `login` 文件夹 → 选择"上传并部署：云端安装依赖"
4. 右键点击 `register` 文件夹 → 选择"上传并部署：云端安装依赖"
5. 等待部署完成

### 方法二：使用命令行
```bash
# 进入项目目录
cd /Users/kakawah/Documents/Wechat

# 部署登录云函数
npm run deploy:login

# 部署注册云函数
npm run deploy:register
```

## 数据库结构

确保你的云数据库中 `users` 集合包含以下字段：

```javascript
{
  _id: string,           // 自动生成
  _openid: string,       // 微信用户标识
  nickname: string,      // 用户昵称
  avatarUrl: string,     // 头像URL
  phone: string,         // 手机号
  farmName: string,      // 养殖场名称 ⭐ 新增字段
  gender: number,        // 性别 (0-未知, 1-男, 2-女)
  createTime: Date,      // 创建时间
  updateTime: Date,      // 更新时间
  lastLoginTime: Date,   // 最后登录时间
  loginCount: number,    // 登录次数
  isActive: boolean      // 是否活跃
}
```

## 验证部署

部署完成后，你可以通过以下方式验证：

1. **登录测试**: 重新登录小程序，检查是否能正常获取用户信息
2. **数据持久化**: 关闭小程序再打开，看是否保持登录状态
3. **养殖场名称**: 在个人中心查看是否正确显示养殖场名称

## 故障排除

如果遇到问题：

1. **检查云函数日志**: 在微信开发者工具的云开发控制台中查看函数日志
2. **检查数据库权限**: 确保云函数有读写数据库的权限
3. **重新初始化**: 如果数据库集合不存在，首次登录会自动创建

## 注意事项

- 部署前请备份重要数据
- 建议在测试环境先验证功能
- 如果用户反馈登录问题，请检查云函数部署状态
