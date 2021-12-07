const { execSync } = require("child_process");
const { writeFileSync, rmSync, WriteStream } = require("fs");
const { join } = require("path");

console.log("Removing old files");
const rm = (file) => rmSync(file, { recursive: true, force: true });
rm("dist");
//rm("@types");

/**
 * 
 * @param {string} error 
 * @param {string} stdout 
 * @param {string} stderr 
 */
function callback(error, stdout, stderr){
    if (error){
        console.error(error)
    }
    if (stdout){
        console.log(stdout)
    }
    if (stderr){
        console.log(stderr)
    }
}
function exec(com){
    try{
        execSync(com,callback);
    }catch(e){
        console.log(e);
        /**
         * @type {Buffer}
         */
        var buf = e.stdout;
        console.log(buf.toString("utf8"))
    }
}

console.log("Building Commonjs!");

exec("tsc -p tsconfig.cjs.json");
writeFileSync(join("dist", "cjs", "package.json"), '{"type": "commonjs"}');
const cjsRoot = join("dist", "cjs", "modules", "internal", "root.js");
rm(cjsRoot)
/*
writeFileSync(cjsRoot,
    '"use strict";\n' +
    'Object.defineProperty(exports, "__esModule", { value: true });\n' +
    'var root = ["dist", "cjs"];\n' +
    'exports.default = root;\n' +
    '//# sourceMappingURL=root.js.map\n');
*/
console.log("Building ES6!");

exec("tsc -p tsconfig.mjs.json");

writeFileSync(join("dist", "mjs", "package.json"), '{"type": "module"}');
const mjsRoot = join("dist", "mjs", "modules", "internal", "root.js");
rm(mjsRoot)
/*
writeFileSync(mjsRoot,
    'var root = ["dist", "mjs"]\n' +
    'export default root\n' +
    '//# sourceMappingURL=root.js.map');
*/

console.log("Building types");
exec("tsc -p tsconfig.ts.json");


console.log("DONE!");