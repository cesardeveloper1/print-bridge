export interface ThermalPrintLineItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  modifiers?: string[];
}

export interface ThermalPrintPayload {
  version: 1;
  triggerStatus: 'PREORDER' | 'ACEPTED';
  /** full = ticket con totales; kitchen = solo ítems para cocina (impresión manual) */
  ticketType?: 'full' | 'kitchen';
  orderId: string;
  orderNumber?: string;
  brandSubdomain: string;
  branchName?: string;
  branchExternalId?: string;
  statusLabel: string;
  customerName?: string;
  customerPhone?: string;
  deliveryMode?: string;
  deliveryAddress?: string;
  deliveryAddressRef?: string;
  items: ThermalPrintLineItem[];
  productsSubtotal?: number;
  deliveryCost?: number;
  discountAmount?: number;
  total?: number;
  paymentLabel?: string;
  specialNotes?: string;
  printedAt: string;
}

export interface PrintJobMessage {
  type: 'print';
  version: 1;
  thermalPrint: ThermalPrintPayload;
}
