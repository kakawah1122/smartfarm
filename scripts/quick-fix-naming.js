#!/usr/bin/env node

/**
 * 快速修复文件命名问题脚本
 * 修复不符合kebab-case规范的文件名
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  {
    old: 'miniprogram/pages/health/health.broken.ts',
    new: 'miniprogram/pages/health/health-broken.ts',
    description: '修复health.broken.ts命名'
  }
];

/**
 * 修复文件命名
 */
function fixFileNaming() {
  console.log('🔧 开始修复文件命名问题...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  filesToFix.forEach(file => {
    const oldPath = path.join(process.cwd(), file.old);
    const newPath = path.join(process.cwd(), file.new);
    
    if (fs.existsSync(oldPath)) {
      try {
        // 检查新文件名是否已存在
        if (fs.existsSync(newPath)) {
          console.log(`⚠️  ${file.description}`);
          console.log(`   目标文件已存在: ${file.new}`);
          errorCount++;
          return;
        }
        
        // 重命名文件
        fs.renameSync(oldPath, newPath);
        console.log(`✅ ${file.description}`);
        console.log(`   ${file.old} -> ${file.new}`);
        successCount++;
        
        // 更新相关引用（如果需要）
        updateReferences(file.old, file.new);
        
      } catch (error) {
        console.log(`❌ ${file.description}`);
        console.log(`   错误: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(`⚠️  ${file.description}`);
      console.log(`   文件不存在: ${file.old}`);
      errorCount++;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 修复结果：');
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${errorCount}`);
  console.log('='.repeat(60) + '\n');
  
  return errorCount === 0;
}

/**
 * 更新文件引用
 */
function updateReferences(oldFile, newFile) {
  // 获取文件名（不含路径）
  const oldName = path.basename(oldFile, path.extname(oldFile));
  const newName = path.basename(newFile, path.extname(newFile));
  
  // 如果文件名相同，不需要更新引用
  if (oldName === newName) {
    return;
  }
  
  console.log(`   正在更新引用...`);
  
  // 搜索并更新引用
  const searchDirs = ['miniprogram', 'cloudfunctions'];
  let updateCount = 0;
  
  searchDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      updateCount += updateReferencesInDirectory(dirPath, oldName, newName);
    }
  });
  
  if (updateCount > 0) {
    console.log(`   更新了 ${updateCount} 处引用`);
  }
}

/**
 * 递归更新目录中的引用
 */
function updateReferencesInDirectory(dirPath, oldName, newName) {
  let updateCount = 0;
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过node_modules等目录
      if (!['node_modules', '.git', 'miniprogram_npm'].includes(item)) {
        updateCount += updateReferencesInDirectory(fullPath, oldName, newName);
      }
    } else {
      // 只处理代码文件
      const ext = path.extname(item);
      if (['.ts', '.js', '.json', '.wxml'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 检查是否包含引用
        const patterns = [
          new RegExp(`import .* from ['"].*${oldName}['"]`, 'g'),
          new RegExp(`require\\(['"].*${oldName}['"]\\)`, 'g'),
          new RegExp(`['"].*${oldName}['"]`, 'g')
        ];
        
        let newContent = content;
        let hasUpdate = false;
        
        patterns.forEach(pattern => {
          if (pattern.test(content)) {
            newContent = newContent.replace(
              new RegExp(oldName, 'g'),
              newName
            );
            hasUpdate = true;
          }
        });
        
        if (hasUpdate) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          updateCount++;
        }
      }
    }
  });
  
  return updateCount;
}

/**
 * 创建修复建议报告
 */
function createFixReport() {
  console.log('\n💡 其他需要手动处理的命名问题：\n');
  
  console.log('1. health-data-loader-v2.ts');
  console.log('   建议改为: health-data-loader-v2.ts (已符合规范)');
  console.log('   或者改为: health-data-loader.ts (去掉版本号)');
  console.log('');
  
  console.log('2. 类/接口命名误报');
  console.log('   检查脚本的正则表达式需要优化，避免误判');
  console.log('   这些是误报，不需要修改');
  console.log('');
  
  console.log('📝 建议：');
  console.log('   1. 定期运行 npm run check:all 检查代码规范');
  console.log('   2. 在提交代码前运行检查，确保符合规范');
  console.log('   3. 将检查加入CI/CD流程，自动化质量控制');
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 文件命名问题快速修复工具\n');
  console.log('='.repeat(60));
  
  // 执行修复
  const success = fixFileNaming();
  
  // 创建报告
  createFixReport();
  
  process.exit(success ? 0 : 1);
}

// 执行
main();
