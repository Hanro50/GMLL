import { join } from "path";
import fetch from "node-fetch";
import { existsSync, mkdirSync, unlinkSync, symlinkSync, readFileSync, createWriteStream, statSync, writeFileSync, read, rmSync, readdirSync, copyFileSync } from 'fs';
import { createHash } from "crypto";
import { platform, type } from "os";
import { execSync } from "child_process";
import { cmd as _cmd } from '7zip-min';
export interface downloadable {
    name: string,
    path: string[],
    url: string,
    executable?: boolean,
    key: string,
    chk: {
        sha1?: string,
        size?: number
    },
    unzip?: {
        file: string[],
        exclude?: string[]
    }


}

export function mklink(target: string | dir, path: string | dir) {
    path = path.toString();
    target = target.toString();
    if (existsSync(path)) unlinkSync(path)
    symlinkSync(target, path, "junction");
}
export function mkdir(path: string) {
    if (!existsSync(path)) mkdirSync(path, { recursive: true, });
}

export function stringify(json: object) {
    //@ts-ignore
    return JSON.stringify(json, "\n", "\t");
}
export class dir {
    path: string[];
    constructor(...path: string[]) {
        this.path = [];
        path.forEach(e => {
            this.path.push(...e.split("/"));
        })
    }
    sysPath() {
        return join(... this.path);
    }
    mkdir() {
        mkdir(this.sysPath());
        return this;
    }
    link(path: string | string[]) {
        if (path instanceof Array)
            path = join(...path);
        mklink(this.sysPath(), path)
    }
    /**@override */
    toString() {
        return this.sysPath();
    }
    getDir(..._file: string[]) {
        return new dir(...this.path, ..._file);
    }
    
    getFile(..._file: string[]) {
        return new file(...this.path, ..._file);
    }
    rm() {
        rmSync(this.sysPath(), { recursive: true, force: true })
    }
    exists() {
        return existsSync(this.sysPath());
    }
    ls() {
        let res: Array<dir | file> = [];
        readdirSync(this.sysPath()).forEach(e => {
            const stat = statSync(join(this.sysPath(), e));
            res.push(stat.isFile() ? this.getFile(e) : this.getDir(e));
        })
        return res;
    }
}
export class file extends dir {
    name: string;
    constructor(...path: string[]) {
        super(...path);
        this.name = this.path.pop();
    }

    read(): string {
        return readFileSync(this.sysPath()).toString();
    }
    toJSON<T>() {
        return JSON.parse(readFileSync(this.sysPath()).toString()) as T;
    }

    link(path: string | string[]) {
        if (platform() == "win32") {
            console.warn("[GMLL]: Symlinks in Windows need administrator priviliges!\nThings are about to go wrong!")
        }
        return super.link(path)
    }
    /**@override */
    sysPath() {
        return join(...super.path, this.name);
    }
    copyto(file:file){
        copyFileSync(this.sysPath(),file.sysPath());
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
    async download(url: string, chk?: { sha1?: string, size?: number }) {
        if (chk) {
            var download = false;
            if (chk.sha1 && !this.sha1(chk.sha1))
                download = true
            if (chk.size && !this.size(chk.size))
                download = true
            if (!download)
                return this

        }
        await new Promise((resolve, reject) => {
            const file = createWriteStream(this.sysPath());
            fetch(url).then(res => {
                if (!res.ok) reject(res.status);
                res.body.pipe(file, { end: true });
                file.on("close", resolve);
            })
        });
        return this;
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
    toDownloadable(url: string, key?: string, chk?: { sha1?: string, size?: number }, opt?: { executable?: boolean, unzip?: { file: dir, exclude?: string[] } }) {
        this.mkdir();
        let d: downloadable = { key: key || [...this.path, this.name].join("/"), name: this.name, path: this.path, url: url, chk: {} }
        if (chk) {
            d.chk = chk;
        }
        if (opt) {
            d.executable = opt.executable;
            if (opt.unzip) {
                opt.unzip.file.mkdir();
                d.unzip = { file: opt.unzip.file.path, exclude: opt.unzip.exclude };
            }
        }

        return d;
    }
    static async process(json: downloadable) {
        const f = new this(...json.path, json.name);
        await f.download(json.url, json.chk);
        if (json.unzip) {
            f.unzip(new dir(...json.unzip.file), json.unzip.exclude);
        }
        if (json.executable) {
            f.chmod();
        }
    }
    unzip(path: dir, exclude?: string[]) {
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