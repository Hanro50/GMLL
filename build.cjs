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
console.log("[build]: Building java agent");
console.log(execSync(`mvn clean -f "/home/hanro50/Documents/GitHub/GMLL/gmllagent/pom.xml"`).toString());
console.log(execSync(`mvn install -f "/home/hanro50/Documents/GitHub/GMLL/gmllagent/pom.xml"`).toString());
console.log("[build]: Copying agent file to release file");
copyFileSync(join("gmllagent", "target", "agent.jar"), join("dist", "modules", "internal", "agent.jar"));
////mvn install -f "/home/hanro50/Documents/GitHub/GMLL/gmllagent/pom.xml"
