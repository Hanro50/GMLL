import { join } from "path";
import fetch from "node-fetch";
import { existsSync, mkdirSync, unlinkSync, symlinkSync, readFileSync, createWriteStream, statSync, writeFileSync } from 'fs';
import { createHash } from "crypto";
import { type } from "os";
import { execSync } from "child_process";
import { cmd as _cmd } from '7zip-min';
export function mklink(target: string, path: string) {
    if (existsSync(path)) unlinkSync(path)
    symlinkSync(target, path, "junction");
}


export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}
export class dir {
    path: string;
    constructor(path: string[]) {
        this.path = path.join("/");
    }
    sysPath() {
        return join(... this.path.split("/"));
    }
    mkdir() {
        if (!existsSync(this.sysPath())) mkdirSync(this.sysPath(), { recursive: true, });
    }
    link(path: string | string[]) {
        if (path instanceof Array)
            path = join(...path);
        mklink(this.sysPath(), path)
    }

}
export class file extends dir {
    name: string;
    constructor(path: string[]) {
        const name = path.pop();
        super(path);
        this.name = name;
    }
    /**@override */
    sysPath() {
        return join(super.sysPath(), this.name);
    }

    sha1(expected: string | string[]) {
        const sha1 = createHash('sha1').update(readFileSync(this.sysPath())).digest("hex");
        let checksums: string[] = [];
        if (typeof expected == "string") checksums.push(expected); else checksums = expected;
        for (var chk = 0; chk < checksums.length; chk++) {
            if (checksums[chk] == sha1) return true;
        }
        return false;
    }
    size(expected: number) {
        var stats = statSync(this.sysPath());
        return stats.size == expected;
    }
    download(url: string) {
        return new Promise((resolve, reject) => {
            const file = createWriteStream(this.sysPath());
            fetch(url).then(res => {
                if (!res.ok) reject(res.status);
                res.body.pipe(file, { end: true });
                file.on("close", resolve);
            })
        });
    }
    chmod() {
        if (type() != "Windows_NT")
            execSync('chmod +x ' + dir)
    }
    write(data: string | ArrayBuffer | object) {
        if (typeof data == "object") 
            data = stringify(data);
        writeFileSync(this.sysPath(), data);
    }
}

export class zip extends file {
    async unzip(path: dir, exclude?: string[]) {
        var com = ['x', this.sysPath(), '-y', '-o' + path.sysPath()]
        if (exclude) {
            exclude.forEach(e => {
                var f = String(e);
                if (f.endsWith("/")) f += "*"
                com.push("-xr!" + f);
            })
        }
    }
} 