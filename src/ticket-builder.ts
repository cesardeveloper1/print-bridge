import type {
  DividerStyle,
  ThermalPrintPayload,
  TicketFieldStyle,
  TicketTypeConfig,
} from './types';
import {
  paperWidthForLineWidth,
  type TicketAlignment,
  type TicketDocument,
  type TicketInstruction,
  type TicketPaperWidthMm,
} from './ticket-document';

export interface TicketBuildOptions {
  lineWidth: number;
  paperWidthMm?: TicketPaperWidthMm;
}

function resolveConfig(payload: ThermalPrintPayload): TicketTypeConfig {
  const isKitchen = payload.ticketType === 'kitchen';
  const raw = isKitchen ? payload.ticketConfig?.kitchen : payload.ticketConfig?.full;
  const fallback: TicketTypeConfig = isKitchen
    ? {
        showHeader: true,
        headerTitle: '',
        headerStyle: 'bold',
        showOrderNumber: true,
        orderNumberOrder: -2,
        showDeliveryMode: true,
        deliveryModeOrder: -1,
        showOrderId: true,
        orderIdOrder: 0,
        orderIdStyle: 'bold',
        customer: {
          order: 1,
          visible: true,
          style: 'normal',
          showPhone: false,
          showAddress: false,
        },
        items: { order: 2, style: 'normal', showPrices: false },
        totals: { order: 3, visible: false, style: 'normal' },
        payment: { order: 4, visible: false, style: 'normal' },
        notes: { order: 5, visible: true, style: 'inverted' },
        showFooter: true,
        footerLine1: '',
        footerLine2: '',
        footerStyle: 'normal',
      }
    : {
        showHeader: true,
        headerTitle: '',
        headerStyle: 'bold',
        showOrderNumber: true,
        orderNumberOrder: -2,
        showDeliveryMode: true,
        deliveryModeOrder: -1,
        showOrderId: true,
        orderIdOrder: 0,
        orderIdStyle: 'normal',
        customer: {
          order: 1,
          visible: true,
          style: 'normal',
          showPhone: true,
          showAddress: true,
        },
        items: { order: 2, style: 'normal', showPrices: true },
        totals: { order: 3, visible: true, style: 'bold' },
        payment: { order: 4, visible: true, style: 'normal' },
        notes: { order: 5, visible: true, style: 'normal' },
        showFooter: true,
        footerLine1: '',
        footerLine2: '',
        footerStyle: 'normal',
      };

  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...raw,
    customer: { ...fallback.customer, ...(raw.customer || {}) },
    items: { ...fallback.items, ...(raw.items || {}) },
    totals: { ...fallback.totals, ...(raw.totals || {}) },
    payment: { ...fallback.payment, ...(raw.payment || {}) },
    notes: { ...fallback.notes, ...(raw.notes || {}) },
  };
}

function money(value: number | undefined, symbol = 'S/'): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${symbol} ${value.toFixed(2)}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}  ${hours}:${minutes}`;
}

function resolveTemplate(template: string, payload: ThermalPrintPayload): string {
  return template
    .replace(/\{nombre_marca\}/g, payload.brandName || payload.brandSubdomain || '')
    .replace(
      /\{nombre_local\}/g,
      payload.branchName || payload.brandName || payload.brandSubdomain || '',
    )
    .replace(/\{pedido\}/g, payload.orderId || '');
}

function text(
  value: string,
  options: {
    align?: TicketAlignment;
    style?: TicketFieldStyle;
    width?: 1 | 2;
    height?: 1 | 2;
  } = {},
): TicketInstruction {
  return {
    kind: 'text',
    value,
    align: options.align ?? 'left',
    style: options.style ?? 'normal',
    width: options.width ?? 1,
    height: options.height ?? 1,
  };
}

function divider(style: DividerStyle | undefined): TicketInstruction[] {
  if (!style || style === 'none') return [];
  return [{ kind: 'divider', style }];
}

function itemRows(
  quantity: number,
  name: string,
  price: string | undefined,
  showPrices: boolean,
  lineWidth: number,
): string[] {
  const quantityLabel = `${quantity}x `;
  const priceLabel = showPrices && price ? ` ${price}` : '';
  const nameWidth = Math.max(1, lineWidth - quantityLabel.length - priceLabel.length);
  const chunks: string[] = [];
  let remaining = name.trim();
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, nameWidth));
    remaining = remaining.slice(nameWidth);
  }
  if (chunks.length === 0) chunks.push('');

  const indent = ' '.repeat(quantityLabel.length);
  return chunks.map((chunk, index) => {
    const last = index === chunks.length - 1;
    const prefix = index === 0 ? quantityLabel : indent;
    if (!last || !priceLabel) return `${prefix}${chunk}`;
    return `${prefix}${chunk}${' '.repeat(Math.max(0, nameWidth - chunk.length))}${priceLabel}`;
  });
}

export function buildTicketDocument(
  payload: ThermalPrintPayload,
  options: TicketBuildOptions,
): TicketDocument {
  if (payload.version !== 1) {
    throw new Error(`Versión ThermalPrintPayload no soportada: ${String(payload.version)}`);
  }
  if (!Number.isInteger(options.lineWidth) || options.lineWidth < 16) {
    throw new Error(`Ancho de línea inválido: ${String(options.lineWidth)}`);
  }

  const instructions: TicketInstruction[] = [];
  const config = resolveConfig(payload);
  const isKitchen = payload.ticketType === 'kitchen';
  const currency = payload.currencySymbol || 'S/';
  const showCustomer = config.customer.visible ?? true;
  const showPhone = showCustomer && config.customer.showPhone && !!payload.customerPhone;
  const showOrderId = config.showOrderId;
  const showPrices = config.items.showPrices;
  const showTotals = !isKitchen && config.totals.visible;
  const showPayment = !isKitchen && config.payment.visible && !!payload.paymentLabel;
  const showNotes = config.notes.visible;
  const showAddress =
    !isKitchen &&
    config.customer.showAddress &&
    (!!payload.deliveryAddress || !!payload.deliveryAddressRef);

  if (config.showHeader ?? true) {
    const title = config.headerTitle?.trim()
      ? resolveTemplate(config.headerTitle, payload)
      : payload.brandName ||
        payload.branchName ||
        payload.brandSubdomain ||
        (isKitchen ? 'COCINA' : 'TICKET');
    instructions.push(text(title.toUpperCase(), { align: 'center', style: 'bold' }));
  }

  const dateLabel = formatDate(payload.createdAt);
  const shortNumber = payload.orderNumber
    ? `#${payload.orderNumber.split('-').pop()}`
    : `#${payload.orderId.slice(-4)}`;
  const sections: Array<{ order: number; instructions: TicketInstruction[] }> = [];

  if (config.showOrderNumber ?? true) {
    sections.push({
      order: config.orderNumberOrder ?? -2,
      instructions: [
        ...divider(config.dividers?.orderNumber ?? 'solid'),
        text(shortNumber, { align: 'center', style: 'bold', width: 2, height: 2 }),
      ],
    });
  }

  if ((config.showDeliveryMode ?? true) && payload.deliveryMode) {
    sections.push({
      order: config.deliveryModeOrder ?? -1,
      instructions: [
        ...divider(config.dividers?.deliveryMode ?? 'solid'),
        text(payload.deliveryMode.toUpperCase(), { align: 'center', style: 'bold' }),
      ],
    });
  }

  if (showOrderId) {
    sections.push({
      order: config.orderIdOrder ?? 0,
      instructions: [
        ...divider(config.dividers?.orderId ?? 'solid'),
        text(`Ref: ${payload.orderNumber || payload.orderId}`, { align: 'center' }),
      ],
    });
  }

  if (showCustomer || showPhone) {
    const customer: TicketInstruction[] = [
      ...divider(config.dividers?.customer ?? 'solid'),
    ];
    if (showCustomer && payload.customerName) {
      customer.push(text(payload.customerName, { align: 'center', style: 'bold' }));
    }
    if (showCustomer && dateLabel) customer.push(text(dateLabel, { align: 'center' }));
    if (showPhone) customer.push(text(`Tel: ${payload.customerPhone}`, { align: 'center' }));
    sections.push({ order: config.customer.order ?? 1, instructions: customer });
  }

  const items: TicketInstruction[] = [
    ...divider(config.dividers?.items ?? 'solid'),
  ];
  if (showPrices) {
    const headerPrice = 'Precio';
    const padding = ' '.repeat(
      Math.max(0, options.lineWidth - 'Cant. '.length - 'Producto'.length - headerPrice.length - 1),
    );
    items.push(text(`Cant. Producto${padding} ${headerPrice}`));
  } else {
    items.push(text('Cant. Producto'));
  }
  items.push({ kind: 'divider', style: 'solid' });
  for (const item of payload.items || []) {
    const lineTotal =
      item.lineTotal ??
      (item.unitPrice !== undefined ? item.quantity * item.unitPrice : undefined);
    const priceLabel =
      showPrices && lineTotal !== undefined ? `${currency} ${lineTotal.toFixed(2)}` : undefined;
    for (const row of itemRows(
      item.quantity,
      item.name,
      priceLabel,
      showPrices,
      options.lineWidth,
    )) {
      items.push(text(row));
    }
    for (const modifier of item.modifiers || []) items.push(text(`  + ${modifier}`));
    if (item.notes) items.push(text(`  ★ ${item.notes}`));
  }
  sections.push({ order: config.items.order ?? 2, instructions: items });

  if (showNotes && payload.specialNotes) {
    sections.push({
      order: config.notes.order ?? 5,
      instructions: [
        ...divider(config.dividers?.notes ?? 'solid'),
        text('★ Notas del pedido:', { style: 'bold' }),
        text(payload.specialNotes),
      ],
    });
  }

  if (showTotals) {
    const totals: TicketInstruction[] = [
      ...divider(config.dividers?.totals ?? 'solid'),
    ];
    if (payload.productsSubtotal !== undefined) {
      totals.push({
        kind: 'leftRight',
        left: 'Subtotal',
        right: money(payload.productsSubtotal, currency),
        style: 'normal',
      });
    }
    if (payload.deliveryCost !== undefined && payload.deliveryCost > 0) {
      totals.push({
        kind: 'leftRight',
        left: 'Delivery',
        right: money(payload.deliveryCost, currency),
        style: 'normal',
      });
    }
    if (payload.discountAmount !== undefined && payload.discountAmount > 0) {
      totals.push({
        kind: 'leftRight',
        left: 'Descuento',
        right: `-${money(payload.discountAmount, currency)}`,
        style: 'normal',
      });
    }
    if (payload.total !== undefined) {
      totals.push({
        kind: 'leftRight',
        left: 'TOTAL',
        right: money(payload.total, currency),
        style: 'bold',
      });
    }
    if (showPayment) totals.push(text(`Pago: ${payload.paymentLabel}`));
    sections.push({ order: config.totals.order ?? 3, instructions: totals });
  }

  sections
    .sort((left, right) => left.order - right.order)
    .forEach((section) => instructions.push(...section.instructions));

  if (payload.summary) {
    instructions.push({ kind: 'divider', style: 'solid' });
    instructions.push(text('Resumen:', { style: 'bold' }));
    instructions.push(text(payload.summary));
  }

  if (showAddress) {
    instructions.push(...divider(config.dividers?.address ?? 'solid'));
    instructions.push(text('Direccion:', { style: 'bold' }));
    if (payload.deliveryAddress) instructions.push(text(payload.deliveryAddress));
    if (payload.deliveryAddressRef) {
      instructions.push(text('Referencia:'));
      instructions.push(text(payload.deliveryAddressRef));
    }
  }

  if ((config.showFooter ?? true) && (config.footerLine1 || config.footerLine2)) {
    instructions.push(...divider(config.dividers?.footer ?? 'solid'));
    if (config.footerLine1) instructions.push(text(resolveTemplate(config.footerLine1, payload)));
    if (config.footerLine2) instructions.push(text(resolveTemplate(config.footerLine2, payload)));
  }

  instructions.push({ kind: 'divider', style: 'solid' });
  instructions.push(text(`Impreso: ${payload.printedAt}`));
  instructions.push({ kind: 'feed', lines: 1 });
  instructions.push({ kind: 'cut' });

  return {
    contractVersion: 1,
    paperWidthMm: options.paperWidthMm ?? paperWidthForLineWidth(options.lineWidth),
    lineWidth: options.lineWidth,
    instructions,
  };
}
