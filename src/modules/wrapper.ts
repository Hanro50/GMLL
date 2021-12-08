/**The compatibility lib for integration with other libraries */
import { throwErr } from "./internal/util.js";
import { token as _token } from "./objects/instance.js";
/**The return object that all the async login procedures return */
export interface msmcResult {
    type: "Success" | "DemoUser" | "Authentication" | "Cancelled" | "Unknown"
    /**Only returned when the user has logged in via microsoft */
    "access_token"?: string, //Your classic Mojang auth token. 
    /**Only returned on a successful login and if the player owns the game*/
    profile?: any, //Player profile. Similar to the one you'd normally get with the Mojang login
    /**Used with the error types*/
    reason?: string,
    /**Used when there was a fetch rejection.*/
    data?: Response,
}
/**
 * While MSMC and GMLL have a similar login token format,
 * due to the author being the same between the two projects. 
 * They are still somewhat different and as such need to be converted. 
 * @param msmcResult The resulting msmc result token
 * @returns a GMLL launch token
 */
export function msmc2token(msmcResult: msmcResult): _token {
    if (msmcResult.type != "DemoUser" && msmcResult.type != "Success" || !msmcResult.profile) {
        throwErr("User was not logged in with msmc!");
    }
    return {
        profile: {
            demo: msmcResult.type == "DemoUser",
            type: "msa",
            id: msmcResult.profile.id,
            name: msmcResult.profile.name,
            xuid: msmcResult.profile.xuid
        },
        access_token: msmcResult.access_token
    };
}