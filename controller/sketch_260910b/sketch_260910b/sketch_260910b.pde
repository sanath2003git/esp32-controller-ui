import processing.serial.*;

Serial port;

int[] val = new int[16];
int[] baseline = new int[16];
int[] previous = new int[16];

boolean baselineReady = false;

String PORT_NAME = "/dev/ttyUSB0";
final int BAUD = 115200;

String lastLine = "(nothing received yet)";
int frameCountRx = 0;
long lastRxTime = 0;

void setup() {
  size(900, 700);

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
  textSize(14);
}

void draw() {
  background(245);

  fill(30);
  textSize(22);
  text("CD4067 SENSOR CHANNEL DEBUGGER", width / 2, 30);

  fill(80);
  textSize(13);
  text(
    "Cover ONE physical sensor at a time and watch which channel changes",
    width / 2,
    58
  );

  // Draw 16 channels in 4 x 4 grid
  int startX = 60;
  int startY = 100;

  int cellW = 190;
  int cellH = 125;

  for (int ch = 0; ch < 16; ch++) {

    int col = ch % 4;
    int row = ch / 4;

    float x = startX + col * cellW;
    float y = startY + row * cellH;

    int delta = abs(val[ch] - baseline[ch]);

    // Strong change = darker / red
    if (baselineReady && delta > 500) {
      fill(255, 170, 170);
    } else {
      fill(225);
    }

    stroke(100);
    strokeWeight(2);

    rect(x, y, 160, 95, 8);

    fill(30);

    textSize(20);
    text("CH " + ch, x + 80, y + 20);

    textSize(17);
    text("Value: " + val[ch], x + 80, y + 47);

    textSize(14);
    text("Baseline: " + baseline[ch], x + 80, y + 68);

    textSize(14);
    text("Change: " + delta, x + 80, y + 87);
  }

  // Bottom diagnostics
  fill(40);
  textAlign(LEFT, TOP);
  textSize(12);

  long sinceRx = millis() - lastRxTime;

  String status =
    (lastRxTime == 0)
    ? "NO DATA EVER RECEIVED"
    : (sinceRx > 1000
       ? "STALE (" + sinceRx + " ms ago)"
       : "receiving OK");

  text("Port: " + PORT_NAME + "   Status: " + status, 40, 620);
  text("Frames received: " + frameCountRx, 40, 640);

  if (!baselineReady) {
    text(
      "Baseline is being captured. Keep all sensors uncovered and still.",
      40,
      660
    );
  } else {
    text(
      "Baseline captured. Large CHANGE values indicate the sensor being affected.",
      40,
      660
    );
  }

  textAlign(CENTER, CENTER);
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

  for (int i = 0; i < 16; i++) {

    try {

      int newValue = int(parts[i + 1]);

      previous[i] = val[i];
      val[i] = newValue;

      // Capture initial baseline
      if (!baselineReady) {
        baseline[i] = newValue;
      }

    } catch (Exception e) {
      println("Invalid value for channel " + i);
    }
  }

  // Capture baseline after approximately 30 frames
  if (frameCountRx >= 30 && !baselineReady) {
    baselineReady = true;

    println("========== BASELINE ==========");

    for (int i = 0; i < 16; i++) {
      println("CH " + i + " = " + baseline[i]);
    }

    println("==============================");
  }
}
