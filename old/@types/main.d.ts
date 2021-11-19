
namespace GMLL2 {
    export type update = "fabric" | "vanilla" | "files" | "runtime";
    export type version_type = "old_alpha" | "old_beta" | "release" | "snapshot" | "custom" | "fabric";
    export type user_type = "msa" | "mojang" | "legacy";
    export type jarTypes = "client" | "client_mappings" | "server" | "server_mappings" | "windows_server"
    export type init = {
        /**
         * Will run a first time setup. Can be used by installers to insure the game will be ready to launch asap. 
         */
        setup(): Promise<void>;

        /**
         * A chronicle represents the data for a set version. This includes it's launch json for example
         * @param version The version name in string
         */
        getChronicle(version: string): GMLL.version.chronicle;

        /**
         * Instances are how you manage installations of minecraft. 
         */
        instance: {
            make: (opt: GMLL.instance.options) => GMLL.instance.instance,
            get: (name?: string) => GMLL.instance.instance
        }

        /**
         * Forge installer:
         * Uses Forgiac to install forge from an installation file. 
         * If no file is provided then the user will be prompted for it
         */
        installForge(File: String | String[] | null): Promise<void>
        /**
         * Get a list of available versions
         * @returns 
         */
        getVersions(): Array<GMLL.manifests.version>


        writeManifest(manifests: Array<GMLL.manifests>, fileID: string): void;

    }
}