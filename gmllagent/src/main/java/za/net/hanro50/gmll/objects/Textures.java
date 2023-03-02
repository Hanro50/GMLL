package za.net.hanro50.gmll.objects;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.util.Base64;
import za.net.hanro50.gmll.App;

public class Textures {
  private static Gson gson = (new GsonBuilder()).create();
  
  public String name;
  
  public String value;
  
  public Player2 decompile() {
    byte[] decodedBytes = Base64.getDecoder().decode(this.value);
    String decodedString = new String(decodedBytes);
    App.printf(decodedString);
    return (Player2)gson.fromJson(decodedString, Player2.class);
  }
}
