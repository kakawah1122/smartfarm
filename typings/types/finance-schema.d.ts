/// <reference path="./wx/index.d.ts" />

declare namespace FinanceSchema {
  interface CostRecord {
    _id?: string
    costType: string
    subCategory?: string
    title: string
    description?: string
    amount: number
    batchId?: string
    costBreakdown?: CostBreakdown
    relatedRecords?: RelatedRecord[]
    costDate: string
    createdAt?: string
    updatedAt?: string
  }

  interface CostBreakdown {
    [key: string]: number | string | CostBreakdown
  }

  interface RelatedRecord {
    recordId: string
    recordType: string
    amount?: number
  }

  interface FinanceOverview {
    totalIncome: number
    totalExpense: number
    netProfit: number
    costByType: Array<{
      type: string
      amount: number
    }>
    incomeByType: Array<{
      type: string
      amount: number
    }>
    costTrend: Array<TrendPoint>
  }

  interface TrendPoint {
    date: string
    amount: number
  }

  interface ReimbursementRecord {
    _id?: string
    applicantId: string
    amount: number
    status: 'pending' | 'approved' | 'rejected'
    category: string
    description?: string
    proofFiles?: string[]
    approvalLogs?: ApprovalLog[]
    createdAt?: string
    updatedAt?: string
  }

  interface ApprovalLog {
    approverId: string
    action: 'approved' | 'rejected'
    remark?: string
    actionTime: string
  }
}
