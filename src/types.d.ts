/**
 * ---------------------------------------------------------------------------------------------
 * TYPES 
 * ---------------------------------------------------------------------------------------------
 */
/**
 * The release type of a set version. Can be used to add filters to a version select field within a launcher so 
 * that a user isn't overwhelmed by the 7 billion different versions of fabric.
 */
export type mcVersionType = "old_alpha" | "old_beta" | "release" | "snapshot" | "fabric" | "forge" | "custom" | "unknown";
/**
 * The type of user profiles. Can be used to keep older versions of forge from trying to dynamically refresh your user object. 
 * Which if you logged in without a mojang account could cause tha game to crash
 */
export type mcUserTypeVal = "msa" | "mojang" | "legacy";
/**
 * The versions of the minecraft jar a set release's version json may have. Can be used to potentially download the server version
 * of a set release. 
 */
export type mcJarTypeVal = "client" | "client_mappings" | "server" | "server_mappings" | "windows_server";
/**
 * The version of the java runtime a set release uses internally. The 'java-runtime-arm' can be ignored unless you have GMLL
 * booted up on something like the raspberry pi. Otherwise gamma and beta are different versions of java 17, alpha is java 16 
 * and legacy is a version of java 8 
 */
export type mcRuntimeVal = "java-runtime-arm" | "java-runtime-gamma" | "java-runtime-alpha" | "java-runtime-beta" | "jre-legacy" | "minecraft-java-exe";
/**
 * Potential architextures. Only x86, x64 and arm64 are fixed valuas at this stage and are technically supported.
 * Use the others for stuff at your own risk since GMLL might be forced to change this if mojang suddenly chooses 
 * to support one of the other architextures 
 */
export type cpuArchRuleVal = "x86" | "x64" | "arm" | "arm64" | "mips" | "mipsel" | "ppc" | "ppc64" | "s390" | 's390x'
/**
 * ---------------------------------------------------------------------------------------------
 * Downloader 
 * ---------------------------------------------------------------------------------------------
 */
/**
 * The internal format of the file that is passed to GMLL's multithread downloader function. 
 */
export interface downloadableFile {
    name: string,
    path: string[],
    url: string,

    key: string,
    chk: {
        sha1?: string | string[],
        size?: number
    },
    unzip?: {
        file: string[],

        exclude?: string[]
    },
    executable?: boolean | string,
    dynamic?: boolean
}
/**
 * The base format some of mojang's internal download files. 
 * All files from mojang should have these fields
 */
export interface urlFile {
    size: number,
    sha1: string,
    url: string,
}

/**
 * The format of the asset index file minecraft uses 
 */
export interface assetIndex {
    "objects": { [key: string]: { "hash": string, "size": number, "ignore"?: boolean } },
    map_to_resources?: boolean,
    virtual?: boolean
}



type mojangResourceFile = { type: "file", downloads?: { lzma?: urlFile, raw: urlFile }, executable?: boolean }
type mojangResourceLink = { type: "link", target: string; }
type mojangResourceDir = { type: "directory" }
/**
 * The generic resource file format mojang uses. 
 * The two downloadables in this formate are the java edition runtimes and Minecraft Dungeons
 */
export interface mojangResourceManifest {
    files: {
        [key: string]: mojangResourceDir | mojangResourceLink | mojangResourceFile
    }
}
/**
 * An entry in a given runtime manifest. 
 */
export type runtimeManifestEntry = {
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
export type runtimeManifest = {
    [key in "gamecore" | "linux" | "linux-i386" | "mac-os" | "windows-x64" | "windows-x86" | "linux-arm64" | "linux-arm32" | "windows-arm64"]: {
        [key in "java-runtime-beta" | "java-runtime-alpha" | "jre-legacy" | "minecraft-java-exe" | "java-runtime-arm"]: Array<runtimeManifestEntry>
    }
}

/**
 * ---------------------------------------------------------------------------------------------
 * Index manifest 
 * ---------------------------------------------------------------------------------------------
 */

export interface versionManifest {
    //The ID of the version, must be unique
    id: string,
    //version type,
    type: mcVersionType,
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
    "_comment"?: string
}

/**
 * ---------------------------------------------------------------------------------------------
 * Version json
 * ---------------------------------------------------------------------------------------------
 */
export interface versionJsonRule {
    "action": "allow" | "disallow",
    os?: {
        name?: "osx" | "windows" | "linux",
        arch?: cpuArchRuleVal,
        version?: string
    },
    features?: launchOptions
}
export type versionJsonRules = Array<versionJsonRule>;

export interface artifact {
    sha1: string,
    url: string,
    size: number,
    id: string,
    totalSize: string,
    path: string,
}

/**
 * The internal format for the dependencies a set version of Minecraft uses. 
 */
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
    rules?: versionJsonRules,
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
/**
 * The general format of a version.json file.
 * Do note that GMLL adds extentions to this interface to allow some of GMLL's more complex features to function. 
 */
export interface versionJson {
    arguments?: {
        "game": launchArguments
        "jvm": launchArguments
    },
    assetIndex: artifact,
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
        component: mcRuntimeVal,
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
    type: mcVersionType,
    synced?: boolean,
    inheritsFrom?: string,
    /**
     * The low level information GMLL's modpack api uses to download a set modpack
     */
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
        files: downloadableFile[];
        /**
         * Assets to inject into any instance made with this version file.
         */
        assets: Partial<assetIndex>;
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

/**
 * ---------------------------------------------------------------------------------------------
 * Instance
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Launch arguments for an instance. 
 * These are configurable with a rule check to avoid using a set argument in an enviroment that argument is incompatible with
 */
export type launchArguments = Array<string | { rules: versionJsonRules, value?: string | string[] }>
/**
 * Used in the Modpack API.
 * This is mainly used to insure a set modpack is compatible with this version of GMLL. 
 * It will also be used in the future to provide backwards compatibility. 
 */
export interface modpackApiInfo {
    name: string,
    version: number,
    sha: string,
    "_comment"?: string
}



export interface player {
    profile: {
        id: string,
        name: string,
        xuid?: string,
        type?: mcUserTypeVal,
        demo?: boolean,
        properties?: {
            //We're still reverse engineering what this property is used for...
            //This likely does not work anymore...
            twitch_access_token: string
        }
    },
    access_token?: string
}

export interface launchOptions {
    /**The name of the instance */
    name?: string,
    /**The version of the game to load */
    version?: string,
    /**The installation path */
    path?: string,
    /**Ram in GB */
    ram?: Number,
    /**Custom data your launcher can use */
    meta?: any,
    /**Asset index injection */
    assets?: assetIndex,
    /**Define a custom java path. 
     * @warning It is recommended to let GMLL handle this for you. It is solely changable to achieve parody with the vanilla launcher. 
     * Changing this can easily break older versions of forge, cause grathical corruption, crash legacy versions of minecraft, cause issues with arm Macs and a whole host of random BS.  
     * If brought up in the support channels for GMLL, you'll be asked to set this to it's default value if we see that you have changed it.
     */
    javaPath?: "default" | string;
}
