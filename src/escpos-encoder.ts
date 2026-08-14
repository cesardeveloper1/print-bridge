import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from 'node-thermal-printer';
import type { TicketDocument, TicketInstruction } from './ticket-document';

function applyStyle(printer: ThermalPrinter, instruction: TicketInstruction): void {
  if (instruction.kind !== 'text' && instruction.kind !== 'leftRight') return;
  printer.bold(instruction.style === 'bold');
  printer.invert(instruction.style === 'inverted');
}

function resetStyle(printer: ThermalPrinter): void {
  printer.bold(false);
  printer.invert(false);
}

/** Codifica un documento semántico usando el mismo perfil Epson/PC850 del bridge. */
export function encodeTicketDocument(
  document: TicketDocument,
  dummyFile: string,
): Buffer {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `file://${dummyFile.replace(/\\/g, '/')}`,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    breakLine: BreakLine.WORD,
  });

  for (const instruction of document.instructions) {
    switch (instruction.kind) {
      case 'text':
        printer.alignLeft();
        if (instruction.align === 'center') printer.alignCenter();
        if (instruction.align === 'right') printer.alignRight();
        printer.setTextSize(instruction.width - 1, instruction.height - 1);
        applyStyle(printer, instruction);
        printer.println(instruction.value);
        resetStyle(printer);
        printer.setTextSize(0, 0);
        printer.alignLeft();
        break;
      case 'leftRight':
        applyStyle(printer, instruction);
        printer.leftRight(instruction.left, instruction.right);
        resetStyle(printer);
        break;
      case 'divider':
        if (instruction.style !== 'none') printer.drawLine();
        break;
      case 'feed':
        for (let index = 0; index < instruction.lines; index += 1) printer.println('');
        break;
      case 'cut':
        printer.cut();
        break;
      default: {
        const exhaustive: never = instruction;
        throw new Error(`Instrucción ESC/POS no soportada: ${String(exhaustive)}`);
      }
    }
  }

  const buffer = printer.getBuffer();
  if (!buffer || buffer.length === 0) {
    throw new Error('No se pudo generar el ticket (buffer vacío).');
  }
  return buffer;
}
