/// <reference path="./wx/index.d.ts" />

declare namespace UserSchema {
  interface WxUser {
    _id?: string
    nickName?: string
    avatarUrl?: string
    role?: string
    phoneNumber?: string
    userId: string
    createdAt?: string
    updatedAt?: string
  }

  interface EmployeeRecord {
    _id?: string
    employeeId: string
    name: string
    role: string
    phone?: string
    department?: string
    status?: 'active' | 'inactive'
    createdAt?: string
    updatedAt?: string
  }

  interface TaskTemplate {
    _id?: string
    dayAge: number
    title: string
    type: string
    category: string
    priority?: string
    description?: string
    dosage?: string
    duration?: number
    materials?: string
    notes?: string
  }

  interface BatchTask {
    _id?: string
    batchId: string
    batchNumber?: string
    title: string
    type: string
    category: string
    status: 'pending' | 'completed' | 'overdue'
    scheduledDate: string
    completedDate?: string
    notes?: string
    operatorId?: string
    createdAt?: string
    updatedAt?: string
  }
}
