package za.net.hanro50.agenta.handler.Deligates;

import java.io.IOException;
import java.net.URL;

public class AuthFix extends Deligate {

    @Override
    public  Boolean check(URL url) {

        return url.toString().startsWith("http://www.minecraft.net/game/");
    }

    @Override
    public URL run(URL url) throws IOException {
        return new URL(url.toString().replace("www", "session"));
    }

}
