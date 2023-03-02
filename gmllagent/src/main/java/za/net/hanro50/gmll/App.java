package za.net.hanro50.gmll;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.lang.instrument.Instrumentation;
import java.lang.reflect.Array;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.net.URLStreamHandlerFactory;

import za.net.hanro50.gmll.modules.Fetch;
import za.net.hanro50.gmll.modules.ResourceFileRerouted;
import za.net.hanro50.gmll.objects.Player;
import za.net.hanro50.gmll.objects.Player2;
import za.net.hanro50.gmll.objects.Profile;
import za.net.hanro50.gmll.objects.Textures;

public class App extends URLStreamHandler implements URLStreamHandlerFactory {
    private static final Gson gson = (new GsonBuilder()).setPrettyPrinting().create();

    public static URLConnection getCape(URL u, boolean skin, Proxy proxy) throws IOException {
        try {
            String username = u.toString();
            username = username.substring(username.lastIndexOf("/") + 1);
            username = username.substring(0, username.length() - 4);
            printf(username);
            Player player = Fetch.get("http://api.mojang.com/users/profiles/minecraft/" + username, Player.class);
            if (player != null) {
                Textures[] textures = Fetch.get(
                        "http://sessionserver.mojang.com/session/minecraft/profile/" + player.id,
                        Profile.class).properties;
                if (textures.length >= 1) {
                    Player2 plr = textures[0].decompile();
                    String text = skin ? plr.getSkin() : plr.getCape();
                    if (text != null)
                        return forwardConnection(text, proxy);
                }
            }
        } catch (InterruptedException | za.net.hanro50.gmll.modules.HTTPException e) {
            e.printStackTrace();
        }
        return forwardConnection(u.toString(), proxy);
    }

    protected URLConnection openConnection(URL u) throws IOException {
        return openConnection(u, Proxy.NO_PROXY);
    }

    protected URLConnection openConnection(URL u, Proxy p) throws IOException {
        String U = u.toString();
        printf("Rerouting [" + u.getHost() + u.getPath() + "]");
        if (U.contains("/MinecraftSkins/"))
            return getCape(u, true, p);
        if (U.contains("/skin/"))
            return getCape(u, true, p);
        if (U.contains("/MinecraftCloaks/"))
            return getCape(u, false, p);
        if (U.contains("/cloak/"))
            return getCape(u, false, p);
        if (U.startsWith("http://www.minecraft.net/resources/"))
            return (URLConnection) new ResourceFileRerouted(new URL("forward", u.getHost(), u.getFile()));
        if (U.startsWith("http://www.minecraft.net/game/"))
            return forwardConnection(new URL("http", "session.minecraft.net", u.getFile()), p);
        return forwardConnection(u, p);
    }

    public URLStreamHandler createURLStreamHandler(String protocol) {
        if (protocol.toLowerCase().equals("http"))
            return this;
        if (protocol.toLowerCase().equals("forward"))
            return Handler.oldCreateURLStreamHandler("http");
        return Handler.oldCreateURLStreamHandler(protocol);
    }

    private static HttpURLConnection forwardConnection(URL u, Proxy proxy) throws IOException {
        URL url = new URL(u.getProtocol().equals("http") ? "forward" : u.getProtocol(), u.getHost(), u.getPort(),
                u.getFile());
        if (proxy != null)
            return (HttpURLConnection) url.openConnection(proxy);
        return (HttpURLConnection) url.openConnection();
    }

    private static HttpURLConnection forwardConnection(String u, Proxy proxy) throws IOException {
        return forwardConnection(new URL(u), proxy);
    }

    public static void printf(Object line) {
        if (line instanceof String) {
            System.out.println("[agemt] " + line);
        } else if (line instanceof Object) {
            System.out.println("[agemt] " + gson.toJson(line));
        } else {
            System.out.println("[agemt] " + line);
        }
    }

    public static void argChk() {
        try {
            if (Handler.oldCreateURLStreamHandler("http") != null && Handler.oldCreateURLStreamHandler("https") != null)
                return;
            printf("Patching in module permissions!");
            String[] modules = { "file", "ftp", "http", "https", "jar", "jmod", "jrt", "mailto" };
            for (String module : modules) {
                String moduleAndPackage = "java.base/sun.net.www.protocol." + module;
                String[] s = moduleAndPackage.trim().split("/");

                if (s.length != 2)
                    continue;
                jdk.internal.module.Modules.addExports(ModuleLayer.boot().findModule(s[0]).orElseThrow(), s[1],
                        Handler.class.getModule());
            }
            printf("Done! Testing if new settings stuck!");
        } catch (Throwable e) {
            e.printStackTrace();
        }
        if (Handler.oldCreateURLStreamHandler("http") != null && Handler.oldCreateURLStreamHandler("https") != null)
            return;
        printf(
                "\n\033[1;31mWARNING\033[0m: Please add the following JVM argument and relaunch\n" +
                        "\033[1;37m--add-exports java.base/jdk.internal.module=ALL-UNNAMED\033[0m\n\n"
                        +
                        "As it stands this application will error out if it continues\nAlternatively. Use java 8!");
        System.exit(-1);
    }

    public static void main(String[] args) throws ClassNotFoundException, NoSuchMethodException, SecurityException,
            NegativeArraySizeException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {
        printf("Running in prefight check mode!");
        new App();
        String main = System.getProperty("gmll.main.class", "net.minecraft.client.main.Main");
        Class<?> C = App.class.getClassLoader().loadClass(main);
        Method M = C.getMethod("main", new Class[] { Array.newInstance(String.class, 0).getClass() });
        M.invoke(null, new Object[] { args });
    }

    public static void premain(String agentArgs, Instrumentation instrumentation) {
        printf("Running in java agent mode!");
        new App();
    }

    public App() {
        URL.setURLStreamHandlerFactory(this);
        System.setProperty("fml.ignoreInvalidMinecraftCertificates", "true");
        argChk();
      
    }
}
