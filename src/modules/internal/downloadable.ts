import type { DownloadableFile } from "types";
import { Dir, File } from "gfsl";

export function check(json: Partial<DownloadableFile>) {
    const f = new File(...json.path, json.name);
    let i = 2;
    if (json.dynamic && f.exists()) return 2;
    if (json.executable || json.unzip) i = 1;
    if (!json.chk || !json.path || !json.name) return 0;
    return f.chkSelf(json.chk) ? i : 0;
}

export function toDownloadable(
    file: File,
    url: string,
    key?: string,
    chk?: { sha1?: string | string[]; size?: number },
    opt?: {
        executable?: boolean | string;
        unzip?: { file: Dir; exclude?: string[] };
    },
) {
    file.mkdir();
    const d: DownloadableFile = {
        key: key || [...file.path, file.name].join("/"),
        name: file.name,
        path: file.path,
        url: url,
        chk: {},
    };
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
export async function expand(file: File, json: Partial<DownloadableFile>, zipDir: Dir) {
    if (json.unzip) {
        await file.unzip(new Dir(...json.unzip.file), { exclude: json.unzip.exclude, zipDir });
    }
    if (json.executable) {
        if (typeof json.executable == "boolean") file.chmod();
        else new File(json.executable).chmod();
    }
}


export async function processFile(json: DownloadableFile, zipDir: Dir) {
    const f = new File(...json.path, json.name);
    if (json.dynamic && f.exists()) {
        return;
    }
    await f.download(json.url, json.chk, { noRetry: json.noRetry });
    await expand(f, json, zipDir);
}