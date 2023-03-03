package za.net.hanro50.agenta.handler;

import java.io.IOException;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.net.URLStreamHandlerFactory;
import java.util.ArrayList;
import java.util.List;

import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.handler.Deligates.AuthFix;
import za.net.hanro50.agenta.handler.Deligates.Deligate;
import za.net.hanro50.agenta.handler.Deligates.ResourceText;
import za.net.hanro50.agenta.handler.Deligates.ResourceXML;
import za.net.hanro50.agenta.handler.Deligates.SkinDeligate;

public class Deligator extends URLStreamHandler implements URLStreamHandlerFactory {
    private static List<Deligate> Deligates = new ArrayList<>();
    static {
        addDeligate(new SkinDeligate(true, "/MinecraftSkins/"));
        addDeligate(new SkinDeligate(true, "/skin/"));
        addDeligate(new SkinDeligate(false, "/MinecraftCloaks/"));
        addDeligate(new SkinDeligate(false, "/cloak/"));
        addDeligate(new AuthFix());
        addDeligate(new ResourceXML());
        addDeligate(new ResourceText());
    }

    public static void addDeligate(Deligate handler) {
        Deligates.add(handler);
    }

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
        return openConnection(u, null);
    }

    @Override
    protected URLConnection openConnection(URL url, Proxy proxy) throws IOException {
        Prt.info("Routing: "+url);
        for (Deligate deligate : Deligates) {
            if (deligate.check(url))
                return deligate.run(url, proxy);
        }
        return Deligate.forward(url, proxy);
    }

}
