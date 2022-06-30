const { execSync } = require("child_process")
const { rmSync } = require("fs")

console.log("[build]: Removing old files!");
rmSync("dist", { force: true, recursive: true });
console.log("[build]: Resolving dependencies!");
console.log(execSync("npm i").toString());
console.log("[build]: Building GMLL!");
console.log(execSync("tsc").toString());
console.log("[build]: Done!");