package za.net.hanro50.agenta.handler.Deligates;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Proxy;
import java.nio.charset.StandardCharsets;

import za.net.hanro50.agenta.Prt;
import za.net.hanro50.agenta.objects.AssetIndex;

public class ResourceText extends Resourcebase {

  public ResourceText() {
    super("http://www.minecraft.net/resources/");
    // TODO Auto-generated constructor stub
  }

  @Override
  public InputStream get(String urlStr, Proxy proxy) throws IOException {
    String indexString;
    Prt.info("Proxying resources...");
    AssetIndex index = getIndex();
    Prt.info("Checking index");
    if (index != null && !index.objects.isEmpty()) {
      indexString = index.compileText().trim();
      return new ByteArrayInputStream(indexString.getBytes(StandardCharsets.UTF_8));
    }
    Prt.info("Loading fallback");
    indexString = "sound/step/wood4.ogg,6817,1306594588000\nsound/step/gravel3.ogg,6905,1306594588000\nsound/step/wood2.ogg,6294,1306594588000\nsound/step/gravel1.ogg,6851,1306594588000\nsound/step/grass2.ogg,7691,1306594588000\nsound/step/gravel4.ogg,6728,1306594588000\nsound/step/grass4.ogg,7163,1306594588000\nsound/step/gravel2.ogg,7501,1306594588000\nsound/step/wood1.ogg,6541,1306594588000\nsound/step/stone4.ogg,6516,1306594588000\nsound/step/grass3.ogg,7194,1306594588000\nsound/step/wood3.ogg,6604,1306594588000\nsound/step/stone2.ogg,6728,1306594588000\nsound/step/stone3.ogg,6627,1306594588000\nsound/step/grass1.ogg,7468,1306594588000\nsound/step/stone1.ogg,6695,1306594588000\nsound/loops/ocean.ogg,671068,1306594588000\nsound/loops/cave chimes.ogg,812950,1306594588000\nsound/loops/waterfall.ogg,87071,1306594588000\nsound/loops/birds screaming loop.ogg,484825,1306594588000\nsound/random/wood click.ogg,4385,1306594588000\nmusic/calm2.ogg,1961732,1306594588000\nmusic/calm3.ogg,2198764,1306594588000\nmusic/calm1.ogg,2546949,1306594588000";
    return new ByteArrayInputStream(indexString.getBytes(StandardCharsets.UTF_8));
  }

}
