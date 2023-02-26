import { arch, networkInterfaces, platform, userInfo, version } from "os";
import { cmd as _cmd } from '7zip-min';
import { dir, stringify } from "../objects/files.js";
import { getAssets, getMeta, isInitialized } from "../config.js";
import { createHash, randomUUID } from "crypto";
import { cpuArchRuleVal, versionJsonRules, assetIndex } from "../../types";

/**Gets the current operating system GMLL thinks it is running under */
export function getOS() {
    const operatingSystem = platform();
    switch (operatingSystem) {
        case ("win32"):
            return "windows";
        case ("darwin"):
            return "osx"
        default:
            return "linux";
    }
}

const OS = getOS();
type exCpuArch = cpuArchRuleVal | "ia32" | "x32";
/**Gets the current CPU architexture for the current running machine. May not be that accurate for Mac OS */
export function getCpuArch() {
    let architecture: exCpuArch = arch() as exCpuArch;//ProgramFiles(Arm)
    if (OS == "windows") {
        if (process.env.hasOwnProperty("ProgramFiles(Arm)")) architecture = "arm64"; //For arm64
        else if (process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) architecture = "x64"; //For AMD64 with 32-bit node
        else if (architecture != "x64") architecture = "x86"; //To filter out ia32 or x32 and translate that to x86
    }
    return architecture as cpuArchRuleVal
}
const archX = getCpuArch();
/**The processor that handles the rules set out in the version.json for a set version.*/
export function lawyer(rules: versionJsonRules, properties: any = {}): boolean {
    let end = true, end2 = false;
    for (let i = 0; i < rules.length; i++) {
        if (rules[i].features) Object.keys(rules[i].features).forEach(e => {
            if (rules[i].features[e] && !properties[e])
                end = false;
        })
        const os = !rules[i].os || (
            (!rules[i].os.name || rules[i].os.name == OS) &&
            (!rules[i].os.version || version().match(rules[i].os.version)) &&
            (!rules[i].os.arch || (rules[i].os.arch == archX)))
        if (rules[i].action == "disallow" && os) {
            end = false;
        }
        else if (rules[i].action == "allow" && os) {
           // end = true && end;
            end2 = true;
        }
    }
    return (end && end2);
}
/**
 * Generates the sha1 dir listings for assets and compressed runtime files 
 */
export function assetTag(path: dir, sha1: string) {
    const file = path.getDir(sha1.substring(0, 2));
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
    const namespec = name.split(":", 4);
    return `${namespec[0].replace(/\./g, "/")}/${namespec[1]}/${namespec[2]}/${namespec[1]}-${namespec[2]}${(namespec[3] ? '-' + namespec[3].replace(/\:/g, "-") : "")}.jar`;
}

/**Takes two different version.json files and combines them */
export function combine<T, T2>(ob1: T, ob2: T2): T & T2 {
    Object.keys(ob2).forEach(e => {
        if (!ob1[e]) {
            ob1[e] = ob2[e]
        }
        else if (typeof ob1[e] == typeof ob2[e]) {
            if (ob1[e] instanceof Array) {
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
    return ob1 as T & T2;
}
/**
 * Used to export assets from the modern asset index system the game uses for 1.8+ to a format legacy versions of the game can comprehend.
 * This is how we get sound working in deprecated versions of Minecraft 
 */
export function processAssets(assetManifest: assetIndex) {
    if (assetManifest.virtual || assetManifest.map_to_resources) {
        const root = getAssets();
        const file = root.getDir("legacy", assetManifest.virtual ? "virtual" : "resources").mkdir();
        Object.entries(assetManifest.objects).forEach(o => {
            const key = o[0];
            const obj = o[1];
            const to = file.getFile(...key.split("/")).mkdir();
            const finalFile = assetTag(root.getDir("objects"), obj.hash).getFile(obj.hash)
            finalFile.copyTo(to);
        })
    }
}

/**
 * Used to get a unique ID to recognise this machine. Used by mojang in some snapshot builds.
 * We're just making sure it is sufficiently random
 */
export function getClientID(forceNew: boolean = false) {
    isInitialized();
    const path = getMeta().index.getFile("ClientID.txt");
    var data: string;
    if (!path.exists() || forceNew) {
        data = stringify({
            Date: Date.now(),
            UUID: randomUUID(),
            network: createHash('sha256').update(stringify(networkInterfaces())).digest("base64"),
            user: createHash('sha256').update(stringify(userInfo())).digest("base64"),
            provider: "GMLL",
        });
        data = createHash('sha512').update(data).digest("base64");
        path.write(data);
    } else {
        data = path.read();
    }
    return data;
}
