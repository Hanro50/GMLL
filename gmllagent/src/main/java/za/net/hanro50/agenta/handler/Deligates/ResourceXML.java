package za.net.hanro50.agenta.handler.Deligates;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;

import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.handler.Fetch;
import za.net.hanro50.agenta.objects.AssetIndex;
import za.net.hanro50.agenta.objects.HTTPException;

public class ResourceXML extends URLConnection implements Deligate {
    public ResourceXML() {
        super(null);
    }

    public void connect() throws IOException {
    }

    public InputStream getInputStream() throws IOException {
        String indexString;
        Prt.info("Proxying resources...");
        try {
            AssetIndex index = Fetch.<AssetIndex>get(
                    "https://launchermeta.mojang.com/v1/packages/3d8e55480977e32acd9844e545177e69a52f594b/pre-1.6.json",
                    AssetIndex.class);
            Prt.info("Checking index");
            if (index != null && !index.objects.isEmpty()) {
                indexString = index.compileXML().trim();
                return new ByteArrayInputStream(indexString.getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException | InterruptedException | HTTPException e) {
            Prt.warn("An error occurred.");
            e.printStackTrace();
        }
        Prt.info("Loading fallback");
        return new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Boolean check(URL url) {
        return url.toString().startsWith("http://s3.amazonaws.com/MinecraftResources/");
    }

    @Override
    public URL run(URL url) throws IOException {
        throw new UnsupportedOperationException("Unsupported method");
    }

    @Override
    public URLConnection run(URL url, Proxy proxy) throws IOException {
        return this;
    }
}