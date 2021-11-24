
namespace GMLL.json {
    export interface rules {
        "action": "allow" | "disallow",
        os?: {
            "name": "osx" | "windows" | "linux",
            "arch": "x32" | "x64" | "arm" | "arm64" | "ia32" | "mips" | "mipsel" | "ppc" | "ppc64" | "s390" | 's390x',
            "version": string
        },
        features?: features
    }

    export interface artifact {
        sha1: string,
        url: String,
        size?: Number,
        id?: String,
        totalSize?: String,
        path?: string,
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
        rules?: [rules],
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
    export interface assetIndex {
        id: string,
        sha1: string,
        size: Number,
        totalSize: Number,
        url: string
    }

    export interface version {
        arguments?: {
            "game": [string | { "rules": [rules], "value": string | [string] }]
            "jvm": [string | { "rules": [rules], "value": string | [string] }]
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
            component: string,
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
        inheritsFrom?: String,
    }

    export interface assets {
        "objects": {[key instanceof string]: { "hash": string, "size": Number} },
        map_to_resources?: boolean,
        virtual?: boolean
    }

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
        overrides?: Partial<GMLL.json.version>
    }
}