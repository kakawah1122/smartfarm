#!/usr/bin/env node

/**
 * 重构特定的重复函数
 * 基于检测到的92组重复代码
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 创建交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 问询函数
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// 备份目录
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `specific-refactor-${Date.now()}`);

// 统计
let filesFixed = 0;
let totalRefactors = 0;
let backups = [];

/**
 * 创建备份
 */
function createBackup(filePath, content) {
  const relativePath = path.relative(process.cwd(), filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, content);
  backups.push({ original: filePath, backup: backupPath });
  
  return backupPath;
}

/**
 * 提取onTaskConfirm到公共模块
 */
function extractOnTaskConfirm() {
  const commonTaskPath = path.join(process.cwd(), 'miniprogram/utils/task-common.ts');
  
  if (!fs.existsSync(commonTaskPath)) {
    // 创建公共任务处理模块
    const taskCommonContent = `/**
 * 任务处理公共函数
 */

/**
 * 通用的任务确认处理
 */
export function handleTaskConfirm(task: any, handlers: {
  openVaccineForm?: (task: any) => void;
  openMedicationForm?: (task: any) => void;
  openNutritionForm?: (task: any) => void;
  completeNormalTask?: (task: any) => void;
}) {
  if (!task) return;
  
  if (task.isVaccineTask && handlers.openVaccineForm) {
    handlers.openVaccineForm(task);
  } else if (task.isMedicationTask && handlers.openMedicationForm) {
    handlers.openMedicationForm(task);
  } else if (task.isNutritionTask && handlers.openNutritionForm) {
    handlers.openNutritionForm(task);
  } else if (handlers.completeNormalTask) {
    handlers.completeNormalTask(task);
  }
}

/**
 * 格式化任务数据
 */
export function formatTaskData(task: any) {
  return {
    ...task,
    id: task._id || task.taskId || task.id || '',
    title: task.title || task.taskName || task.content || '未命名任务',
    completed: task.completed || false,
  };
}
`;
    fs.writeFileSync(commonTaskPath, taskCommonContent);
    console.log('  ✅ 创建了task-common.ts模块');
    return true;
  }
  
  return true;
}

/**
 * 重构onTaskConfirm方法
 */
function refactorOnTaskConfirm(content, filePath) {
  let newContent = content;
  let refactored = false;
  
  // 检测onTaskConfirm模式
  const pattern = /onTaskConfirm\(\)\s*\{[\s\S]*?if\s*\(task\.isVaccineTask\)[\s\S]*?\}[\s\S]*?\}/m;
  
  if (pattern.test(content)) {
    // 替换为调用公共函数
    const replacement = `onTaskConfirm() {
    // 添加双击保护
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    const task = this.data.selectedTask
    if (!task) return
    
    // 使用公共任务处理函数
    handleTaskConfirm(task, {
      openVaccineForm: (t) => this.openVaccineForm(t),
      openMedicationForm: (t) => this.openMedicationForm(t),
      openNutritionForm: (t) => this.openNutritionForm(t),
      completeNormalTask: (t) => this.completeNormalTask(t)
    })
  }`;
    
    newContent = newContent.replace(pattern, replacement);
    refactored = true;
    console.log('  ✅ 重构onTaskConfirm方法');
    
    // 添加导入
    if (!content.includes('task-common')) {
      const importStatement = "import { handleTaskConfirm } from '../../utils/task-common';\n";
      
      // 在其他import后添加
      const lastImportIndex = newContent.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const lineEnd = newContent.indexOf('\n', lastImportIndex);
        newContent = newContent.slice(0, lineEnd + 1) + importStatement + newContent.slice(lineEnd + 1);
      } else {
        newContent = importStatement + '\n' + newContent;
      }
      console.log('  ✅ 添加task-common导入');
    }
  }
  
  return { content: newContent, refactored };
}

/**
 * 合并重复的初始化函数
 */
function mergeInitializeFunctions(content, filePath) {
  let newContent = content;
  let refactored = false;
  
  // 查找重复的initializeForm
  const initPattern = /initializeForm\(\)\s*\{[\s\S]*?\n\s*\}/g;
  const matches = content.match(initPattern);
  
  if (matches && matches.length > 1) {
    // 保留第一个，移除其他
    let firstFound = false;
    newContent = newContent.replace(initPattern, (match) => {
      if (!firstFound) {
        firstFound = true;
        return match;
      } else {
        refactored = true;
        console.log('  ✅ 移除重复的initializeForm');
        return '';
      }
    });
  }
  
  return { content: newContent, refactored };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  
  console.log(`\n📄 分析文件: ${path.relative(process.cwd(), filePath)}`);
  
  // 1. 重构onTaskConfirm
  if (filePath.includes('health.ts') || filePath.includes('breeding-todo.ts')) {
    const taskResult = refactorOnTaskConfirm(newContent, filePath);
    if (taskResult.refactored) {
      newContent = taskResult.content;
      hasChanges = true;
      totalRefactors++;
    }
  }
  
  // 2. 合并重复的初始化函数
  const initResult = mergeInitializeFunctions(newContent, filePath);
  if (initResult.refactored) {
    newContent = initResult.content;
    hasChanges = true;
    totalRefactors++;
  }
  
  if (hasChanges) {
    // 创建备份
    const backupPath = createBackup(filePath, content);
    console.log(`  📦 备份创建: ${path.relative(BACKUP_DIR, backupPath)}`);
    
    // 写入修改
    fs.writeFileSync(filePath, newContent);
    
    filesFixed++;
    console.log(`  ✨ 完成重构`);
    
    return true;
  } else {
    console.log('  ℹ️ 未发现需要重构的代码');
  }
  
  return false;
}

/**
 * 查找目标文件
 */
function findTargetFiles() {
  // 根据重复代码报告，明确指定需要处理的文件
  const targetFiles = [
    'miniprogram/pages/health/health.ts',
    'miniprogram/packageHealth/breeding-todo/breeding-todo.ts',
    'miniprogram/packageHealth/disinfection-record/disinfection-record.ts',
    'miniprogram/pages/health/modules/health-batch-module.ts',
    'miniprogram/pages/health/modules/health-analysis-module.ts',
    'miniprogram/pages/health/helpers/cloud-helper.ts'
  ];
  
  const existingFiles = [];
  targetFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      existingFiles.push(fullPath);
    }
  });
  
  return existingFiles;
}

/**
 * 回滚功能
 */
function rollback() {
  console.log('\n⏮️ 开始回滚...');
  
  backups.forEach(({ original, backup }) => {
    const content = fs.readFileSync(backup, 'utf8');
    fs.writeFileSync(original, content);
    console.log(`  ✅ 已恢复: ${path.relative(process.cwd(), original)}`);
  });
  
  // 删除备份目录
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  console.log('✅ 回滚完成！');
}

/**
 * 主程序
 */
async function main() {
  console.log('🔧 特定重复代码重构工具');
  console.log('================================\n');
  
  console.log('📋 重构目标：');
  console.log('   1. 提取onTaskConfirm到公共模块');
  console.log('   2. 合并重复的初始化函数');
  console.log('   3. 基于92组重复代码分析结果\n');
  
  const answer = await question('是否继续？(y/n): ');
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 已取消');
    process.exit(0);
  }
  
  // 创建备份目录
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`\n📁 备份目录: ${path.relative(process.cwd(), BACKUP_DIR)}`);
  
  // 确保有公共任务模块
  extractOnTaskConfirm();
  
  // 查找目标文件
  const files = findTargetFiles();
  console.log(`\n🎯 找到 ${files.length} 个目标文件`);
  
  // 处理文件
  for (const file of files) {
    await processFile(file);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 重构统计：');
  console.log(`   - 修改文件: ${filesFixed} 个`);
  console.log(`   - 重构项: ${totalRefactors} 个`);
  console.log('='.repeat(50));
  
  if (totalRefactors > 0) {
    console.log('\n⚠️  请测试功能是否正常！');
    console.log('   特别注意：');
    console.log('   - 任务确认功能');
    console.log('   - 表单初始化');
    console.log('   - 页面加载');
    
    const testAnswer = await question('\n测试通过了吗？(y/n): ');
    
    if (testAnswer.toLowerCase() !== 'y') {
      rollback();
    } else {
      console.log('\n✅ 重构完成！');
      console.log(`💡 提示：备份保存在 ${path.relative(process.cwd(), BACKUP_DIR)}`);
      
      // 生成报告
      const report = {
        timestamp: new Date().toISOString(),
        filesFixed,
        totalRefactors,
        backupDir: path.relative(process.cwd(), BACKUP_DIR),
        files: backups.map(b => ({
          file: path.relative(process.cwd(), b.original),
          backup: path.relative(process.cwd(), b.backup)
        }))
      };
      
      const reportPath = path.join(__dirname, '..', 'docs', `SPECIFIC-REFACTOR-REPORT-${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 重构报告: ${path.relative(process.cwd(), reportPath)}`);
    }
  } else {
    console.log('\n✅ 没有需要重构的代码');
    // 清理备份目录
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  
  rl.close();
}

// 运行主程序
main().catch(err => {
  console.error('❌ 错误:', err);
  rl.close();
  process.exit(1);
});
