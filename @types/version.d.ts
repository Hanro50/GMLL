
namespace GMLL.version {
    /**
     *  "--username",
                "${auth_player_name}",
                "--version",
                "${version_name}",
                "--gameDir",
                "${game_directory}",
                "--assetsDir",
                "${assets_root}",
                "--assetIndex",
                "${assets_index_name}",
                "--uuid",
                "${auth_uuid}",
                "--accessToken",
                "${auth_access_token}",
                "--userType",
                "${user_type}",
                "--versionType",
                "${version_type}"
     */
    export interface args {
        is_demo_user: boolean,

        has_custom_resolution: boolean,
        resolution_width: string,
        resolution_height: string,

        auth_player_name: string,
        version_name: string,
        game_directory: string,
        assets_root: string,
        assets_index_name: string,
        auth_uuid: string,
        user_type: "msa" | "mojang" | "legacy",
        version_type: version_type,
        auth_access_token: string,

        natives_directory: string,
        launcher_name: string,
        launcher_version: string,
        classpath: string,

        game_assets: string,
        auth_session: string
    }
    export interface rules {
        "action": "allow" | "disallow",
        os?: {
            "name": "osx" | "windows" | "linux",
            //     * compiled. Possible values are `'arm'`, `'arm64'`, `'ia32'`, `'mips'`,`'mipsel'`, `'ppc'`, `'ppc64'`, `'s390'`, `'s390x'`, `'x32'`, and `'x64'`.

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
    }

    export interface artifact extends downloadable {
        path: string,
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


    export interface structure {
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

}