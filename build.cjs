const { execSync } = require("child_process")
const { rmSync, copyFileSync } = require("fs");
const { join } = require("path");

console.log("[build]: Removing old files!");
rmSync("dist", { force: true, recursive: true });
console.log("[build]: Resolving dependencies!");
console.log(execSync("npm i").toString());
console.log("[build]: Building GMLL!");
console.log(execSync("tsc").toString());
console.log("[build]: Copying types file");
copyFileSync(join("src", "types.d.ts"), join("types", "types.d.ts"));

////mvn install -f "/home/hanro50/Documents/GitHub/GMLL/gmllagent/pom.xml"
