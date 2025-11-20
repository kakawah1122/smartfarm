/// <reference path="./wx/index.d.ts" />

declare namespace ProductionSchema {
  interface BatchEntry {
    _id?: string
    batchNumber: string
    farmName?: string
    quantity: number
    unitPrice?: number
    totalAmount?: number
    entryDate: string
    supplier?: string
    breed?: string
    userId?: string
    createdAt?: string
    updatedAt?: string
  }

  interface BatchExit {
    _id?: string
    batchNumber: string
    quantity: number
    unitPrice?: number
    totalRevenue?: number
    exitDate: string
    buyer?: string
    channel?: string
    userId?: string
    createdAt?: string
    updatedAt?: string
  }

  interface MaterialRecord {
    _id?: string
    batchId?: string
    materialId: string
    materialName: string
    quantity: number
    unit?: string
    totalCost?: number
    usageDate: string
    userId?: string
    createdAt?: string
    updatedAt?: string
  }
}
