import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { ThermalPrintPayload } from './types';
import type { TicketBuildOptions } from './ticket-builder';
import { buildTicketDocument } from './ticket-builder';
import { renderTicketDocument } from './ticket-document';
import { encodeTicketDocument } from './escpos-encoder';
import { isThermalPrintPayloadV1 } from './contract-validation';

interface ContractFixture {
  name: string;
  options: TicketBuildOptions;
  payload: ThermalPrintPayload;
}

const contractsDir = path.join(process.cwd(), 'docs', 'contracts');
const fixtureNames = ['full-80', 'kitchen-58', 'long-text-58', 'hidden-sections-80'];

function loadFixture(name: string): ContractFixture {
  const file = path.join(contractsDir, 'fixtures', `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContractFixture;
}

describe('thermal print contract v1', () => {
  for (const name of fixtureNames) {
    it(`matches semantic snapshot: ${name}`, () => {
      const fixture = loadFixture(name);
      assert.equal(fixture.name, name);
      assert.equal(isThermalPrintPayloadV1(fixture.payload), true);
      const document = buildTicketDocument(fixture.payload, fixture.options);
      const actual = renderTicketDocument(document);
      const expected = fs.readFileSync(
        path.join(contractsDir, 'expected', `${name}.txt`),
        'utf8',
      );
      assert.equal(actual, expected.replace(/\r\n/g, '\n'));
    });
  }

  it('rejects unknown payload versions at the trust boundary and builder', () => {
    const fixture = loadFixture('full-80');
    const unknown = { ...fixture.payload, version: 2 };
    assert.equal(isThermalPrintPayloadV1(unknown), false);
    assert.throws(
      () => buildTicketDocument(unknown as unknown as ThermalPrintPayload, fixture.options),
      /no soportada/,
    );
  });

  it('keeps kitchen output free of prices, totals, payment and address', () => {
    const fixture = loadFixture('kitchen-58');
    const rendered = renderTicketDocument(buildTicketDocument(fixture.payload, fixture.options));
    assert.doesNotMatch(rendered, /TOTAL|Efectivo|No debe imprimirse|S\/ 56\.90/);
  });

  it('honors hidden sections while keeping items and footer', () => {
    const fixture = loadFixture('hidden-sections-80');
    const rendered = renderTicketDocument(buildTicketDocument(fixture.payload, fixture.options));
    assert.doesNotMatch(rendered, /No mostrar|Tarjeta|TOTAL|S\/ 10\.00|Ref:/);
    assert.match(rendered, /Producto sin precio/);
    assert.match(rendered, /Gracias Marca Demo/);
  });

  it('encodes a non-empty ESC/POS buffer for the reference profile', () => {
    const fixture = loadFixture('full-80');
    const document = buildTicketDocument(fixture.payload, fixture.options);
    const target = path.join(os.tmpdir(), 'maxy-contract-test.bin');
    const buffer = encodeTicketDocument(document, target);
    assert.ok(buffer.length > 0);
  });
});
