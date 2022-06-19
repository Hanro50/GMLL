/**The compatibility lib for integration with other libraries */
import type { player } from "../types.js";
import { throwErr } from "./internal/util.js";

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
 *
 * Notice that GMLL will not implement Microsoft accounts natively. 
 * I already did it for MSMC, I'm not doing it again -Hanro
 * 
 * @param msmcResult The resulting msmc result token
 * @deprecated For use with msmc 3.x and below, please use the function included in 4.0.0 to get this same result
 * @returns a GMLL launch token
 */
export function msmc2token(msmcResult: msmcResult): player {
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
/**
 * Due to mojang accounts becoming deprecated and the lack of accounts available to test endpoints for Mojang accounts.
 * GMLL will thus not implement a system to handle them properly.
 * 
 * @warning Not recommended for use with versions of the game made after 1.18
 * @param username The user's username
 * @param uuid The user's UUID
 * @param accessToken The user's access token (Needed for online play)
 * @param demo Whether to launch the game in demo mode or not (Userfull for demo account functionality)
 * @returns a GMLL launch token
 */
export function mojang2token(username: string, uuid: string, accessToken: string, demo: boolean): player {
    return {
        profile: {
            demo: demo,
            type: "mojang",
            id: uuid,
            name: username,
            xuid: ""//Not used by mojang accounts
        },
        access_token: accessToken
    };
}