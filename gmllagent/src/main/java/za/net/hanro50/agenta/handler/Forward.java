package za.net.hanro50.agenta.handler;

import java.net.Proxy;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

 class Forward {
    static HttpURLConnection connection(String u, Proxy proxy) throws IOException {
      return connection(new URL(u),proxy);
    }
    static HttpURLConnection connection(URL u, Proxy proxy) throws IOException {
        URL url = new URL(u.getProtocol().equals("http") ? "forward" : u.getProtocol(), u.getHost(), u.getPort(),
                u.getFile());
        if (proxy != null)
            return (HttpURLConnection) url.openConnection(proxy);
        return (HttpURLConnection) url.openConnection();
    }

}
