/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require("child_process");
const { rmSync,copyFileSync } = require("fs");
const { join } = require("path");

console.log("[build]: Removing old files!");
rmSync("dist", { force: true, recursive: true });
rmSync("types", { force: true, recursive: true });
console.log("[build]: Resolving dependencies!");
console.log(execSync("npm i").toString());
console.log("[build]: Building GMLL!");
console.log(execSync("tsc").toString());
console.log("[build]: Copying files ");
copyFileSync(join("src", "modules", "internal", "worker.mjs"), join("dist", "modules", "internal", "worker.mjs"));
//console.log("[build]: Copying types file");
//copyFileSync(join("src", "types.d.ts"), join("types", "types.d.ts"));

////mvn install -f "/home/hanro50/Documents/GitHub/GMLL/gmllagent/pom.xml"
