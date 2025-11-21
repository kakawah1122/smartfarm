// components/task-detail-popup/task-detail-popup.ts
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 任务数据
    task: {
      type: Object,
      value: null
    },
    // 字段多行状态
    fieldMultiline: {
      type: Object,
      value: {
        title: false,
        type: false,
        time: false,
        duration: false,
        materials: false,
        batch: false,
        age: false,
        description: false,
        dosage: false,
        notes: false
      }
    }
  },

  data: {
    confirmText: '完成任务'
  },

  observers: {
    'task': function(task: unknown) {
      if (task) {
        // 根据任务类型设置确认按钮文本
        let confirmText = '完成任务'
        if (task.isVaccineTask) {
          confirmText = '填写接种信息'
        } else if (task.isMedicationTask) {
          confirmText = '领取药品'
        } else if (task.isNutritionTask) {
          confirmText = '领取营养品'
        }
        this.setData({ confirmText })
      }
    }
  },

  methods: {
    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 确认操作
    onConfirm() {
      this.triggerEvent('confirm', { task: this.data.task })
    },

    // 弹窗可见性变化
    onVisibleChange(e: CustomEvent) {
      if (!e.detail.visible) {
        this.onClose()
      }
    }
  }
})

