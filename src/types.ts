export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter';

export interface User {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  pinCode: string; // 4-6 digit quick PIN
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  price: number;
  cost: number;
  imageUrl?: string;
  image?: string | null;
  barcode?: string;
  isActive: boolean;
  trackInventory: boolean;
  quantity?: number; // Current stock count if tracking inventory
}

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'merged';

export interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  posX: number;
  posY: number;
  mergedWithTableId?: string | null;
}

export type ShiftStatus = 'open' | 'closed';

export interface Shift {
  id: string;
  shiftNumber: number;
  cashierId: string;
  cashierName: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  notes?: string;
  openedAt: string;
  closedAt?: string;
  status: ShiftStatus;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'open' | 'sent_to_kitchen' | 'completed' | 'cancelled';

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes?: string;
}

export interface Order {
  id: string; // client_uuid generated offline or online
  orderNumber: number;
  shiftId: string;
  cashierId: string;
  waiterId?: string | null;
  tableId?: string | null;
  customerId?: string | null;
  orderType: OrderType;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  items: OrderItem[];
  payments: Payment[];
  syncedAt?: string;
  ignoreShiftValidation?: boolean;
}

export interface Payment {
  id: string;
  orderId: string;
  method: 'cash' | 'card' | 'split' | 'other';
  amount: number;
  tendered: number;
  changeDue: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  notes?: string;
  createdAt: string;
}

export interface HeldOrder {
  id: string;
  cashierId: string;
  cartSnapshot: {
    items: {
      product: Product;
      quantity: number;
      notes?: string;
    }[];
    orderType: OrderType;
    tableId?: string | null;
    waiterId?: string | null;
    customerId?: string | null;
  };
  tableId?: string | null;
  customerId?: string | null;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  nameAr: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  changeQty: number;
  reason: string;
  orderId?: string | null;
  createdBy: string;
  createdAt: string;
}
