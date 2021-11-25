import { spawn } from "child_process";
import { join } from "path";
import * as _config from "./modules/config";
import { download as _download, downloadable, manifests, runtime } from "./modules/downloader";
import { mkdir } from "./modules/internal/util";
import { getJavaPath } from "./modules/versions";
/**The core config class */
export function getConfig() {
    return _config;
}
/**
 * Download function. Used by GMLL internally, but exposed here for downloading modpacks and launcher updates.
 * Checks sha1 hashes and can use multiple cores to download files rapidly. 
 * Untested on Intel's new CPUs, use at own risk and report to me if it breaks. -Hanro50
 * 
 * @param obj The objects that will be downloaded
 * 
 * @param it The retry factor. Will effect how long it takes before the system assumes a crash and restarts. 
 * Lower is better for small files with 1 being the minimum. Higher might cause issues if fetch decides to hang on a download. 
 * Each restart actually increments this value. 
 */
export function download(obj:Partial<downloadable>[], it:number = 1) {
    return _download(obj, it);
}

/**Does the basic pre flight checks. */
export async function init() {
    await manifests();
}