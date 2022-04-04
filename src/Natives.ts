import { INTNotFoundError } from "./Errors";
import { Program } from "./Interpret";

const NATIVE_FUNCTIONS: Map<string, NativeFunction> = new Map();

export function callNativeFunction(intName: string, prog: Program): void {
  let fun = NATIVE_FUNCTIONS.get(intName);
  if (fun) {
    fun(prog);
  } else {
    throw new INTNotFoundError(intName);
  }
}

type NativeFunction = (prog: Program) => void;
export function addNativeFunction(name: string, nf: NativeFunction): void {
  NATIVE_FUNCTIONS.set("native_" + name, nf);
}
export function initNativeFunctions(): void {
  addNativeFunction("puts", (p) => {
    console.log(p.memory.varMap["$puts_arg1"]);
  });
}
