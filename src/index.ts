/**
 * ---------------------------------------------------------------------------------------------
 * imports 
 * ---------------------------------------------------------------------------------------------
 */
import { initialize } from "./modules/config.js";
import { version } from "os";
import { options } from "./modules/objects/instance.js";
import { downloadable } from "./modules/objects/files.js";


/**
 * ---------------------------------------------------------------------------------------------
 * TYPES 
 * ---------------------------------------------------------------------------------------------
 */
export type version_type = "old_alpha" | "old_beta" | "release" | "snapshot" | "fabric" | "forge" | "custom" | "unknown";
export type user_type = "msa" | "mojang" | "legacy";
export type jarTypes = "client" | "client_mappings" | "server" | "server_mappings" | "windows_server";
export type runtimes = "java-runtime-alpha" | "java-runtime-beta" | "jre-legacy" | "minecraft-java-exe";
export type cpuArch = "x86" | "x64" | "arm" | "arm64" | "mips" | "mipsel" | "ppc" | "ppc64" | "s390" | 's390x'
export interface rule {
    "action": "allow" | "disallow",
    os?: {
        name?: "osx" | "windows" | "linux",
        arch?: cpuArch,
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
     *Used when pulling files from sources that have incompatibilities with the vanilla launcher methods.
     */
    //Not implemented yet
    overrides?: Partial<version>,
    //Here to provide usage instructions
    "_comment"?: string
}

export interface urlFile {
    sha1: string,
    url: string,
    size?: number,
}

export interface artifact extends urlFile {
    id?: string,
    totalSize?: string,
    path?: string,
}
export interface assetIndex extends artifact {
    id: string
}
/**
 * Used in the Modpack API 
 */
export interface apiDoc {
    name: string,
    version: number,
    sha: string,
    "_comment": string
}
/**
 * The general format of a version.json file
 */
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
    synced?: boolean,
    inheritsFrom?: string,
    //Not implemented yet
    instance?: {
        /**
         * Determines how long to wait before restarting the download. 
         * Lower = better for many smaller files. Higher is better for fewer larger files.
         * Formula restart_Multiplier x 15 seconds = amount of time before assuming crash.
         * Timer is reset every time GMLL downloads and saves a file successfully 
         */
        restart_Multiplier?: number,
        /**
         * The files that need to be download for a set instance
         */
        files: downloadable[];
        /**
         * Assets to inject into any instance made with this version file.
         */
        assets: Partial<assets>;
        /**
         * Custom meta data. Here to be used by launcher developers, GMLL won't interact with this!
         * Usefull for providing more info about a modpack
         */
        meta: any;
        /**
         * Used to locate the forge installer
         */
        forge?: { installer: string[] };
    }
}

export interface assets {
    "objects": { [key: string]: { "hash": string, "size": number, "ignore"?: boolean } },
    map_to_resources?: boolean,
    virtual?: boolean
}

export interface library {
    checksums: string[];
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
    }
    serverreq?: boolean,
    clientreq?: boolean
}

export interface launcherFILE {
    target: string;
    type: "directory" | "file" | "link"
    downloads?: {
        lzma?: urlFile,
        raw: urlFile
    },
    executable?: boolean,
}
/**
 * The generic resource file format mojang uses. 
 * The two downloadables in this formate are the java edition runtimes and Minecraft Dungeons
 */
export interface mojangResourceFile {
    files: {
        [key: string]: launcherFILE
    }
}
/**@deprecated Name changed to `mojangResourceFile` */
export interface runtimeFILE {
    files: {
        [key: string]: launcherFILE
    }
}

export type runtimeManifest = {
    "availability": {
        "group": number,
        "progress": number
    },
    "manifest": {
        "sha1": string,
        "size": number,
        "url": string
    },
    "version": {
        "name": string,
        "released": string
    }
}
export type runtimeManifests = {
    [key in "gamecore" | "linux" | "linux-i386" | "mac-os" | "windows-x64" | "windows-x86"]: {
        [key in "java-runtime-beta" | "java-runtime-alpha" | "jre-legacy" | "minecraft-java-exe"]: Array<runtimeManifest>
    }
}
/**
 * ---------------------------------------------------------------------------------------------
 * INDEX 
 * ---------------------------------------------------------------------------------------------
 */

/**Does a range of required preflight checks. Will cause errors if ignored!*/
export async function init() { await initialize() }
/**The core config class. Used to change the locations of files and to get the location of files as well! */
export * as config from './modules/config.js';
/**The main download manager in GMLL. */
export * as downloader from './modules/downloader.js';
/**Stuff related to the version and manifest files. Used to install forge, get a complete list of manifest files and so much more! */
export * as handler from "./modules/handler.js";
/**Integration with other libs */
export * as wrapper from "./modules/wrapper.js";
/**Provides access to GMLL's file handler */
export * as files from "./modules/objects/files.js"
/**The instance object. An instance is basically a minecraft profile you can launch */
export { default as instance } from "./modules/objects/instance.js";
export { token as token } from "./modules/objects/instance.js";
export { options as options } from "./modules/objects/instance.js";