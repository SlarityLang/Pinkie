import {
  AccessUnallocatedHeapError,
  InstrNotFoundError,
  LabelNotFoundError,
} from "./Errors";
import { debug, warn } from "./Logger";
import { initHeap, isSafeHeap, Memory } from "./Memory";
import { callNativeFunction } from "./Natives";

export const InstrSet = {
  MOV: "MOV", // MOV var
  DEL: "DEL",
  ADD: "ADD",
  SUB: "SUB",
  MUL: "MUL",
  CMP: "CMP",
  AND: "AND", // Boolean only
  OR: "OR", // Boolean only
  XOR: "XOR", // Boolean only
  NOT: "NOT", // Boolean only
  DIV: "DIV",
  RET: "RET",
  CALL: "CALL", // Call defined functions
  JMP: "JMP",
  PUSH: "PUSH",
  PUSH0: "PUSH0",
  POP: "POP",
  POP0: "POP0",
  JE: "JE",
  JNE: "JNE",
  JB: "JB",
  JBE: "JBE",
  JA: "JA",
  JAE: "JAE",
  INT: "INT", // Call native functions
  NOP: "NOP",
  END: "END",
  OUT: "OUT", // OUT <addr> <value>
  IN: "IN", // IN <value> <addr>
};

export interface InstrStatement {
  instr: string;
  arg1: string;
  arg2: string;
}

export interface ProgramExecutable {
  code: InstrStatement[];
  labels: Map<string, number>;
}

export interface Program {
  exec: ProgramExecutable;
  memory: Memory;
  meta: Map<string, string>;
  callStack: string[];
}

function generateBootStrap(bin: InstrStatement[], entry: string): number {
  bin.unshift(
    { instr: "CALL", arg1: entry, arg2: "" },
    { instr: "END", arg1: "", arg2: "" }
  );
  return 2; // Offset
}

export function loadProgram(
  source: string,
  heapSize: number,
  entry: string
): Program {
  let lns = source.split("\n");
  let bin: InstrStatement[] = [];
  let labels: Map<string, number> = new Map();
  let meta = new Map();
  let lineNo = generateBootStrap(bin, entry);
  for (let l of lns) {
    let l0 = l.trim().split(";")[0];
    if (!l0) {
      continue;
    }
    if (l0.startsWith("#")) {
      let l1 = l0.slice(1);
      let [k, v] = l1.split(/\s+/);
      if (!v) {
        v = "";
      }
      meta.set(k, v);
      continue;
    }
    if (l0.endsWith(":")) {
      // Label
      let l1 = l0.slice(0, -1);
      labels.set(l1, lineNo);
      continue;
    }
    let [instr, a1, a2] = l0.split(/\s+/);
    bin.push({ instr: instr, arg1: a1 || "", arg2: a2 || "" });
    lineNo++;
  }
  let mem = initHeap(heapSize);
  return {
    exec: {
      code: bin,
      labels: labels,
    },
    memory: mem,
    meta: meta,
    callStack: [],
  };
}

let savedStacks: Record<string, number>[] = [];

function saveStack(stack: Record<string, number>): void {
  let o: any = {};
  for (let [k, v] of Object.entries(stack)) {
    o[k] = v;
  }
  savedStacks.push(o);
}
function loadStack(prog: Program): void {
  let o = savedStacks.pop();
  if (!o) {
    return;
  }
  let callFun = prog.callStack.pop();
  if (callFun) {
    callFun = callFun.slice(1); // 'F' prefix
    let ret = `*${callFun}`;
    o[ret] = prog.memory.varMap[ret];
  }
  prog.memory.varMap = {};
  for (let [k, v] of Object.entries(o)) {
    prog.memory.varMap[k] = v;
  }
}

export function runProgram(prog: Program, opts: any): void {
  let progs = prog.exec.code;
  let labels = prog.exec.labels;
  let eip = 0;
  function internalJMP(instr: InstrStatement) {
    debug("Jump to " + instr.arg1);
    let lbs = labels.get(instr.arg1);
    if (lbs === undefined) {
      throw new LabelNotFoundError(instr);
    }
    eip = lbs;
  }
  let immValueRegex = /^[0-9]+$/;
  while (true) {
    let curr = progs[eip];
    if (!curr) {
      throw new InstrNotFoundError(eip);
    }
    if (curr.instr === InstrSet.END) {
      break;
    }
    switch (curr.instr) {
      case InstrSet.JMP:
        internalJMP(curr);
        break;
      case InstrSet.DEL:
        delete prog.memory.varMap[curr.arg1];
        eip++;
        break;
      case InstrSet.MOV:
        if (immValueRegex.test(curr.arg2)) {
          prog.memory.varMap[curr.arg1] = parseInt(curr.arg2);
        } else {
          prog.memory.varMap[curr.arg1] = prog.memory.varMap[curr.arg2] || 0;
        }
        eip++;
        break;
      case InstrSet.INT:
        callNativeFunction(curr.arg1, prog);
        eip++;
        break;
      case InstrSet.NOP:
        warn("Null operation detected, which is not recommended");
        eip++;
        break;
      case InstrSet.ADD:
        prog.memory.varMap[curr.arg1] =
          (prog.memory.varMap[curr.arg1] || 0) +
          (prog.memory.varMap[curr.arg2] || 0);
        eip++;
        break;
      case InstrSet.SUB:
        prog.memory.varMap[curr.arg1] =
          (prog.memory.varMap[curr.arg1] || 0) -
          (prog.memory.varMap[curr.arg2] || 0);
        eip++;
        break;
      case InstrSet.MUL:
        prog.memory.varMap[curr.arg1] =
          (prog.memory.varMap[curr.arg1] || 0) *
          (prog.memory.varMap[curr.arg2] || 0);
        eip++;
        break;
      case InstrSet.DIV:
        prog.memory.varMap[curr.arg1] =
          (prog.memory.varMap[curr.arg1] || 0) /
          (prog.memory.varMap[curr.arg2] || 0);
        eip++;
        break;
      case InstrSet.AND: {
        let i1 = prog.memory.varMap[curr.arg1] || 0;
        let i2 = prog.memory.varMap[curr.arg2] || 0;
        if (i1 != 0 && i2 != 0) {
          prog.memory.varMap[curr.arg1] = 1;
        } else {
          prog.memory.varMap[curr.arg1] = 0;
        }
        eip++;
        break;
      }
      case InstrSet.OR: {
        let i1 = prog.memory.varMap[curr.arg1] || 0;
        let i2 = prog.memory.varMap[curr.arg2] || 0;
        if (i1 == 0 || i2 == 0) {
          prog.memory.varMap[curr.arg1] = 0;
        } else {
          prog.memory.varMap[curr.arg1] = 1;
        }
        eip++;
        break;
      }
      case InstrSet.XOR: {
        let i1 = prog.memory.varMap[curr.arg1] || 0;
        let i2 = prog.memory.varMap[curr.arg2] || 0;
        if ((i1 == 0 && i2 != 0) || (i1 != 0 && i2 == 0)) {
          prog.memory.varMap[curr.arg1] = 1;
        } else {
          prog.memory.varMap[curr.arg1] = 0;
        }
        eip++;
        break;
      }
      case InstrSet.NOT: {
        let i1 = prog.memory.varMap[curr.arg1] || 0;
        if (i1 != 0) {
          prog.memory.varMap[curr.arg1] = 0;
        } else {
          prog.memory.varMap[curr.arg1] = 1;
        }
        eip++;
        break;
      }
      case InstrSet.RET:
        // RET: return to previous call = POP EIP
        loadStack(prog);
        eip = prog.memory.stack.pop() || -1;
        debug("Return to " + eip);
        break;
      case InstrSet.CALL:
        prog.callStack.push(curr.arg1);
        saveStack(prog.memory.varMap);
        prog.memory.stack.push(eip + 1);
        internalJMP(curr);
        break;
      case InstrSet.PUSH:
        prog.memory.stack.push(prog.memory.varMap[curr.arg1] || 0);
        eip++;
        break;
      case InstrSet.POP:
        prog.memory.varMap[curr.arg1] = prog.memory.stack.pop() || 0;
        eip++;
        break;
      case InstrSet.PUSH0:
        prog.memory.stack0.push(prog.memory.varMap[curr.arg1] || 0);
        eip++;
        break;
      case InstrSet.POP0:
        prog.memory.varMap[curr.arg1] = prog.memory.stack0.pop() || 0;
        eip++;
        break;
      case InstrSet.JE:
        if (prog.memory.cmpResult === 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.JNE:
        if (prog.memory.cmpResult !== 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.JAE:
        if (prog.memory.cmpResult >= 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.JA:
        if (prog.memory.cmpResult > 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.JBE:
        if (prog.memory.cmpResult <= 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.JB:
        if (prog.memory.cmpResult < 0) {
          internalJMP(curr);
        } else {
          eip++;
        }
        break;
      case InstrSet.OUT: {
        let addr = prog.memory.varMap[curr.arg1];
        if (!opts.unsafeHeap) {
          if (isSafeHeap(prog.memory, addr)) {
            throw new AccessUnallocatedHeapError(addr);
          }
        }
        prog.memory.heap[addr] = prog.memory.varMap[curr.arg2];
        eip++;
        break;
      }
      case InstrSet.IN:
        prog.memory.varMap[curr.arg1] =
          prog.memory.heap[prog.memory.varMap[curr.arg2]] || 0;
        eip++;
        break;
      case InstrSet.CMP: {
        let v1 = prog.memory.varMap[curr.arg1] || 0;
        let v2;
        if (immValueRegex.test(curr.arg2)) {
          v2 = parseInt(curr.arg2);
        } else {
          v2 = prog.memory.varMap[curr.arg2] || 0;
        }
        if (v1 > v2) {
          prog.memory.cmpResult = 1;
        }
        if (v1 === v2) {
          prog.memory.cmpResult = 0;
        }
        if (v1 < v2) {
          prog.memory.cmpResult = -1;
        }
        eip++;
        break;
      }
      default:
        warn(`Unsupported instr: ${curr.instr}`);
        eip++;
    }
  }
}
