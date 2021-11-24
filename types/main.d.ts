
namespace GMLL {
    import EventEmitter from "events";
    export type update = "fabric" | "vanilla" | "forge" | "runtime";
    export type version_type = "old_alpha" | "old_beta" | "release" | "snapshot" | "fabric" | "forge" | "custom" | "unknown";
    export type user_type = "msa" | "mojang" | "legacy";
    export type jarTypes = "client" | "client_mappings" | "server" | "server_mappings" | "windows_server";
    export type runtimes = "java-runtime-alpha" | "java-runtime-beta" | "jre-legacy" | "minecraft-java-exe";
    export class Events extends EventEmitter {
        //Download
        on(e: "download.start" | "download.restart" | "download.done", f: () => void): void
        on(e: "download.setup", f: (cores: number) => void): void
        on(e: "download.progress", f: (key: string, index: Number, total: Number, left: Number) => void): void
        on(e: "download.fail", f: (key: string, type: "retry" | "fail" | "system", err: any) => void): void
   
        on(e: "minecraft.stdout" | "minecraft.stderr" , f: (chunk:any) => void): void
    }

}