package za.net.hanro50.agenta.handler.Deligates;

import java.io.IOException;
import java.net.URL;

import javax.net.ssl.SSLProtocolException;

import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.handler.Fetch;
import za.net.hanro50.agenta.objects.Player;
import za.net.hanro50.agenta.objects.Player2;
import za.net.hanro50.agenta.objects.Profile;
import za.net.hanro50.agenta.objects.Textures;

public class SkinDeligate extends Deligate {
    private boolean skin;
    private String endpoint;

    public SkinDeligate(boolean skin, String endpoint) {
        this.skin = skin;
        this.endpoint = endpoint;
    }

    @Override
    public Boolean check(URL url) {
        return url.toString().contains(endpoint);
    }

    private String protocol = "https";

    @Override
    public URL run(URL u) throws IOException {
        try {
            String username = u.toString();
            username = username.substring(username.lastIndexOf("/") + 1);
            username = username.substring(0, username.length() - 4);
            Prt.info(username);
            Player player = Fetch.get(protocol + "://api.mojang.com/users/profiles/minecraft/" + username,
                    Player.class);
            if (player != null) {
                Textures[] textures = Fetch.get(
                        protocol + "://sessionserver.mojang.com/session/minecraft/profile/" + player.id,
                        Profile.class).properties;
                if (textures.length >= 1) {
                    Player2 plr = textures[0].decompile();
                    String text = skin ? plr.getSkin() : plr.getCape();
                    if (text != null)
                        return new URL(text);
                }
            }
        } catch (InterruptedException | za.net.hanro50.agenta.objects.HTTPException e) {
            e.printStackTrace();
        } catch (SSLProtocolException e) {
            if (protocol.equals("https")) {
                Prt.warn("HTTPS FAIL: Loading http fallback");
                protocol = "http";
                return run(u);
            }
            throw e;
        }
        return u;

    }

}
