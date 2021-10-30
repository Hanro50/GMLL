import { join } from "path";
import { release as latest } from "../dynamic/var.json";
import handler from "handler.js";
export default class {
    /**
     * @param {GMLL.profile.options} opt 
     */
    constructor(opt) {
        this.version = opt.version || latest;
        this.paths = {
            folder: join("instances", this.version),
            java: "java",
            version: join(".minecraft", "versions", this.version),
            assets: join(".minecraft", "assets"),
            natives: join(".minecraft", "libraries")
        };
        if (opt.paths) {
            Object.keys(opt.paths).forEach(e => {
                this.paths[e] = opt.paths[e];
            });
        }
    }
    download() { }
    launch(user) { }
}