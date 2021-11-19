
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

    export interface downloadable {
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

    export interface version {
        arguments?: {
            "game": [string | { "rules": [rules], "value": string | [string] }]
            "jvm": [string | { "rules": [rules], "value": string | [string] }]
        },
        assetIndex: downloadable,
        assets: string,
        downloads: {
            client: downloadable,
            client_mappings?: downloadable,
            server?: downloadable,
            server_mappings?: downloadable,
            windows_server?: downloadable
        },
        logging?: {
            client: {
                argument: string,
                file: downloadable,
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
        "objects": [{ "hash": string, "size": Number }],
        map_to_resources?: boolean,
        virtual?: boolean
    }
}