import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];
if (target !== "out" && target !== "out-test") throw new Error("Clean target must be out or out-test.");
await rm(resolve(target), { recursive: true, force: true });
