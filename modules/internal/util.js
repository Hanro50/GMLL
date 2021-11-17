import { existsSync, mkdirSync } from "fs";
import { platform, version, arch, type } from "os";
//import { GMLL } from "../../@types";
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

/**
 * 
 * @param {string} text 
 */
export function fsSanitiser(text) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/[\,\!\@\#\$\%\^\&\*\(\)\[\]\{\}\;\:\"\<\>\\\/\?\~\`\'\|\=\+\s\t]/g, "_")
}

export function mkdir(test) {
    if (!existsSync(test)) mkdirSync(test, { recursive: true })
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


export function parseArguments(val = {}, args = defJVM) {
    var out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += " " + e.trim().replace(/\s/g,"");
        else if (lawyer(e, val))
            out += " " + (e instanceof Array ? e.join("\t") : e);
    })
    return out

}

