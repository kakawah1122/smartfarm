#!/usr/bin/env node

/**
 * 修复云函数中硬编码的集合名称
 * 将所有硬编码的集合名称替换为引用collections.js
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  {
    file: '../cloudfunctions/login/index.js',
    collections: ['wx_users']
  },
  {
    file: '../cloudfunctions/production-upload/index.js',
    collections: ['file_static_records']
  },
  {
    file: '../cloudfunctions/user-approval/index.js',
    collections: ['wx_users', 'wx_user_invites', 'health_records', 'prod_batch_entries', 'prod_batch_exits', 'sys_approval_logs']
  }
];

// 集合名称映射
const collectionMap = {
  'wx_users': 'WX_USERS',
  'wx_user_invites': 'WX_USER_INVITES',
  'health_records': 'HEALTH_RECORDS',
  'prod_batch_entries': 'PROD_BATCH_ENTRIES',
  'prod_batch_exits': 'PROD_BATCH_EXITS',
  'sys_approval_logs': 'SYS_APPROVAL_LOGS',
  'file_static_records': 'FILE_STATIC_RECORDS'
};

function fixFile(filePath, collections) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`文件不存在: ${fullPath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // 检查是否已引入collections.js
  if (!content.includes("require('./collections.js')") && !content.includes('require("./collections.js")')) {
    // 在cloud.init之后添加引入
    const cloudInitMatch = content.match(/cloud\.init\([^)]*\)/);
    if (cloudInitMatch) {
      const insertPos = content.indexOf(cloudInitMatch[0]) + cloudInitMatch[0].length;
      content = content.slice(0, insertPos) + 
        '\n\n// 引入集合配置\nconst { COLLECTIONS } = require(\'./collections.js\')\n' +
        content.slice(insertPos);
      modified = true;
    }
  }
  
  // 替换硬编码的集合名称
  collections.forEach(collection => {
    const regex = new RegExp(`db\\.collection\\(['"\`]${collection}['"\`]\\)`, 'g');
    const replacement = `db.collection(COLLECTIONS.${collectionMap[collection]})`;
    
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
      modified = true;
      console.log(`✅ 替换 ${collection} -> COLLECTIONS.${collectionMap[collection]}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ 已修复文件: ${filePath}`);
  } else {
    console.log(`ℹ️ 文件无需修改: ${filePath}`);
  }
}

// 执行修复
console.log('🔧 开始修复云函数硬编码问题...\n');

filesToFix.forEach(({ file, collections }) => {
  console.log(`处理文件: ${file}`);
  fixFile(file, collections);
  console.log('');
});

console.log('✅ 修复完成！');
console.log('📌 请手动检查修改后的文件，确保功能正常。');
