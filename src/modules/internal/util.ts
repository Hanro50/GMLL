import { createHash } from "crypto";
import Fetch from "node-fetch";
import * as fs from "fs";
import { join } from "path";
import { arch, platform, type, version } from "os";
import { launchArgs, rules } from "../types";
import { execSync } from "child_process";
export function getOS() {
    const OS = platform();
    switch (OS) {
        case ("win32"):
            return "windows";
        case ("darwin"):
            return "osx"
        default:
            return "linux";
    }
}

const OS = getOS();
export function mkdir(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true, });
}

export function rmdir(target: string) {
    return fs.rmSync(target, { recursive: true, force: true })
}

export function mklink(target: string, path: string) {
    if (fs.existsSync(path)) fs.unlinkSync(path)
    fs.symlinkSync(target, path, "junction");
}

/**
 * 
 * @param {Array<GMLL.version.rules>}  rules
 * @param {GMLL.version.args} properties
 * @returns {boolean | any}
 */
export function lawyer(rules: rules, properties: any = {}): boolean {
    var end = true, end2 = false;
    for (var i = 0; i < rules.length; i++) {
        if (rules[i].features) Object.keys(rules[i].features).forEach(e => {
            if (rules[i].features[e] && !properties[e])
                end = false;
        })
        var os = !rules[i].os || (
            (!rules[i].os.name || rules[i].os.name == OS) &&
            (!rules[i].os.version || version().match(rules[i].os.version)) &&
            (!rules[i].os.arch || (rules[i].os.arch == arch() || (arch() == "x32" && rules[i].os.arch == "x86"))))
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
export var defJVM: launchArgs = [
    { "rules": [{ "action": "allow", "os": { "name": "osx" } }], "value": ["-XstartOnFirstThread"] },
    { "rules": [{ "action": "allow", "os": { "name": "windows" } }], "value": "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump" },
    { "rules": [{ "action": "allow", "os": { "name": "windows", "version": "^10\\." } }], "value": ["-Dos.name=Windows 10", "-Dos.version=10.0"] },
    { "rules": [{ "action": "allow", "os": { "arch": "x86" } }], "value": "-Xss1M" },
    "-Djava.library.path=${natives_directory}",
    "-Dminecraft.launcher.brand=${launcher_name}",
    "-Dminecraft.launcher.version=${launcher_version}",
    "-cp",
    "${classpath}"
]

export var oldJVM = ["-Dhttp.proxyHost=betacraft.pl", "-Djava.util.Arrays.useLegacyMergeSort=true"]
export function parseArguments(val = {}, args: launchArgs = defJVM) {
    var out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += " " + e.trim().replace(/\s/g, "");
        else if (lawyer(e.rules, val))
            out += " " + (e.value instanceof Array ? e.value.join("\t") : e.value);
    })
    return out
}




export function chkLoadSave<T>(url: string, file: string, sha1: string, size?: Number): Promise<T> {
    if (!compare({ key: file, path: file, sha1: sha1, size: size })) {
        return loadSave(url, file);
    }
    return JSON.parse(fs.readFileSync(file).toString());
}
/**
 * 
 * @param {GMLL.get.downloadable} o 
 * @returns 
 */
export function compare(o) {
    const loc = o.name ? join(o.path, o.name) : o.path;
    if (!fs.existsSync(loc)) return false;
    var stats = fs.statSync(loc);

    if (o.size && stats.size != o.size) {
        if (stats.size > 0) console.log("[GMLL]: " + stats.size + " vs " + o.size + " : " + o.key);
        return false;
    }
    if (o.sha1) {
        const sha1 = createHash('sha1').update(fs.readFileSync(loc)).digest("hex");
        if (o.sha1 != sha1) {
            console.log("[GMLL]: " + sha1 + " vs " + o.sha1 + " : " + o.key); return false;
        }
    }
    return true;
}
export function loadSave<T>(url: string, file: string): Promise<T> {
    return new Promise(async res => {
        var data;
        const rg = await Fetch(url);
        if (rg.status == 200) {
            /**@type {Array} */
            data = await rg.json();
            writeJSON(file, data);
        }
        else {
            data = fs.readFileSync(JSON.parse(file));
        }
        res(data);
    })
}
/**
 * 
 * @param {string} sha1 
 * @returns 
 */
export function assetTag(lzma, sha1) {
    const file = join(lzma, sha1.substr(0, 2));
    mkdir(file);
    return join(file);
}

/**
 * 
 * @param {string} text 
 */
export function fsSanitiser(text) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/[\,\!\@\#\$\%\^\&\*\(\)\[\]\{\}\;\:\"\<\>\\\/\?\~\`\'\|\=\+\s\t]/g, "_")
}

export function chmod(dir: string) {
    if (type() != "Windows_NT")
        execSync('chmod +x ' + dir)
}

export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}

export function writeJSON(file: string, data: Object | Object[]) {
    const json = stringify(data);
    if (fs.existsSync(file)) {
        //Here for people with SSDs to save on write cycles
        if (fs.readFileSync(file).toString() == json) return;
        fs.rmSync(file);
    }
    fs.writeFileSync(file, json);
}

export function throwErr(message) {
    const header = "\n\x1b[31m\x1b[1m[--------------ERROR--------------ERROR--------------ERROR--------------ERROR--------------ERROR--------------]\x1b[0m\n";
    throw header + message + header;
}