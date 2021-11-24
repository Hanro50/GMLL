import * as _config from "./modules/config";
import { download as _download } from "./modules/downloader";
/**The core config class */
export function getConfig() {
    return _config;
}
/**
 * Download function. Used by GMLL internally, but exposed here for downloading modpacks and launcher updates.
 * Checks sha1 hashes and can use multiple cores to download files rapidly. 
 * Untested on Intel's new CPUs, use at own risk and report to me if it breaks. -Hanro50
 * @param {Array<GMLL.get.downloadable>} obj The objects that will be downloaded
 * @param {Number} it The retry factor. Will effect how long it takes before the system assumes a crash and restarts. 
 * Lower is better for small files with 1 being the minimum. Higher might cause issues if fetch decides to hang on a download. 
 * Each restart actually increments this value. 
 */
export function download(obj, it = 1) {
    return _download(obj, it);
}