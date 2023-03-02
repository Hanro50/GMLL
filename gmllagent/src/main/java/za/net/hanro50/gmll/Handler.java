package za.net.hanro50.gmll;

import java.net.URLStreamHandler;

public class Handler {
    public static String PREFIX = "sun.net.www.protocol.";

    public static URLStreamHandler oldCreateURLStreamHandler(String protocol) {
        String name = PREFIX +  protocol + ".Handler";
        try {
            @SuppressWarnings("deprecation")
            Object o = Class.forName(name).newInstance();
            return (URLStreamHandler) o;
        } catch (Exception e) {
          //  e.printStackTrace();
        }
        try {
            Object o = Class.forName(name).getConstructor().newInstance();
            return (URLStreamHandler) o;
        } catch (Exception e) {
            //e.printStackTrace();
        }
        return null;
    }
}
