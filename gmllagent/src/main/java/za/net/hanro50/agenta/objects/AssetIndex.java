package za.net.hanro50.agenta.objects;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

public class AssetIndex {
  public Map<String, assetObj> objects;

  public boolean map_to_resources;

  public boolean virtual;

  public static class assetObj {
    public String hash;

    public String size;

    public String ignore;
  }

  public String compileText() {
    String lines = "";
    Date date = new Date();
    long timeMilli = date.getTime();
    for (Map.Entry<String, assetObj> field : this.objects.entrySet()) {
      String key = field.getKey();
      if (key.contains("/"))
        lines = String.valueOf(lines) + key + "," + ((assetObj) field.getValue()).size + "," + timeMilli + "\n";
    }
    return lines;
  }

  private static final String date = (new SimpleDateFormat("MM/dd/yyyy KK:mm:ss a Z")).format(new Date());

  private String getPack(String key, String hash, int size) {

    if (hash == null)
      hash = String.valueOf(key.hashCode());
    return String.format(
        "<Contents><Key>%s</Key><LastModified>%s</LastModified><ETag>\"%s\"</ETag><Size>%d</Size><StorageClass>STANDARD</StorageClass></Contents>",
        key, date, hash, size);
  }

  public String compileXML() {
    List<Entry<String, assetObj>> field = new ArrayList<>();
    field.addAll(this.objects.entrySet());
    Collections.sort(field, new Comparator<Entry<String, assetObj>>() {
      @Override
      public int compare(Entry<String, assetObj> a, Entry<String, assetObj> b) {
        return a.getKey().compareToIgnoreCase(b.getKey());
      }
    });

    List<String> list = new ArrayList<>();
    String lstDir = "";
    for (Entry<String, assetObj> entry : field) {
      String key = entry.getKey();
      if (key.contains("/")) {//
        String crtDir = key.substring(0, key.lastIndexOf("/"));
        if (!lstDir.equals(crtDir)) {
          lstDir = crtDir;
          String s = "";
          for (String seg : crtDir.split("/")) {
            s += seg + "/";
            list.add(getPack(s, null, 0));
          }
        }
        list.add(getPack(key, entry.getValue().hash, Integer.valueOf(entry.getValue().size)));
      } else {
        lstDir = "";
      }
    }
    String fill = "";
    for (String string : list) {
      fill += string;
    }

    return String.format(
        "<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>MinecraftResources</Name><Prefix/><Marker/><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>%s</ListBucketResult>",
        fill);
  }
}
