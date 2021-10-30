namespace GMLL {
    export type update = "fabric" | "vanilla" | "files" | "runtime";
    export interface config {
        files?: {
            minecraft?: string,
            instances?: string,
            assets?: string,
            versions?: string,
            natives?: string,
            launcher?: string,
            runtimes?: string,
            libraries?: string,
            patch?: string
        },
        launcherFiles?: {
            versions?: string,
            latest?: string
        },
        update?: [update],
        events?: EventListener

    }
    export interface config_Impl {
        files: {
            minecraft: string,
            instances: string,
            assets: string,
            versions: string,
            natives: string,
            launcher: string,
            runtimes: string,
            libraries: string,
            patch: string
        },
        update: [update],
        events: EventListener,
        metaFiles: {
            latest: string,
            vanilla: string,
            fabric: string,
            runtime: string
        }
    }
    export namespace profile {
        export interface paths {
            folder?: string;
            java?: string;
            version?: string;
            assets?: string;
            natives?: string;
        }
        export interface options {
            version?: string;
            paths?: paths;
        }
    }
    export interface version {
        id: string,
        type: "old_alpha" | "old_beta" | "release" | "snapshot" | "custom" | "fabric",
        url: string,
        time?: string,
        releaseTime?: string,
        sha1?: string,
        complianceLevel?: 1 | 0,
        //These two fields are for modded version jsons 
        base?: string,
        stable?: boolean,
    }
    export interface rules {
        "action": "allow" | "disallow",
        "os": {
            "name": "osx" | "windows" | "linux",
            "arch": "x86"
        }
    }
    export interface artifact {
        path: string,
        sha1: string,
        size?: Number,
        url: String
    }
    export interface libFiles {
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

}