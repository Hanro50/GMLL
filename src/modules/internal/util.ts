import { createHash } from "crypto";

import fs from "fs";
import { arch, platform, type, version } from "os";
import { assets, launchArgs, rules, cpuArch } from "../../index.js";
//import { downloadable } from "./get";
import { cmd as _cmd } from '7zip-min';
import { dir } from "../objects/files.js";
import { getAssets } from "../config.js";
/**Gets the current operating system GMLL thinks it is running under */
export function getOS() {
    const operatingSystem = platform();
    switch (operatingSystem) {
        case ("win32"):
            return "windows";
        case ("darwin"):
            return "osx"
        //FreeBSD has a linux compatibility layer. That and Linux is generally the fallback for when GMLL doesn't know what it is doing
        default:
            return "linux";
    }
}

const OS = getOS();
type exCpuArch = cpuArch | "ia32" | "x32";
/**Gets the current CPU architexture for the current running machine. May not be that accurate for Mac OS */
export function getCpuArch() {
    let architexture: exCpuArch = arch() as exCpuArch;
    if (architexture == "ia32" || architexture == "x32") {
        if (OS == "windows" && process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) architexture = "x64";
        else architexture = "x86";
    }
    return architexture as cpuArch
}
const archx = getCpuArch();
/**The processor that handles the rules set out in the version.json for a set version.*/
export function lawyer(rules: rules, properties: any = {}): boolean {
    let end = true, end2 = false;
    //process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
    for (let i = 0; i < rules.length; i++) {
        if (rules[i].features) Object.keys(rules[i].features).forEach(e => {
            if (rules[i].features[e] && !properties[e])
                end = false;
        })
        const os = !rules[i].os || (
            (!rules[i].os.name || rules[i].os.name == OS) &&
            (!rules[i].os.version || version().match(rules[i].os.version)) &&
            (!rules[i].os.arch || (rules[i].os.arch == archx)))
        if (rules[i].action == "disallow" && os) {
            end = false;
        }
        else if (rules[i].action == "allow" && os) {
            end = true && end;
            end2 = true;
        }
    }
    return (end && end2);
}

/**
 * Generates the sha1 dir listings for assets and compressed runtime files 
 */
export function assetTag(path: dir, sha1: string) {
    const file = path.getDir(sha1.substr(0, 2));
    file.mkdir()
    return file;
}
/**Sanitizes folder names for use in file paths */
export function fsSanitiser(text: string) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/[\,\!\@\#\$\%\^\&\*\(\)\[\]\{\}\;\:\"\<\>\\\/\?\~\`\'\|\=\+\s\t]/g, "_")
}
/**Used to throw error messages that are easy to find in a busy terminal */
export function getErr(message: any) {
    const header = "\n\n\x1b[31m\x1b[1m[--------------ERROR--------------ERROR--------------!GMLL!--------------ERROR--------------ERROR--------------]\x1b[0m\n\n";
    return header + message + header + Error().stack;
}
/**Used to throw error messages that are easy to find in a busy terminal */
export function throwErr(message: any) {
    throw getErr(message);
}
/**Used to get maven class paths */
export function classPathResolver(name: string) {
    const namespec = name.split(":");
    return namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
}

/**Takes two different version.json files and combines them */
export function combine(ob1: any, ob2: any) {
    Object.keys(ob2).forEach(e => {
        if (!ob1[e]) {
            ob1[e] = ob2[e]
        }
        else if (typeof ob1[e] == typeof ob2[e]) {
            if (ob1[e] instanceof Array) {
                let f = []

                ob1[e] = [...ob2[e], ...ob1[e]]
            }
            else if (typeof ob1[e] == "string") {
                ob1[e] = ob2[e];
            }
            else if (ob1[e] instanceof Object) {
                ob1[e] = combine(ob1[e], ob2[e]);
            }
        } else {
            ob1[e] = ob2[e];
        }
    })
    return ob1;
}
/**
 * Used to export assets from the modern asset index system the game uses for 1.8+ to a format legacy versions of the game can comprehend 
 */
export function processAssets(assetIndex: assets) {
    if (assetIndex.virtual || assetIndex.map_to_resources) {
        const root = getAssets();
        const file = root.getDir("legacy", assetIndex.virtual ? "virtual" : "resources").mkdir();
        Object.entries(assetIndex.objects).forEach(o => {
            const key = o[0];
            const obj = o[1];
            const to = file.getFile(...key.split("/")).mkdir();
            const finalFile = assetTag(root.getDir("objects"), obj.hash).getFile(obj.hash)
            finalFile.copyto(to);
        })
    }
}
