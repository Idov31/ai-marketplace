#!/usr/bin/env node
import { runCli } from "./cli.js";
import { runHostSidecar } from "./hostSidecar.js";

if (process.argv[2] === "__host-sidecar") {
  runHostSidecar();
} else {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
