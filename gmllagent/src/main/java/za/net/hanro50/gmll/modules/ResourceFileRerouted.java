package za.net.hanro50.gmll.modules;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import za.net.hanro50.gmll.App;
import za.net.hanro50.gmll.objects.AssetIndex;

public class ResourceFileRerouted extends URLConnection {
  String indexString;
  
  public ResourceFileRerouted(URL url) {
    super(url);
    App.printf("creating connector!");
    App.printf("Proxying resources...");
    try {
      AssetIndex index = Fetch.<AssetIndex>get(
          "https://launchermeta.mojang.com/v1/packages/3d8e55480977e32acd9844e545177e69a52f594b/pre-1.6.json", 
          AssetIndex.class);
      App.printf("Checking index");
      if (index != null && !index.objects.isEmpty()) {
        this.indexString = index.compile().trim();
        App.printf(this.indexString);
        return;
      } 
    } catch (IOException|InterruptedException|HTTPException e) {
      App.printf("An error occurred.");
      e.printStackTrace();
    } 
    App.printf("Loading fallback");
    this.indexString = "sound/step/wood4.ogg,6817,1306594588000\nsound/step/gravel3.ogg,6905,1306594588000\nsound/step/wood2.ogg,6294,1306594588000\nsound/step/gravel1.ogg,6851,1306594588000\nsound/step/grass2.ogg,7691,1306594588000\nsound/step/gravel4.ogg,6728,1306594588000\nsound/step/grass4.ogg,7163,1306594588000\nsound/step/gravel2.ogg,7501,1306594588000\nsound/step/wood1.ogg,6541,1306594588000\nsound/step/stone4.ogg,6516,1306594588000\nsound/step/grass3.ogg,7194,1306594588000\nsound/step/wood3.ogg,6604,1306594588000\nsound/step/stone2.ogg,6728,1306594588000\nsound/step/stone3.ogg,6627,1306594588000\nsound/step/grass1.ogg,7468,1306594588000\nsound/step/stone1.ogg,6695,1306594588000\nsound/loops/ocean.ogg,671068,1306594588000\nsound/loops/cave chimes.ogg,812950,1306594588000\nsound/loops/waterfall.ogg,87071,1306594588000\nsound/loops/birds screaming loop.ogg,484825,1306594588000\nsound/random/wood click.ogg,4385,1306594588000\nmusic/calm2.ogg,1961732,1306594588000\nmusic/calm3.ogg,2198764,1306594588000\nmusic/calm1.ogg,2546949,1306594588000";
  }
  
  public void connect() throws IOException {}
  
  public InputStream getInputStream() throws IOException {
    App.printf("Getting stream");
    return new ByteArrayInputStream(this.indexString.getBytes(StandardCharsets.UTF_8));
  }
}
