/**
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
