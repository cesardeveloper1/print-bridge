export interface ThermalPrintLineItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  modifiers?: string[];
  notes?: string;
}

export type TicketFieldStyle = 'normal' | 'bold' | 'inverted';
export type DividerStyle = 'none' | 'dashed' | 'solid';

export interface TicketDividers {
  orderNumber?: DividerStyle;
  deliveryMode?: DividerStyle;
  orderId?: DividerStyle;
  customer?: DividerStyle;
  items?: DividerStyle;
  notes?: DividerStyle;
  totals?: DividerStyle;
  payment?: DividerStyle;
  address?: DividerStyle;
  footer?: DividerStyle;
}

export interface TicketBlock {
  order: number;
  visible: boolean;
  style: TicketFieldStyle;
}

export interface TicketCustomerBlock extends TicketBlock {
  showPhone: boolean;
  showAddress: boolean;
}

export interface TicketItemsBlock {
  order: number;
  style: TicketFieldStyle;
  showPrices: boolean;
}

export interface TicketTypeConfig {
  dividers?: TicketDividers;
  showHeader: boolean;
  headerTitle: string;
  headerStyle: TicketFieldStyle;
  showOrderNumber: boolean;
  orderNumberOrder: number;
  showDeliveryMode: boolean;
  deliveryModeOrder: number;
  showOrderId: boolean;
  orderIdOrder: number;
  orderIdStyle: TicketFieldStyle;
  customer: TicketCustomerBlock;
  items: TicketItemsBlock;
  totals: TicketBlock;
  payment: TicketBlock;
  notes: TicketBlock;
  showFooter: boolean;
  footerLine1: string;
  footerLine2: string;
  footerStyle: TicketFieldStyle;
}

export interface BrandTicketConfig {
  full?: TicketTypeConfig;
  kitchen?: TicketTypeConfig;
  // Legacy flat fields (backwards compat — present on old saved configs)
  headerTitle?: string;
  showOrderId?: boolean;
  showCustomerPhone?: boolean;
  showDeliveryAddress?: boolean;
  showItemPrices?: boolean;
  showTotals?: boolean;
  showPaymentMethod?: boolean;
  showSpecialNotes?: boolean;
  footerLine1?: string;
  footerLine2?: string;
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
  summary?: string;
  createdAt?: string;
  currencySymbol?: string;
  printedAt: string;
  ticketConfig?: BrandTicketConfig;
  /** PDF del ticket en base64 — requerido cuando printerType = 'regular' en el bridge */
  pdfBase64?: string;
}

export interface PrintJobMessage {
  type: 'print';
  version: 1;
  thermalPrint: ThermalPrintPayload;
}
