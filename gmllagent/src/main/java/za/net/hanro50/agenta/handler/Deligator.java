package za.net.hanro50.agenta.handler;

import java.io.IOException;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.net.URLStreamHandlerFactory;

import za.net.hanro50.agenta.Main;

public class Deligator extends URLStreamHandler implements URLStreamHandlerFactory {

    @Override
    public URLStreamHandler createURLStreamHandler(String protocol) {
        if (protocol.toLowerCase().equals("http"))
            return new Deligator();
        if (protocol.toLowerCase().equals("forward"))
            return new sun.net.www.protocol.http.Handler();
        return null;
    }

    @Override
    protected URLConnection openConnection(URL u) throws IOException {
        return openConnection(u,null);
    }

    @Override
    protected URLConnection openConnection(URL url, Proxy proxy) throws IOException {
        String U = url.toString();
        Main.prn.info("Rerouting [" + url.getHost() + url.getPath() + "]");
        if (U.contains("/MinecraftSkins/"))
            return Skin.get(url, true, proxy);
        if (U.contains("/skin/"))
            return Skin.get(url, true, proxy);
        if (U.contains("/MinecraftCloaks/"))
            return Skin.get(url, false, proxy);
        if (U.contains("/cloak/"))
            return Skin.get(url, false, proxy);
        if (U.startsWith("http://www.minecraft.net/resources/"))
            return (URLConnection) new Resource(new URL("forward", url.getHost(), url.getFile()));
        if (U.startsWith("http://www.minecraft.net/game/"))
            return forward(new URL("http", "session.minecraft.net", url.getFile()), proxy);
        return forward(url, proxy);
    }

    private URLConnection forward(URL url, Proxy proxy) throws IOException {
        String protocol = url.getProtocol().equals("http") ? "forward" : url.getProtocol();
        URL urlForward = new URL(protocol, url.getHost(), url.getPort(), url.getFile());

        if (proxy != null)
            return urlForward.openConnection(proxy);
        return urlForward.openConnection();
    }

}
