namespace GMLL.config {
    export interface metafiles {
        profile: string
        version: {
            folder: string,
            latest: string,
            vanilla: string,
            fabric: string,
            forge:string
        },
        launcher: {
            runtime: string,
            instances: string,
            libIndex: string,
        },
        assets: {
            resources: string,
            virtual: string,
            indexes: string
        }
    }
    export interface opt {
        files?: {
            /**The root folder */
            minecraft?: string,
            /**The default location where instances are stored */
            instances?: string,
            /**The location the asset index is stored */
            assets?: string,
            /**The versions folder */
            versions?: string,
            /**Where natives are extracted to */
            natives?: string,
            /**The location of the Launcher's meta data */
            launcher?: string,
            /**Where the required java runtimes to launch a set version is stored */
            runtimes?: string,
            /**The location where minecraft's dependencies are stored */
            libraries?: string,
            /**Launcher META data directories */
            /**The json files in here represents version manifest files. They're combined to give you the versions file */
            patch?: string,
            /**Where the meta data that allows instances to function is stored */
            profiles?: string
        },
        launcherFiles?: {
            versions?: string,
            latest?: string
        },
        update?: [update],
        events?: EventListener

    }
    export interface impl {
        files: {
            minecraft: string,
            instances: string,
            assets: string,
            versions: string,
            natives: string,
            launcher: string,
            runtimes: string,
            libraries: string,
        },
        update: [update],
        events: EventListener,
        metaFiles: metafiles
    }
}