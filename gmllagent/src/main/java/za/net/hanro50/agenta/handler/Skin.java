package za.net.hanro50.agenta.handler;

import java.io.IOException;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.util.logging.Logger;

import za.net.hanro50.agenta.objects.Player;
import za.net.hanro50.agenta.objects.Player2;
import za.net.hanro50.agenta.objects.Profile;
import za.net.hanro50.agenta.objects.Textures;

class Skin {
    final static Logger prn = Logger.getLogger(Skin.class.getName());

    static URLConnection get(URL u, boolean skin, Proxy proxy) throws IOException {
        try {
            String username = u.toString();
            username = username.substring(username.lastIndexOf("/") + 1);
            username = username.substring(0, username.length() - 4);
            prn.info(username);
            Player player = Fetch.get("http://api.mojang.com/users/profiles/minecraft/" + username, Player.class);
            if (player != null) {
                Textures[] textures = Fetch.get(
                        "http://sessionserver.mojang.com/session/minecraft/profile/" + player.id,
                        Profile.class).properties;
                if (textures.length >= 1) {
                    Player2 plr = textures[0].decompile();
                    String text = skin ? plr.getSkin() : plr.getCape();
                    if (text != null)
                        return Forward.connection(text, proxy);
                }
            }
        } catch (InterruptedException | za.net.hanro50.agenta.objects.HTTPException e) {
            e.printStackTrace();
        }
        return Forward.connection(u.toString(), proxy);
    }
}
