#!/usr/bin/node
import { Command } from "commander";
import fs from "fs";
import { loadProgram, runProgram } from "./Interpret";
import { debug, error, setDebug } from "./Logger";
import { initNativeFunctions } from "./Natives";
const cmd = new Command();
cmd
  .description("Run compiled slari program (.slari)")
  .option("-h, --heap-size <bytes>", "Heap size in bytes.", "1048576")
  .option("-e, --entry <entry>", "Entry point.", "Fmain")
  .option("-l, --libs <natives...>", "Native script files.")
  .option("-v, --verbose", "Enable extra console outputs.")
  .option("-U, --unsafe-heap", "Do not check access to heap.")
  .argument("<source>", "The source Slari instr code.")
  .action((source, opts) => {
    setDebug(!!opts.verbose);
    debug("Loading program " + source);
    fs.readFile(source, (e, d) => {
      if (e) {
        error("Cannot read input file: " + e);
      } else {
        if (!opts.libs) {
          opts.libs = [];
        }
        debug("Initializing native libraries: " + opts.libs.join(","));
        initNativeFunctions(opts.libs);
        debug("Native libraries loaded");
        debug("Loading program " + source);
        let prog = loadProgram(
          d.toString(),
          parseInt(cmd.opts().heapSize),
          opts.entry
        );
        debug("Start running program");
        try {
          runProgram(prog, opts);
        } catch (e) {
          error("Error during running program: " + e);
        }
      }
    });
  });
cmd.parse(process.argv);
