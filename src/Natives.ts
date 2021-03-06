import path from "path";
import { INTNotFoundError } from "./Errors";
import { Program } from "./Interpret";
import { debug, info, warn } from "./Logger";
import { free, malloc } from "./Memory";
const NATIVE_FUNCTIONS: Map<string, NativeFunction> = new Map();

export function callNativeFunction(intName: string, prog: Program): void {
  debug("Native function call detected: " + intName);
  let fun = NATIVE_FUNCTIONS.get(intName);
  if (fun) {
    fun(prog);
  } else {
    throw new INTNotFoundError(intName);
  }
}

type NativeFunction = (prog: Program) => void;
export function addNativeFunction(name: string, nf: NativeFunction): void {
  NATIVE_FUNCTIONS.set("N" + name, nf);
}
export function initNativeFunctions(files: string[]): void {
  for (let f of files) {
    if (!f) {
      continue;
    }
    debug("Loading native library " + f);
    try {
      let m = require(path.resolve(f));
      for (let [k, v] of Object.entries(m)) {
        if (typeof v === "function") {
          addNativeFunction(k, v as NativeFunction);
          debug("Loaded native library " + f);
        } else {
          warn(`Export ${k} not a function in ${f}, which is not recommended`);
        }
      }
    } catch (e) {
      warn("Could not load native library " + f + ": " + e);
    }
  }
  debug("Loading builtin libraries");
  addNativeFunction("puts", (p) => {
    info(String(p.memory.varMap["#puts_1"]));
  });
  addNativeFunction("exit", (p) => {
    process.exit(parseInt(String(p.memory.varMap["#exit_1"])) || 0);
  });
  addNativeFunction("malloc", (p) => {
    p.memory.varMap["*malloc"] = malloc(
      p.memory,
      p.memory.varMap["#malloc_1"] || 0
    );
  });
  addNativeFunction("free", (p) => {
    free(p.memory, p.memory.varMap["#free_1"] || 0);
  });
}
