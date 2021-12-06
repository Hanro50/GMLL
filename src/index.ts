/**
 * ---------------------------------------------------------------------------------------------
 * TYPES 
 * ---------------------------------------------------------------------------------------------
 */

import { options } from "./modules/handler.js";

export type version_type = "old_alpha" | "old_beta" | "release" | "snapshot" | "fabric" | "forge" | "custom" | "unknown";
export type user_type = "msa" | "mojang" | "legacy";
export type jarTypes = "client" | "client_mappings" | "server" | "server_mappings" | "windows_server";
export type runtimes = "java-runtime-alpha" | "java-runtime-beta" | "jre-legacy" | "minecraft-java-exe";

export interface rule {
    "action": "allow" | "disallow",
    os?: {
        name?: "osx" | "windows" | "linux",
        arch?: "x86" | "x32" | "x64" | "arm" | "arm64" | "ia32" | "mips" | "mipsel" | "ppc" | "ppc64" | "s390" | 's390x',
        version?: string
    },
    features?: options
}
export type rules = Array<rule>;
export type launchArgs = Array<string | { rules: rules, value?: string | string[] }>
export interface manifest {
    //The ID of the version, must be unique
    id: string,
    //version type,
    type: version_type,
    //the URL to get the version.json. Assumes version.json already exists if missing
    url?: string,
    /**Vanilla version file includes this*/
    time?: string,
    /**Vanilla version file includes this*/
    releaseTime?: string,
    /**A sha1 of the vinal version manifest file, will not redownload version.json if it matches this*/
    sha1?: string,
    /**Vanilla version file includes this*/
    complianceLevel?: 1 | 0,
    /**For version manifest files that are based on another version. */
    base?: string,
    /**From the fabric manifest files, always false for some reason */
    stable?: boolean,
    /**Overrides fields in the version json file this references. 
     *Used when pulling files from sources that have incompatibilities with the vannilla launcher methods.
     */
    overrides?: Partial<version>
}

export interface artifact {
    sha1: string,
    url: string,
    size?: number,
    id?: string,
    totalSize?: string,
    path?: string,
}
export interface assetIndex extends artifact {
    id: string
}

export interface version {
    arguments?: {
        "game": launchArgs
        "jvm": launchArgs
    },
    assetIndex: assetIndex,
    assets: string,
    downloads: {
        client: artifact,
        client_mappings?: artifact,
        server?: artifact,
        server_mappings?: artifact,
        windows_server?: artifact
    },
    logging?: {
        client: {
            argument: string,
            file: artifact,
            type: "log4j2-xml"
        }
    },
    javaVersion?: {
        component: runtimes,
        majorVersion: Number
    },
    complianceLevel: string
    id: string,
    libraries: [library],
    mainClass: string,
    minecraftArguments?: string,
    minimumLauncherVersion: Number,
    releaseTime: string,
    time: string,
    type: version_type,
    inheritsFrom?: string,
}

export interface assets {
    "objects": { [key: string]: { "hash": string, "size": number } },
    map_to_resources?: boolean,
    virtual?: boolean
}

export interface library {
    name: string,
    downloads?: {
        artifact: artifact,
        classifiers?: {
            [key: string]: artifact
        }
    },
    url?: string,
    rules?: rules,
    extract?: {
        exclude: [
            "META-INF/"
        ]
    },
    natives?: {
        linux?: string,
        windows?: string,
        osx?: string
    },
}

/**The return object that all the async login procedures return */
export interface msmcResult {
    type: "Success" | "DemoUser" | "Authentication" | "Cancelled" | "Unknown"
    /**Only returned when the user has logged in via microsoft */
    "access_token"?: string, //Your classic Mojang auth token. 
    /**Only returned on a successful login and if the player owns the game*/
    profile?: any, //Player profile. Similar to the one you'd normally get with the Mojang login
    /**Used with the error types*/
    reason?: string,
    /**Used when there was a fetch rejection.*/
    data?: Response,
}


/**
 * ---------------------------------------------------------------------------------------------
 * INDEX 
 * ---------------------------------------------------------------------------------------------
 */

import { initialize } from "./modules/config.js";
import { version } from "os";
import { throwErr } from "./modules/internal/util.js";
import { token as _token } from "./modules/objects/instance.js";
/**
 * Does a range of required preflight checks. Will cause errors if ignored!
 */
export async function init() { await initialize() }
/**The core config class. Used to change the locations of files and to get the location of files as well! */
export * as config from './modules/config.js';
/**The main download manager in GMLL. */
export * as downloader from './modules/downloader.js';
/**Stuff related to the version and manifest files. Used to install forge, get a complete list of manifest files and so much more! */
export * as handler from "./modules/handler.js";

/**The instance object. An instance is basically a minecraft profile you can launch */
export { default as instance } from "./modules/objects/instance.js";
export { token as token } from "./modules/objects/instance.js";
export { options as options } from "./modules/objects/instance.js";

export function msmcWrapper(msmcResult: msmcResult): _token {
    if (msmcResult.type != "DemoUser" && msmcResult.type != "Success" || !msmcResult.profile) {
        throwErr("User was not logged in with msmc!");
    }
    return {
        profile: {
            demo: msmcResult.type == "DemoUser",
            type: "msa",
            id: msmcResult.profile.id,
            name: msmcResult.profile.name,
            xuid: msmcResult.profile.xuid
        },
        access_token: msmcResult.access_token
    };
}