package za.net.hanro50.gmll.objects;

import java.util.Date;
import java.util.Map;

public class AssetIndex {
  public Map<String, assetObj> objects;
  
  public boolean map_to_resources;
  
  public boolean virtual;
  
  public static class assetObj {
    String hash;
    
    String size;
    
    String ignore;
  }
  
  public String compile() {
    String lines = "";
    Date date = new Date();
    long timeMilli = date.getTime();
    for (Map.Entry<String, assetObj> field : this.objects.entrySet()) {
      String key = field.getKey();
      if (key.contains("/"))
        lines = String.valueOf(lines) + key + "," + ((assetObj)field.getValue()).size + "," + timeMilli + "\n"; 
    } 
    return lines;
  }
}
