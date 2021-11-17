namespace GMLL.instance {
    export interface options {
        /**The name of the instance */
        name?: string,
        /**The version of the game to load */
        version?: string,
        /**The installation path */
        path?: string,
        /**Number of CPU cores */
        cores?: string,
        /**Ram in GB */
        ram?: Number,
        /**Custom data your launcher can use */
        meta?: any
    }

    export class instance {
        version: version
        constructor(opt: options)
        save(): void
        launch(player: player, resolution?: { width: string, height: string }): any
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