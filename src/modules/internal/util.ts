import { createHash } from "crypto";
import Fetch from "node-fetch";
import  fs from "fs";
import { join } from "path";
import { arch, platform, type, version } from "os";
import { launchArgs, rules } from "../../index.js";
import { execSync } from "child_process";
import { downloadable } from "./get";
import { cmd as _cmd } from '7zip-min';

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


/**@deprecated */
export function chkLoadSave<T>(url: string, file: string, sha1: string, size?: number): Promise<T> {
    chkFileDownload

    if (!compare({ key: file, path: file, sha1: sha1, size: size }, true)) {
        return loadSave(url, file, true);
    }
    return JSON.parse(fs.readFileSync(file).toString());
}

export function compare(o: Partial<downloadable>, json = false) {
    const loc = o.name ? join(o.path, o.name) : o.path;
    if (!fs.existsSync(loc)) return false;

    var stats: { size: number };
    var jfile: string;
    if (json) {
        jfile = JSON.stringify(JSON.parse(fs.readFileSync(loc).toString()));
        stats = { size: jfile.length }

    }
    else stats = fs.statSync(loc);
    if (o.size && stats.size != o.size) {
        if (stats.size > 0) console.log("[GMLL]: " + stats.size + " vs " + o.size + " : " + o.key);
        return false;
    }
    if (o.sha1) {
        const sha1 = createHash('sha1').update(jfile ? jfile : fs.readFileSync(loc)).digest("hex");
        if (o.sha1 != sha1) {
            console.log("[GMLL]: " + sha1 + " vs " + o.sha1 + " : " + o.key); return false;
        }
    }
    return true;
}
export function loadSave<T>(url: string, file: string, strict = false): Promise<T> {
    return new Promise(async res => {
        var data: T;
        const rg = await Fetch(url);
        if (rg.status == 200) {
            if (strict) {
                const text = await rg.text();
                write(file, text);
                data = JSON.parse(text);
            }
            else {
                data = await rg.json() as T;
                writeJSON(file, data);
            }
        }
        else {
            data = JSON.parse(fs.readFileSync(file).toString()) as T;
        }
        res(data);
    })
}
/**
 * Generates the sha1 dir listings for assets and compressed runtime files 
 */
export function assetTag(dir: string, sha1: string) {
    const file = join(dir, sha1.substr(0, 2));
    mkdir(file);
    return join(file);
}

export function fsSanitiser(text: string) {
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

export function write(file: string, json: string) {
    if (fs.existsSync(file)) {
        //Here for people with SSDs to save on write cycles
        if (fs.readFileSync(file).toString() == json) return;
        fs.rmSync(file);
    }
    fs.writeFileSync(file, json);
}

export function writeRAW(file: string, data: Object | Object[]) {
    write(file, JSON.stringify(data));

}

export function writeJSON(file: string, data: Object | Object[]) {
    write(file, stringify(data));

}
/**Used to throw error messages that are easy to find in a busy terminal */
export function throwErr(message: any) {
    const header = "\n\n\x1b[31m\x1b[1m[--------------ERROR--------------ERROR--------------!GMLL!--------------ERROR--------------ERROR--------------]\x1b[0m\n\n";
    throw header + message + header;
}

export function classPathResolver(name: string) {
    const namespec = name.split(":");
    console.log(namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar")
    return namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
}


export async function mutator(o: downloadable, main: boolean = false): Promise<downloadable> {
    try {
        var path = o.path;
        var name = o.name;
        if (main)
            mkdir(path)
        else if (!fs.existsSync(path)) {
            console.error("[GMLL] Does not exist", path);
            return o;
        }
        if (o.unzip) {
            if (o.unzip.path) {
                var com = ['x', join(path, name), '-y', '-o' + o.unzip.path]
                if (o.unzip.exclude) {
                    o.unzip.exclude.forEach(e => {
                        var f = String(e);
                        if (f.endsWith("/")) f += "*"
                        com.push("-xr!" + f);
                    })
                }
                await new Promise<void>(e => _cmd(com, (err: any) => { if (err) console.log(err); e() }));
                if (o.unzip.name)
                    name = o.unzip.name;
                path = o.unzip.path
            }
        }
        if (o.executable) {
            chmod(join(path, name));
        }

        o.path = path;
        o.name = name;

        return o;
    } catch (e) { }
}


export async function chkFileDownload(o: downloadable): Promise<Buffer> {
    if (!compare(o)) await new Promise(async e => {
        mkdir(o.path);
        const file = fs.createWriteStream(join(o.path, o.name))
        const res = await Fetch(o.url);
        res.body.pipe(file, { end: true });
        file.on("close", e);
    });
    o = await mutator(o,true);
    return fs.readFileSync(join(o.path, o.name));
}


export function chkFileDownload2(url: string, name: string, path: string, sha1: string, size?: number): Promise<Buffer> {
    return chkFileDownload({ key: name, url: url, name: name, path: path, sha1: sha1, size: size })
}