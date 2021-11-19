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
}