import { readFileSync } from "fs";
import { join } from "path";
import { getInstances, getMeta } from "../config.js";
import { fsSanitiser, mkdir } from "../internal/util.js";
import { getLatest } from "./versions.js";

export interface options {
    /**The name of the instance */
    name?: string,
    /**The version of the game to load */
    version?: string,
    /**The installation path */
    path?: string,
    /**Ram in GB */
    ram?: Number,
    /**Custom data your launcher can use */
    meta?: any
}
const instanceTypes = new Map<string, typeof instance>();

export function registerInstanceType(id: string, type: typeof instance) {
    instanceTypes.set(id, type);
}

export class instance implements options {
    name: string;
    version: string;
    path: string;
    ram: Number;
    meta: any;
    protected type: string;
    static get(name: string) {
        const json = JSON.parse(readFileSync(join(getMeta().profiles, fsSanitiser(name + ".json"))).toString());
        return new (instanceTypes.get(json.type))(json, json.type);
    }

    constructor(opt: options, type: string) {
        this.type = type;
        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join(getInstances(), fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.meta = opt && opt.meta ? opt.meta : undefined;

        mkdir(this.path);
    }
}
