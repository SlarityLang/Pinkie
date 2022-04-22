import { OutOfMemoryError } from "./Errors";
import { debug } from "./Logger";

export interface Memory {
  heap: Buffer;
  heapFree: Set<HeapUseRecord>;
  stack: number[]; // For CALL and RET (PUSH/POP)
  stack0: number[]; // For recursive calls (PUSH0/POP0)
  ptrSize: Map<number, number>;
  varMap: Record<string, number>; // That's all pointers
  cmpResult: number; // -1, 0, 1. JB: -1, JA: 1, JE: 0, JBE: -1/0, JAE: 1/0
}
export interface HeapUseRecord {
  start: number;
  end: number; // [start, end)
}

export function isSafeHeap(mem: Memory, ptr: number): boolean {
  for (let s of mem.heapFree.keys()) {
    if (s.start <= ptr && s.end > ptr) {
      return true;
    }
  }
  return false;
}
export function initHeap(size: number): Memory {
  let heap = Buffer.alloc(size, 0);
  let heapFree = new Set([{ start: 0, end: size }]);
  let stack: number[] = [];
  let stack0: number[] = [];
  let ptrSize = new Map();
  let varMap = {};
  return {
    heap: heap,
    heapFree: heapFree,
    stack: stack,
    stack0: stack0,
    ptrSize: ptrSize,
    varMap: varMap,
    cmpResult: 0,
  };
}

export function setMem(mem: Memory, ptr: number, data: number): void {
  mem.heap[ptr] = data;
}

export function malloc(mem: Memory, size: number): number {
  if (size <= 0) {
    return -1;
  }
  for (let r of mem.heapFree) {
    if (r.end - r.start == size) {
      let s = r.start;
      debug(
        `${size} bytes allocated from section ${r.start} -> ${r.end} -- exactly allocated`
      );
      mem.heapFree.delete(r);
      mem.ptrSize.set(s, size);
      return s;
    }
    if (r.end - r.start > size) {
      let s = r.start;
      let nst = r.start + size;
      debug(
        `${size} bytes allocated from section ${r.start} -> ${r.end} -- the latter shrinked to ${nst} -> ${r.end}`
      );
      r.start = nst;
      mem.ptrSize.set(s, size);
      return s;
    }
  }
  throw new OutOfMemoryError(size);
}

export function free(mem: Memory, ptr: number): void {
  let sz = mem.ptrSize.get(ptr);
  if (!sz) {
    return;
  }
  let avaBefore: HeapUseRecord | null = null;
  let avaAfter: HeapUseRecord | null = null;
  let eptr = ptr + sz;
  for (let r of mem.heapFree) {
    if (ptr === r.end) {
      avaBefore = r;
    }
    if (eptr === r.start) {
      avaAfter = r;
    }
  }
  if (avaBefore && avaAfter) {
    debug(
      `${sz} bytes returned, joined ${avaBefore.start} -> ${avaBefore.end} and ${avaAfter.start} -> ${avaAfter.end} together to ${avaBefore.start} -> ${avaAfter.end}`
    );
    avaBefore.end = avaAfter.end;
    mem.heapFree.delete(avaAfter);
  } else if (avaBefore) {
    debug(
      `${sz} bytes returned, extended ${avaBefore.start} -> ${avaBefore.end} to ${avaBefore.start} -> ${eptr}`
    );
    avaBefore.end = eptr;
  } else if (avaAfter) {
    debug(
      `${sz} bytes returned, extended ${avaAfter.start} -> ${avaAfter.end} to ${ptr} -> ${avaAfter.end}`
    );
    avaAfter.start = ptr;
  } else {
    debug(`${sz} bytes returned at ${ptr} -> ${eptr} but cannot be joined`);
    mem.heapFree.add({ start: ptr, end: eptr });
  }
}
