import { createHash } from "crypto";
import fs, { rm } from "fs"
import Fetch from "node-fetch";
import { join } from "path";
import { platform } from "os";
export function getOS() {
    const OS = platform();
    switch (OS) {
        case ("win32"):
        case ("win64"):
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

export function rmdir(target){
    if ("rmSync" in fs)
        return fs.rmSync(target,{recursive:true,force:true})
    return fs.rmdirSync(target,{recursive:true,force:true});
}

export function mklink(target, path) {
    if (fs.existsSync(path)) fs.unlinkSync(path)
    fs.symlinkSync(target, path, "junction");
}

/**
 * 
 * @param {Array<GMLL.version.rules>}  rules
 * @param {GMLL.version.args} properties
 * @returns {boolean | any}
 */
export function lawyer(rules, properties = {}) {
    var end = true, end2 = false;
    for (var i = 0; i < rules.length; i++) {
        if (rules[i].features) Object.keys(rules[i].features).forEach(e => {
            if (rules[i].features[e] && !properties[e])
                end = false;
        })
        var os = !rules[i].os || (
            (!rules[i].os.name || rules[i].os.name == OS) &&
            (!rules[i].os.version || version().match(rules[i].os.version)) &&
            (!rules[i].os.arch || rules.os[i].arch == arch()))
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
export var defJVM = [
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
export function parseArguments(val = {}, args = defJVM) {
    var out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += " " + e.trim().replace(/\s/g, "");
        else if (lawyer(e, val))
            out += " " + (e instanceof Array ? e.join("\t") : e);
    })
    return out

}




export function chkLoadSave(url, file, sha1, size) {
    if (!compare({ key: file, path: file, sha1: sha1, size: size })) {
        return loadSave(url, file);
    }
    return JSON.parse(fs.readFileSync(file));
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
export function loadSave(url, file) {
    return new Promise(async res => {
        var data;
        const rg = await Fetch(url);
        if (rg.status == 200) {
            /**@type {Array} */
            data = await rg.text();
            fs.writeFileSync(file, data);
        }
        else {
            data = fs.readFileSync(file);
        }
        res(JSON.parse(data));
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
