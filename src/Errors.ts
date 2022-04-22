import { InstrStatement } from "./Interpret";

export class RuntimeError extends Error {}
export class MemoryError extends RuntimeError {}
export class OutOfMemoryError extends MemoryError {
  requestBytes: number;
  constructor(req: number) {
    super(`No enough memory, requiring ${req} bytes`);
    this.requestBytes = req;
  }
}
export class AccessUnallocatedHeapError extends MemoryError {
  address: number;
  constructor(addr: number) {
    super(`Trying to access an unallocated address in heap: ${addr}`);
    this.address = addr;
  }
}
export class ProgramError extends RuntimeError {}
export class InstrNotFoundError extends ProgramError {
  eip: number;
  constructor(eip: number) {
    super(`Unexpected instr end, EIP=${eip}`);
    this.eip = eip;
  }
}
export class LabelNotFoundError extends ProgramError {
  instr: InstrStatement;
  constructor(instr: InstrStatement) {
    super(`Cannot find label, required by ${instr.instr} ${instr.arg1}`);
    this.instr = instr;
  }
}
export class INTNotFoundError extends ProgramError {
  native: string;
  constructor(native: string) {
    super(`Cannot find INT call to ${native}`);
    this.native = native;
  }
}
