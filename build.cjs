const { execSync } = require("child_process");
const { writeFileSync,rmSync } = require("fs");
const { join } = require("path");

console.log("Removing old files\n");
const rm = (file) => rmSync(file, { recursive: true, force: true });
rm("dists");

console.log("Building Commonjs!");

console.log(execSync("tsc -p tsconfig.cjs.json").toString());
writeFileSync(join("dist", "cjs", "package.json"), '{"type": "commonjs"}');
const cjsRoot = join("dist", "cjs", "modules", "internal", "root.js");
rm(cjsRoot)
writeFileSync(cjsRoot,
    '"use strict";\n' +
    'Object.defineProperty(exports, "__esModule", { value: true });\n' +
    'var root = ["dist", "cjs"];\n' +
    'exports.default = root;\n' +
    '//# sourceMappingURL=root.js.map\n');

console.log("Building ES6!");

console.log(execSync("tsc -p tsconfig.mjs.json").toString());

writeFileSync(join("dist", "mjs", "package.json"), '{"type": "module"}');
const mjsRoot = join("dist", "mjs", "modules", "internal", "root.js");
rm(mjsRoot)

writeFileSync(mjsRoot,
    'var root = ["dist", "mjs"]\n' +
    'export default root\n' +
    '//# sourceMappingURL=root.js.map');

console.log("DONE!");