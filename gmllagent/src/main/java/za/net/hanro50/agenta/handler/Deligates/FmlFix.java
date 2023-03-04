package za.net.hanro50.agenta.handler.Deligates;

import java.io.IOException;
import java.net.URL;

public class FmlFix extends Deligate {
    final String urlFix = "http://files.minecraftforge.net/fmllibs/";

    @Override
    public Boolean check(URL url) {
        return url.toString().startsWith(urlFix);
    }

    @Override
    public URL run(URL url) throws IOException {
        String urlStr = url.toString();
        urlStr = (urlStr.startsWith(urlFix)) ? urlStr.substring(urlFix.length()) : "";
        URL t = new URL(urlStr);
        return new URL("forward", t.getHost(), t.getFile());
    }

}
