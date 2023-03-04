package za.net.hanro50.agenta.handler.Deligates;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;

import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.objects.AssetIndex;
import za.net.hanro50.agenta.objects.AssetIndex.assetObj;

public class ResourceXML extends Resourcebase {
    public ResourceXML() {
        super("http://s3.amazonaws.com/MinecraftResources/");
    }

    @Override
    public InputStream get(String urlStr, Proxy proxy) throws IOException {
        AssetIndex index = getIndex();

        if (urlStr.length() == 0) {
            Prt.info("Proxying resource index");
            String indexString;
            if (index != null && !index.objects.isEmpty()) {
                indexString = index.compileXML().trim();
                return new ByteArrayInputStream(indexString.getBytes(StandardCharsets.UTF_8));
            }
            Prt.info("Loading fallback");
            URL t = new URL(assetURL);
            t = new URL("forward", t.getHost(), t.getFile());
            URLConnection con = proxy != null ? t.openConnection(proxy) : t.openConnection();
            return con.getInputStream();
        } else {
            Prt.info("Proxying resource [" + urlStr + "]");
            assetObj asset = index.objects.get(urlStr);
            if (asset != null) {
                URL assetURI = new URL(assetURL + asset.hash.substring(0, 2) + "/" + asset.hash);
                URLConnection con = proxy != null ? assetURI.openConnection(proxy) : assetURI.openConnection();
                return con.getInputStream();
            }
            return null;
        }
    }
}