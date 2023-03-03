package za.net.hanro50.agenta.objects;

public class Player2 {
  public long timestamp;
  
  public String profileId;
  
  public String profileName;
  
  public Textures textures;
  
  public static class TexturesURL {
    public String url;
  }
  
  public static class Textures {
    public Player2.TexturesURL SKIN;
    
    public Player2.TexturesURL CAPE;
  }
  
  public String getCape() {
    if (this.textures.CAPE != null)
      return this.textures.CAPE.url; 
    return null;
  }
  
  public String getSkin() {
    if (this.textures.CAPE != null)
      return this.textures.SKIN.url; 
    return null;
  }
}
