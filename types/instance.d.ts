namespace GMLL.instance {
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
        auth_session: string,

        library_directory: string,
        classpath_separator: string
    }

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

    export interface player {
        name: string,
        uuid: string,
        type: user_type,
        demo: boolean

        accessToken: string,
        /** @deprecated Only used with ancient versions of minecraft and is arguably not even supported by mojang anymore*/
        session?: string,

    }
}