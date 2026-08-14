import type { DividerStyle, TicketFieldStyle } from './types';

export type TicketAlignment = 'left' | 'center' | 'right';
export type TicketPaperWidthMm = 58 | 80 | 112;

export type TicketInstruction =
  | {
      kind: 'text';
      value: string;
      align: TicketAlignment;
      style: TicketFieldStyle;
      width: 1 | 2;
      height: 1 | 2;
    }
  | {
      kind: 'leftRight';
      left: string;
      right: string;
      style: TicketFieldStyle;
    }
  | { kind: 'divider'; style: DividerStyle }
  | { kind: 'feed'; lines: number }
  | { kind: 'cut' };

export interface TicketDocument {
  contractVersion: 1;
  paperWidthMm: TicketPaperWidthMm;
  lineWidth: number;
  instructions: TicketInstruction[];
}

export function paperWidthForLineWidth(lineWidth: number): TicketPaperWidthMm {
  if (lineWidth <= 32) return 58;
  if (lineWidth >= 64) return 112;
  return 80;
}

/** Representación estable para snapshots y comparación entre encoders. */
export function renderTicketDocument(document: TicketDocument): string {
  const lines = [
    `contract=${document.contractVersion} paper=${document.paperWidthMm}mm columns=${document.lineWidth}`,
  ];

  for (const instruction of document.instructions) {
    switch (instruction.kind) {
      case 'text':
        lines.push(
          `TEXT align=${instruction.align} style=${instruction.style} size=${instruction.width}x${instruction.height} ${JSON.stringify(instruction.value)}`,
        );
        break;
      case 'leftRight':
        lines.push(
          `PAIR style=${instruction.style} ${JSON.stringify(instruction.left)} | ${JSON.stringify(instruction.right)}`,
        );
        break;
      case 'divider':
        lines.push(`DIVIDER style=${instruction.style}`);
        break;
      case 'feed':
        lines.push(`FEED lines=${instruction.lines}`);
        break;
      case 'cut':
        lines.push('CUT');
        break;
      default: {
        const exhaustive: never = instruction;
        throw new Error(`Instrucción de ticket no soportada: ${String(exhaustive)}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
