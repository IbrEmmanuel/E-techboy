/**
 * Modbus register decoding utilities (pure, no network I/O).
 * Live Modbus TCP/RTU sessions belong on the gateway agent.
 */

export type ByteOrder = "BE" | "LE";
export type WordOrder = "AB" | "BA";
export type ModbusDataType = "uint16" | "int16" | "uint32" | "int32" | "float32" | "boolean";

export type RegisterMapEntry = {
  key: string;
  address: number;
  count?: number;
  type: ModbusDataType;
  scale?: number;
  unit?: string;
  writable?: boolean;
};

function swapWords(hi: number, lo: number, wordOrder: WordOrder): [number, number] {
  return wordOrder === "AB" ? [hi, lo] : [lo, hi];
}

export function decodeRegisters(
  registers: number[],
  entry: RegisterMapEntry,
  opts: { byteOrder?: ByteOrder; wordOrder?: WordOrder } = {},
): number | boolean {
  const byteOrder = opts.byteOrder ?? "BE";
  const wordOrder = opts.wordOrder ?? "AB";
  if (!registers.length) throw new Error("No registers provided");

  if (entry.type === "boolean") {
    return (registers[0] & 0x0001) === 1;
  }

  if (entry.type === "uint16" || entry.type === "int16") {
    let v = registers[0] & 0xffff;
    if (byteOrder === "LE") {
      v = ((v & 0xff) << 8) | ((v >> 8) & 0xff);
    }
    if (entry.type === "int16" && v >= 0x8000) v -= 0x10000;
    return v * (entry.scale ?? 1);
  }

  if (registers.length < 2) throw new Error("uint32/int32/float32 require two registers");
  const [a, b] = swapWords(registers[0] & 0xffff, registers[1] & 0xffff, wordOrder);
  const buf = Buffer.alloc(4);
  if (byteOrder === "BE") {
    buf.writeUInt16BE(a, 0);
    buf.writeUInt16BE(b, 2);
  } else {
    buf.writeUInt16LE(a, 0);
    buf.writeUInt16LE(b, 2);
  }

  let value: number;
  switch (entry.type) {
    case "uint32":
      value = buf.readUInt32BE(0);
      break;
    case "int32":
      value = buf.readInt32BE(0);
      break;
    case "float32":
      value = buf.readFloatBE(0);
      break;
    default:
      throw new Error(`Unsupported type ${entry.type}`);
  }
  return value * (entry.scale ?? 1);
}

export function decodeRegisterMap(
  words: number[],
  map: RegisterMapEntry[],
  opts?: { byteOrder?: ByteOrder; wordOrder?: WordOrder },
): { key: string; value: number | boolean; unit?: string }[] {
  const out: { key: string; value: number | boolean; unit?: string }[] = [];
  for (const entry of map) {
    const count = entry.count ?? (entry.type === "uint16" || entry.type === "int16" || entry.type === "boolean" ? 1 : 2);
    const offset = entry.address;
    if (offset < 0 || offset + count > words.length) {
      throw new Error(`Register range out of bounds for ${entry.key}`);
    }
    const slice = words.slice(offset, offset + count);
    out.push({ key: entry.key, value: decodeRegisters(slice, entry, opts), unit: entry.unit });
  }
  return out;
}
