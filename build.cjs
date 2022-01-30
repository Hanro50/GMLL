#!/bin/node
const { execSync } = require("child_process");
const { writeFileSync, rmSync, WriteStream } = require("fs");
const { join } = require("path");
const package = require("./package.json");
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
function callback(error, stdout, stderr) {
    if (error) {
        console.error(error)
    }
    if (stdout) {
        console.log(stdout)
    }
    if (stderr) {
        console.log(stderr)
    }
}
function exec(com) {
    try {
        execSync(com, callback);
    } catch (e) {
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
writeFileSync(join("dist", "cjs", "package.json"), JSON.stringify({ "type": "commonjs", "version": package.version }));
//const cjsRoot = join("dist", "cjs", "modules", "internal", "root.js");
//rm(cjsRoot)

console.log("Building ES6!");
exec("tsc -p tsconfig.mjs.json");
writeFileSync(join("dist", "mjs", "package.json"), JSON.stringify({ "type": "module", "version": package.version }));
//const mjsRoot = join("dist", "mjs", "modules", "internal", "root.js");
//rm(mjsRoot)

console.log("Building types");
exec("tsc -p tsconfig.ts.json");

console.log("DONE!");