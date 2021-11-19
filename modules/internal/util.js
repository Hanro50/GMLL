import fs from "fs"

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
export function mkdir(path) {
    if (fs.existsSync(!path)) fs.mkdirSync(path, { recursive: true, });
}

export function mklink(target, path) {
    if (fs.existsSync(path)) fs.unlinkSync(path)
    fs.symlinkSync(target, path, "junction");
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
