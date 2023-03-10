/**The compatibility lib for integration with other libraries */
import type { player } from "../types";
/**
 * For third party login libraries. 
 * @param username The user's username
 * @param uuid The user's UUID 
 * @param accessToken The user's access token (Needed for online play)
 * @param xuid The user's xbox one uuid 
 * @param demo Whether to launch the game in demo mode or not (Userfull for demo account functionality)
 * @returns 
 */
export function getToken(username: string, uuid: string, accessToken: string, xuid: string, demo?: boolean): player {
    return {
        profile: {
            //No piracy -> Buy minecraft!
            demo: (demo || !accessToken),
            type: "mojang",
            id: uuid,
            name: username,
            xuid
        },
        access_token: accessToken
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