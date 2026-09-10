import processing.serial.*;

Serial port;
int[] val = new int[16];
final int THRESHOLD = 4000;

String PORT_NAME = "/dev/ttyUSB0";     // <-- edit this
final int BAUD = 115200;
final float D = 34;

// diagnostics
String lastLine = "(nothing received yet)";
int frameCountRx = 0;
long lastRxTime = 0;

void setup() {
  size(560, 720);
  println("=== Serial ports available ===");
  printArray(Serial.list());
  println("Trying to open: " + PORT_NAME);
  try {
    port = new Serial(this, PORT_NAME, BAUD);
    port.clear();
    port.bufferUntil('\n');
    println("Port opened OK.");
  } catch (Exception e) {
    println("FAILED to open " + PORT_NAME + " -> " + e);
  }
  textAlign(CENTER, CENTER);
  textSize(12);
}

void draw() {
  background(245);

  float bodyX = 95, bodyY = 70, bodyW = 330, bodyH = 505;
  stroke(120,180,120); strokeWeight(1); fill(178,226,178);
  rect(bodyX, bodyY, bodyW, bodyH, 4);
  noFill(); stroke(60); rect(60, 40, 440, 590);

  int[] arr = {0,1,2,3,4,5,6,7};
  for (int i=0;i<8;i++){
    float x=lerp(bodyX+32, bodyX+bodyW-32, i/7.0), y=bodyY+20;
    drawSensor(x,y,arr[i],val[arr[i]]<THRESHOLD,color(206,199,236));
  }
  drawSensor(70,50,9,val[9]<THRESHOLD,color(250,224,150));
  drawSensor(490,50,15,val[15]<THRESHOLD,color(250,224,150));
  drawSensor(70,620,11,val[11]<THRESHOLD,color(250,224,150));
  drawSensor(490,620,14,val[14]<THRESHOLD,color(250,224,150));
  drawSensor(95,70,10,val[10]>THRESHOLD,color(240,150,140));
  drawSensor(465,70,8,val[8]>THRESHOLD,color(240,150,140));
  drawSensor(95,600,12,val[12]>THRESHOLD,color(240,150,140));
  drawSensor(465,600,13,val[13]>THRESHOLD,color(240,150,140));

  // ---- diagnostics panel ----
  fill(40); textAlign(LEFT, TOP); textSize(11);
  long sinceRx = millis() - lastRxTime;
  String status = (lastRxTime == 0) ? "NO DATA EVER RECEIVED"
                 : (sinceRx > 1000 ? "STALE (" + sinceRx + " ms ago)" : "receiving OK");
  text("Port: " + PORT_NAME + "   Status: " + status, 60, 645);
  text("Frames rx: " + frameCountRx, 60, 660);
  text("Last line: " + lastLine, 60, 675);
  text("val[8]="+val[8]+"  val[10]="+val[10]+"  val[13]="+val[13], 60, 690);
  textAlign(CENTER, CENTER); textSize(12);
}

void drawSensor(float cx, float cy, int ch, boolean trig, int restCol) {
  pushMatrix(); translate(cx,cy); rotate(radians(45));
  stroke(90); strokeWeight(1);
  fill(trig ? color(230,40,40) : restCol);
  rectMode(CENTER); rect(0,0,D,D,3); rectMode(CORNER);
  popMatrix();
  fill(trig?255:40); text(ch,cx,cy);
}

void serialEvent(Serial p) {
  String line = p.readStringUntil('\n');
  if (line == null) return;
  lastLine = trim(line);
  lastRxTime = millis();
  frameCountRx++;
  if (!lastLine.startsWith("D")) return;
  String[] parts = split(lastLine, ',');
  if (parts.length < 17) return;
  for (int i=0;i<16;i++){ try { val[i]=int(parts[i+1]); } catch(Exception e){} }
}
