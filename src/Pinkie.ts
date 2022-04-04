#!/usr/bin/node
import { Command } from "commander";
import fs from "fs";
import { loadProgram, runProgram } from "./Interpret";
import { initNativeFunctions } from "./Natives";
const cmd = new Command();
cmd
  .description("Run compiled slari program (.slari)")
  .option("-h, --heap-size <bytes>", "Heap size in bytes", "1048576")
  .option("-e, --entry <entry>", "Entry point", "func_main")
  .argument("<source>", "The source Slari instr code")
  .action((source, entry) => {
    fs.readFile(source, (e, d) => {
      if (e) {
        console.error("Cannot read input file!");
      } else {
        initNativeFunctions();
        let prog = loadProgram(
          d.toString(),
          parseInt(cmd.opts().heapSize),
          entry.entry
        );
        runProgram(prog);
      }
    });
  });
cmd.parse(process.argv);
