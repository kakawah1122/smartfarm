/// <reference path="./wx/index.d.ts" />

declare namespace TaskSchema {
  interface TodoTask {
    _id?: string
    batchId: string
    batchNumber?: string
    title: string
    description?: string
    taskType: 'vaccine' | 'medication' | 'nutrition' | 'inspection' | 'custom'
    status: 'pending' | 'completed' | 'overdue'
    planDate: string
    completedDate?: string
    createdBy?: string
    executorId?: string
    priority?: 'low' | 'medium' | 'high'
    attachments?: string[]
    createdAt?: string
    updatedAt?: string
  }

  interface AiDiagnosisRecord {
    _id?: string
    batchId?: string
    imageUrl?: string
    diagnosisResult: string
    confidence?: number
    suggestions?: string
    createdAt: string
    createdBy?: string
  }
}
