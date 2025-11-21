import type {
  InputEvent,
  TapEvent,
  CustomEvent
} from '../../../typings/core';

// components/finance-record-detail-popup/finance-record-detail-popup.ts
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
    // 记录数据
    record: {
      type: Object,
      value: null,
      observer: 'onRecordChange'
    }
  },

  data: {
    detailInfo: null as any
  },

  methods: {
    // 记录数据变化时解析详情
    onRecordChange(newRecord: unknown) {
      if (newRecord) {
        const detailInfo = this.parseRecordDetail(newRecord)
        this.setData({ detailInfo })
      }
    },

    // 解析记录详情
    parseRecordDetail(item: unknown) {
      const detail: unknown = {
        title: item.title,
        type: item.type,
        amount: item.amount,
        date: item.date,
        // 解析出的详细字段
        batchNumber: '',
        customer: '',
        quantity: '',
        breed: '',
        supplier: '',
        applicant: '', // 报销人
        description: ''
      }
      
      // 根据来源类型解析
      if (item.source === 'exit') {
        // 出栏记录
        const raw = item.rawRecord
        detail.batchNumber = raw?.batchNumber || raw?.exitNumber || ''
        detail.customer = raw?.customer || ''
        detail.quantity = raw?.quantity ? `${raw.quantity}羽` : ''
        detail.breed = raw?.breed || ''
      } else if (item.source === 'entry') {
        // 入栏记录
        const raw = item.rawRecord
        detail.batchNumber = raw?.batchNumber || ''
        detail.supplier = raw?.supplier || ''
        detail.quantity = raw?.quantity ? `${raw.quantity}羽` : ''
        detail.breed = raw?.breed || ''
      } else if (item.source === 'feed') {
        // 投喂记录
        const raw = item.rawRecord
        detail.batchNumber = raw?.batchNumber || ''
        detail.quantity = raw?.amount ? `${raw.amount}${raw.unit || '斤'}` : ''
      } else if (item.source === 'purchase') {
        // 采购记录
        const raw = item.rawRecord
        detail.supplier = raw?.supplier || ''
        detail.quantity = raw?.quantity ? `${raw.quantity}${raw.unit || ''}` : ''
        detail.description = raw?.materialName || raw?.name || ''
      } else if (item.source === 'finance') {
        // 财务记录
        const raw = item.rawRecord
        // 如果是报销记录，提取报销人
        if (raw?.isReimbursement && raw?.reimbursement) {
          // applicant 是一个对象，需要提取 name 字段
          const applicant = raw.reimbursement.applicant
          if (typeof applicant === 'object' && applicant !== null) {
            detail.applicant = applicant.name || applicant.nickname || applicant.nickName || ''
          } else if (typeof applicant === 'string') {
            detail.applicant = applicant
          } else {
            detail.applicant = raw.reimbursement.applicantName || raw.operator || ''
          }
        }
        detail.description = item.description || ''
      } else {
        // 手动记录或其他
        detail.description = item.description || ''
      }
      
      return detail
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 弹窗可见性变化
    onVisibleChange(e: InputEvent) {
      if (!e.detail.visible) {
        this.onClose()
      }
    }
  }
})

