const p = require("path")
var latest = require("../dynamic/var.json").release;
var handler = require("handler")
module.exports = class {
    /**
     * @param {GMLL.profile.options} opt 
     */
    constructor(opt) {
        this.version = opt.version || latest;
        this.paths = {
            folder: p.join("instances", this.version),
            java: "java",
            version: p.join(".minecraft", "versions", this.version),
            assets: p.join(".minecraft", "assets"),
            natives: p.join(".minecraft", "libraries")
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