/*
  MAINBOT firmware
  OLED support: SSD1306 0.96 inch, 128x64, I2C address 0x3C

  Frontend -> ESP32 JSON contract

  OLED display is controlled locally by the firmware. On startup it shows a
  welcome message, then an animated fullscreen happy face while idle. During
  Colour Quest, the game engine owns the OLED.

  Response examples:
  {"type":"response","status":"ok","command":"display_text"}
  {"type":"response","status":"error","command":"display_text","message":"Text
  too long"}

  Notes:
  - Text is UTF-8 JSON. The OLED font is ASCII-only.
  - Use named bitmap emojis instead of Unicode emoji characters.
  - BLE uses Nordic UART Service (NUS): service 6E400001, RX 6E400002, TX
  6E400003.
  - Messages are newline-delimited JSON.
  - Existing movement, RGB, buzzer, telemetry, and sensor logic is preserved.
  - Colour Quest runs on the robot for 6 levels x 10 tasks. Each task has a 5s display + 5s answer window.
*/

#include <Adafruit_GFX.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <Wire.h>
#include <math.h>
#include <string.h>

// ========================================
// DEVICE
// ========================================

#define DEVICE_NAME "Elxie-CQ"
#define FIRMWARE_VERSION "2.1.0"

// ========================================
// BLE UUIDs
// ========================================

#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"

#define NUS_CHAR_RX_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

#define NUS_CHAR_TX_UUID "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

// ========================================
// PIN MAP
// ========================================

// Motor driver (TB6612FNG)
#define PIN_STBY 14
#define PIN_PWMA 18
#define PIN_AIN1 19
#define PIN_AIN2 20
#define PIN_PWMB 21
#define PIN_BIN1 47
#define PIN_BIN2 48

// Default motor PWM speed (0..255)
const int DEFAULT_SPEED = 180;

// Sonar (HC-SR04)
#define PIN_TRIG 15
#define PIN_ECHO 16

// I2C bus
#define PIN_SDA 8
#define PIN_SCL 9

// Mux (CD4067)
#define PIN_MUX_S0 4
#define PIN_MUX_S1 5
#define PIN_MUX_S2 6
#define PIN_MUX_S3 17
#define PIN_MUX_SIG 1

// Touch (TTP223)
#define PIN_TOUCH 12

// Battery percentage sense input (analog).
// ADC reading 0..4095 is mapped to 0..100 percent.
#define PIN_BATTERY 7

// Buzzer
#define PIN_BUZZER 13

// External NeoPixel strip
#define PIN_STRIP 10
#define NUM_STRIP_PIXELS 30

// Encoders
#define PIN_ENC_LEFT 39
#define PIN_ENC_RIGHT 40

// ========================================
// I2C DEVICE ADDRESSES
// ========================================

#define ADDR_MPU6050 0x68
#define ADDR_QMC5883P 0x2C
#define ADDR_OLED 0x3C

#define OLED_WIDTH 128
#define OLED_HEIGHT 64

bool mpu6050Present = false;
bool qmc5883Present = false;
bool oledPresent = false;

// ========================================
// IR MUX CHANNELS
// ========================================

// Corner sensors used for obstacle telemetry.
// C1 = corner-front-left  -> CH9
// C2 = corner-front-right -> CH15
// C3 = corner-rear-left   -> CH11
// C4 = corner-rear-right  -> CH14
#define MUX_CH_C1 9
#define MUX_CH_C2 15
#define MUX_CH_C3 11
#define MUX_CH_C4 14

#define IR_OBSTACLE_THRESHOLD 4000

// ========================================
// EXTERNAL NEOPIXEL STRIP
// ========================================

struct GameColor {
  const char *name;
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

Adafruit_NeoPixel strip(NUM_STRIP_PIXELS, PIN_STRIP, NEO_GRB + NEO_KHZ800);

// Physical WS2812 region mapping supplied for the Elxie robot.
// The RIGHT region wraps around the physical end of the 30-pixel strip.
const uint8_t RIGHT_PIXELS[] = {6, 7, 8};

const uint8_t FRONT_PIXELS[] = {27, 28};

const uint8_t LEFT_PIXELS[] = {18, 19, 20};

const uint8_t BACK_PIXELS[] = {11, 12};

#define RIGHT_PIXEL_COUNT (sizeof(RIGHT_PIXELS) / sizeof(RIGHT_PIXELS[0]))
#define FRONT_PIXEL_COUNT (sizeof(FRONT_PIXELS) / sizeof(FRONT_PIXELS[0]))
#define LEFT_PIXEL_COUNT (sizeof(LEFT_PIXELS) / sizeof(LEFT_PIXELS[0]))
#define BACK_PIXEL_COUNT (sizeof(BACK_PIXELS) / sizeof(BACK_PIXELS[0]))

enum StripRegion { REGION_FRONT, REGION_BACK, REGION_LEFT, REGION_RIGHT };

void setStripColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUM_STRIP_PIXELS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

void setRegionPixels(const uint8_t *pixels, size_t count, uint8_t r, uint8_t g,
                     uint8_t b) {
  for (size_t i = 0; i < count; i++) {
    strip.setPixelColor(pixels[i], strip.Color(r, g, b));
  }
}

void setRegionColor(StripRegion region, uint8_t r, uint8_t g, uint8_t b) {
  switch (region) {
  case REGION_FRONT:
    setRegionPixels(FRONT_PIXELS, FRONT_PIXEL_COUNT, r, g, b);
    break;
  case REGION_BACK:
    setRegionPixels(BACK_PIXELS, BACK_PIXEL_COUNT, r, g, b);
    break;
  case REGION_LEFT:
    setRegionPixels(LEFT_PIXELS, LEFT_PIXEL_COUNT, r, g, b);
    break;
  case REGION_RIGHT:
    setRegionPixels(RIGHT_PIXELS, RIGHT_PIXEL_COUNT, r, g, b);
    break;
  }
}

void clearStripBuffer() { strip.clear(); }

void showRegionColors(const GameColor colors[4]) {
  clearStripBuffer();

  // Direction/index mapping:
  // 0 = front, 1 = right, 2 = back, 3 = left.
  setRegionColor(REGION_FRONT, colors[0].r, colors[0].g, colors[0].b);
  setRegionColor(REGION_RIGHT, colors[1].r, colors[1].g, colors[1].b);
  setRegionColor(REGION_BACK, colors[2].r, colors[2].g, colors[2].b);
  setRegionColor(REGION_LEFT, colors[3].r, colors[3].g, colors[3].b);

  strip.show();
}

void setAllRegionsColor(uint8_t r, uint8_t g, uint8_t b) {
  setStripColor(r, g, b);
}

// ========================================
// OLED
// ========================================

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

void oledInit() {
  if (!oledPresent) {
    Serial.println("OLED not detected. Local OLED display disabled.");
    return;
  }

  if (!display.begin(SSD1306_SWITCHCAPVCC, ADDR_OLED)) {
    oledPresent = false;
    Serial.println("OLED initialization failed.");
    return;
  }

  // Startup welcome message.
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(8, 14);
  display.println("Welcome");
  display.setCursor(22, 38);
  display.println("Elxie!");
  display.display();

  Serial.println("OLED initialized.");
}

// Draw a large happy face using the full 128x64 OLED area.
void drawHappyFace(uint8_t frame) {
  if (!oledPresent)
    return;

  display.clearDisplay();

  // Face outline.
  display.drawCircle(64, 32, 30, SSD1306_WHITE);

  // Eyes: one frame blinks, the other frames are open.
  if (frame == 2) {
    display.drawLine(46, 24, 54, 24, SSD1306_WHITE);
    display.drawLine(74, 24, 82, 24, SSD1306_WHITE);
  } else {
    display.fillCircle(50, 24, 4, SSD1306_WHITE);
    display.fillCircle(78, 24, 4, SSD1306_WHITE);
  }

  // Animated smile.
  if (frame == 1) {
    display.drawLine(46, 40, 50, 44, SSD1306_WHITE);
    display.drawLine(50, 44, 56, 47, SSD1306_WHITE);
    display.drawLine(56, 47, 64, 48, SSD1306_WHITE);
    display.drawLine(64, 48, 72, 47, SSD1306_WHITE);
    display.drawLine(72, 47, 78, 44, SSD1306_WHITE);
    display.drawLine(78, 44, 82, 40, SSD1306_WHITE);
  } else {
    display.drawLine(44, 40, 49, 45, SSD1306_WHITE);
    display.drawLine(49, 45, 56, 49, SSD1306_WHITE);
    display.drawLine(56, 49, 64, 51, SSD1306_WHITE);
    display.drawLine(64, 51, 72, 49, SSD1306_WHITE);
    display.drawLine(72, 49, 79, 45, SSD1306_WHITE);
    display.drawLine(79, 45, 84, 40, SSD1306_WHITE);
  }

  display.display();
}

unsigned long lastIdleFaceFrame = 0;
uint8_t idleFaceFrame = 0;

void updateIdleDisplay() {
  if (!oledPresent)
    return;

  unsigned long now = millis();
  if (now - lastIdleFaceFrame < 500)
    return;

  lastIdleFaceFrame = now;
  idleFaceFrame = (idleFaceFrame + 1) % 3;
  drawHappyFace(idleFaceFrame);
}

// Single entry point used whenever the game returns to idle.
void challengeShowIdle() {
  lastIdleFaceFrame = 0;
  idleFaceFrame = 0;
  drawHappyFace(idleFaceFrame);
}

// ========================================
// BLE + COLOUR QUEST STATE
// ========================================

BLEServer *bleServer = nullptr;
BLECharacteristic *bleRxCharacteristic = nullptr;
BLECharacteristic *bleTxCharacteristic = nullptr;

bool deviceConnected = false;
bool wasDeviceConnected = false;
bool clientReady = false;

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 200;

// Newline-delimited NUS RX framing.
// BLE callbacks may deliver partial JSON messages, so complete lines
// are assembled before parsing in loop().
String rxLineBuffer;
String pendingLine;
volatile bool havePendingLine = false;

// ========================================
// COLOUR QUEST GAME ENGINE
// ========================================

enum GameState { GS_IDLE, GS_SHOWING, GS_WAIT_INPUT, GS_FEEDBACK };

GameState gameState = GS_IDLE;

#define COLOR_QUEST_MIN_LEVEL 1
#define COLOR_QUEST_MAX_LEVEL 6
#define COLOR_QUEST_TASKS 10

// Colour Quest uses the same physical region mapping as the main strip.
const uint8_t *CQ_RIGHT_PIXELS = RIGHT_PIXELS;
const uint8_t *CQ_BACK_PIXELS = BACK_PIXELS;
const uint8_t *CQ_LEFT_PIXELS = LEFT_PIXELS;
const uint8_t *CQ_FRONT_PIXELS = FRONT_PIXELS;

#define CQ_RIGHT_PIXEL_COUNT RIGHT_PIXEL_COUNT
#define CQ_FRONT_PIXEL_COUNT FRONT_PIXEL_COUNT
#define CQ_LEFT_PIXEL_COUNT LEFT_PIXEL_COUNT
#define CQ_BACK_PIXEL_COUNT BACK_PIXEL_COUNT

void setCQRegionColor(StripRegion region, uint8_t r, uint8_t g, uint8_t b) {
  switch (region) {
  case REGION_FRONT:
    setRegionPixels(CQ_FRONT_PIXELS, CQ_FRONT_PIXEL_COUNT, r, g, b);
    break;
  case REGION_BACK:
    setRegionPixels(CQ_BACK_PIXELS, CQ_BACK_PIXEL_COUNT, r, g, b);
    break;
  case REGION_LEFT:
    setRegionPixels(CQ_LEFT_PIXELS, CQ_LEFT_PIXEL_COUNT, r, g, b);
    break;
  case REGION_RIGHT:
    setRegionPixels(CQ_RIGHT_PIXELS, CQ_RIGHT_PIXEL_COUNT, r, g, b);
    break;
  }
}

void setCQStripColor(uint8_t r, uint8_t g, uint8_t b) {
  clearStripBuffer();
  setCQRegionColor(REGION_FRONT, r, g, b);
  setCQRegionColor(REGION_RIGHT, r, g, b);
  setCQRegionColor(REGION_BACK, r, g, b);
  setCQRegionColor(REGION_LEFT, r, g, b);
  strip.show();
}

const GameColor COLOR_PALETTE[] = {
    {"red", 255, 0, 0},      {"green", 0, 255, 0},   {"blue", 0, 0, 255},
    {"yellow", 255, 220, 0}, {"cyan", 0, 255, 255},  {"magenta", 255, 0, 255},
    {"orange", 255, 120, 0}, {"purple", 150, 0, 255}};

#define COLOR_PALETTE_N (sizeof(COLOR_PALETTE) / sizeof(COLOR_PALETTE[0]))

// Four answer regions used by the web controller.
// 0 = FRONT, 1 = RIGHT, 2 = BACK, 3 = LEFT.
const char *const REGION_NAMES[4] = {"front", "right", "back", "left"};

int colorOption[4] = {0, 1, 2, 3};
int colorTargetDirection = 0;

int challengeLevel = 0;
int challengeTaskIndex = 0;
int challengeCorrectCount = 0;

unsigned long challengeFeedbackUntil = 0;
unsigned long challengeShowUntil = 0;
unsigned long challengeGameDeadline = 0;
bool challengeAnswerCorrect = false;

// The game owns the robot only while a challenge is active.
// Persistent progression, stars and unlocks remain app-side.
void challengeStopOutputs() { setStripColor(0, 0, 0); }

const GameColor &colorByIndex(int index) {
  return COLOR_PALETTE[index % COLOR_PALETTE_N];
}

void challengeShowTaskPrompt() {
  if (!oledPresent)
    return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.printf("CQ L%d  T%d/%d", challengeLevel, challengeTaskIndex + 1,
                 COLOR_QUEST_TASKS);

  display.setCursor(0, 16);
  display.println("Find the PRIMARY");
  display.println("colour region.");

  display.setCursor(0, 48);
  display.println("5s SHOW + 5s ANSWER");
  display.setCursor(0, 58);
  display.println("F  R  B  L");
  display.display();
}

void challengeShowFeedback(bool correct) {
  if (!oledPresent)
    return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(correct ? 14 : 20, 20);
  display.println(correct ? "CORRECT" : "WRONG");

  display.setTextSize(1);
  display.setCursor(24, 44);
  display.printf("Score: %d/%d", challengeCorrectCount,
                 COLOR_QUEST_TASKS);
  display.setCursor(8, 56);
  display.println("Next task...");
  display.display();
}

const char *challengeLevelName(int level) {
  switch (level) {
  case 1:
    return "primary-memory";
  case 2:
    return "fast-primary";
  case 3:
    return "secondary-spot";
  case 4:
    return "fast-secondary";
  case 5:
    return "hue-tint";
  case 6:
    return "ultimate";
  default:
    return "unknown";
  }
}

// Every Colour Quest task has the same 10-second response window:
// 0-5 s: all four coloured regions are visible.
// 5-10 s: LEDs are turned off, but the web controller may still answer.
// A response received at any point during the full 10 s is evaluated.
unsigned long challengeDisplayDuration(int level) {
  if (level % 2 != 0) return 5000;
  return 2500;
}

unsigned long challengeAnswerTimeout(int level) {
  if (level % 2 != 0) return 5000;
  return 2500;
}

// Choose a random set of four distinct colour indices from a supplied pool.
void chooseDistinctColors(const int *pool, int poolSize) {
  bool used[COLOR_PALETTE_N] = {false};

  for (int slot = 0; slot < 4; slot++) {
    int selected;
    do {
      selected = pool[random(poolSize)];
    } while (used[selected]);

    used[selected] = true;
    colorOption[slot] = selected;
  }
}

// Build the actual four region colours for the current level.
//
// L1: one primary + three secondary. Target = the only primary.
// L2: same primary-vs-secondary recognition with a higher presentation challenge.
// L3: one secondary + three primary. Target = the only secondary.
// L4: same secondary-vs-primary recognition with a higher presentation challenge.
// L5: four hue/tint variants. Target = one exact variant.
// L6: four different extended colours. Target = one exact region.
//
// For every level, colorTargetDirection identifies the physical region
// whose displayed colour must be selected by the user.
void challengeBuildTask() {
  static const int PRIMARY[] = {0, 1, 2};   // red, green, blue
  static const int SECONDARY[] = {3, 4, 5}; // yellow, cyan, magenta
  static const int EXTENDED[] = {0, 1, 2, 3, 4, 5, 6, 7};

  if (challengeLevel <= 4) {
    int targetColor;
    int distractorColors[3];

    if (challengeLevel <= 2) {
      // L1 & L2: exactly one primary target plus the three secondary colours.
      // This guarantees that no distractor is a shade/tint of the target,
      // and no second primary colour can be mistaken for the target class.
      targetColor = PRIMARY[random(3)];
      distractorColors[0] = SECONDARY[0]; // yellow
      distractorColors[1] = SECONDARY[1]; // cyan
      distractorColors[2] = SECONDARY[2]; // magenta
    } else {
      // L3 & L4: exactly one secondary target plus all three primaries.
      targetColor = SECONDARY[random(3)];
      distractorColors[0] = PRIMARY[0]; // red
      distractorColors[1] = PRIMARY[1]; // green
      distractorColors[2] = PRIMARY[2]; // blue
    }

    // Shuffle the three distractor colours so their positions are random.
    for (int i = 2; i > 0; i--) {
      int j = random(i + 1);
      int t = distractorColors[i];
      distractorColors[i] = distractorColors[j];
      distractorColors[j] = t;
    }

    int targetSlot = random(4);
    int distractorCursor = 0;

    for (int slot = 0; slot < 4; slot++) {
      if (slot == targetSlot) {
        colorOption[slot] = targetColor;
      } else {
        colorOption[slot] = distractorColors[distractorCursor++];
      }
    }

    colorTargetDirection = targetSlot;
  } else {
    // Hard modes (L5 & L6): Target is a tertiary color (orange or purple).
    // Distractors are randomly selected from primary/secondary colors.
    static const int TERTIARY[] = {6, 7};
    
    int targetColor = TERTIARY[random(2)];
    
    int distractorColors[3];
    bool used[6] = {false};
    for (int i = 0; i < 3; i++) {
      int selected;
      do {
        selected = random(6);
      } while (used[selected]);
      used[selected] = true;
      distractorColors[i] = selected; // primary/secondary are indices 0-5
    }
    
    int targetSlot = random(4);
    int distractorCursor = 0;
    
    for (int slot = 0; slot < 4; slot++) {
      if (slot == targetSlot) {
        colorOption[slot] = targetColor;
      } else {
        colorOption[slot] = distractorColors[distractorCursor++];
      }
    }
    
    colorTargetDirection = targetSlot;
  }
}

// Return the actual colour used by a task slot.
GameColor challengeTaskColor(int slot) {
  return colorByIndex(colorOption[slot]);
}

// Illuminate all four physical regions simultaneously.
void challengeIlluminateTask() {
  GameColor taskColors[4];

  for (int slot = 0; slot < 4; slot++) {
    taskColors[slot] = challengeTaskColor(slot);
  }

  clearStripBuffer();

  // Slots correspond to FRONT, RIGHT, BACK, LEFT.
  setCQRegionColor(REGION_FRONT, taskColors[0].r, taskColors[0].g,
                   taskColors[0].b);
  setCQRegionColor(REGION_RIGHT, taskColors[1].r, taskColors[1].g,
                   taskColors[1].b);
  setCQRegionColor(REGION_BACK, taskColors[2].r, taskColors[2].g,
                   taskColors[2].b);
  setCQRegionColor(REGION_LEFT, taskColors[3].r, taskColors[3].g,
                   taskColors[3].b);

  strip.show();

  unsigned long now = millis();
  challengeShowUntil = now + challengeDisplayDuration(challengeLevel);
  challengeGameDeadline = now + challengeDisplayDuration(challengeLevel) +
                          challengeAnswerTimeout(challengeLevel);
  challengeShowTaskPrompt();
  gameState = GS_SHOWING;
}

// Send only non-spoiling task metadata.
// The target colour/direction is intentionally NOT transmitted to the web app,
// because that would reveal the answer. The robot remains the referee.
void challengeSendTask() {
  JsonDocument task;

  task["type"] = "task";
  task["game"] = "color-quest";
  task["level"] = challengeLevel;
  task["index"] = challengeTaskIndex;
  task["phase"] = "memorize";
  task["input"] = "region";
  task["regions"][0] = "front";
  task["regions"][1] = "right";
  task["regions"][2] = "back";
  task["regions"][3] = "left";

  sendJson(task);
}

void challengeCreateTask() {
  challengeBuildTask();
  challengeIlluminateTask();
  challengeSendTask();
}

void challengeBeginAnswerPhase() {
  challengeStopOutputs();

  if (oledPresent) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.printf("CQ L%d  T%d/%d", challengeLevel, challengeTaskIndex + 1,
                   COLOR_QUEST_TASKS);
    display.setTextSize(2);
    display.setCursor(22, 18);
    display.println("ANSWER");
    display.setTextSize(1);
    display.setCursor(0, 48);
    display.println("Choose: F R B L");
    display.setCursor(0, 58);
    display.println("5 seconds left");
    display.display();
  }

  JsonDocument phase;
  phase["type"] = "task";
  phase["game"] = "color-quest";
  phase["level"] = challengeLevel;
  phase["index"] = challengeTaskIndex;
  phase["phase"] = "answer";
  phase["input"] = "region";
  phase["regions"][0] = "front";
  phase["regions"][1] = "right";
  phase["regions"][2] = "back";
  phase["regions"][3] = "left";
  sendJson(phase);

  gameState = GS_WAIT_INPUT;
  // challengeGameDeadline was set when the task started. This phase gets
  // exactly the remaining 5 seconds of the task's 10-second total window.
  challengeShowUntil = millis() + challengeAnswerTimeout(challengeLevel);
}

void challengeStartLevel(int level) {
  if (level < COLOR_QUEST_MIN_LEVEL || level > COLOR_QUEST_MAX_LEVEL) {
    sendError("invalid color-quest level");
    return;
  }

  challengeStopOutputs();

  challengeLevel = level;
  challengeTaskIndex = 0;
  challengeCorrectCount = 0;
  challengeAnswerCorrect = false;
  challengeFeedbackUntil = 0;
  challengeShowUntil = 0;

  Serial.printf("Starting Colour Quest level %d (%s), %d tasks\n",
                challengeLevel, challengeLevelName(challengeLevel),
                COLOR_QUEST_TASKS);

  tone(PIN_BUZZER, 1800, 80);
  challengeCreateTask();
}

void challengeFinishLevel() {
  challengeStopOutputs();

  float score = (float)challengeCorrectCount / (float)COLOR_QUEST_TASKS;

  if (score < 0.0f || score > 1.0f) {
    sendError("computed score out of range");
    gameState = GS_IDLE;
    challengeShowIdle();
    return;
  }

  JsonDocument result;
  result["type"] = "response";
  result["game"] = "color-quest";
  result["level"] = challengeLevel;
  result["score"] = score;
  result["correct"] = challengeCorrectCount;
  result["tasks"] = COLOR_QUEST_TASKS;
  sendJson(result);

  Serial.printf("Colour Quest L%d complete: %d/%d, score=%.2f\n",
                challengeLevel, challengeCorrectCount, COLOR_QUEST_TASKS,
                score);

  tone(PIN_BUZZER, score >= 0.8f ? 2400 : 900, 150);

  if (oledPresent) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.printf("LEVEL %d COMPLETE", challengeLevel);
    display.setTextSize(2);
    display.setCursor(24, 18);
    display.printf("%d/%d", challengeCorrectCount, COLOR_QUEST_TASKS);
    display.setTextSize(1);
    display.setCursor(0, 46);
    display.printf("Score: %d%%", (int)round(score * 100.0f));
    display.setCursor(0, 57);
    display.println("Web app saves progress");
    display.display();
  }

  gameState = GS_IDLE;
  challengeLevel = 0;
  challengeShowIdle();
}

void challengeAbort() {
  challengeStopOutputs();
  noTone(PIN_BUZZER);

  gameState = GS_IDLE;
  challengeLevel = 0;
  challengeTaskIndex = 0;
  challengeCorrectCount = 0;

  JsonDocument response;
  response["type"] = "aborted";
  response["game"] = "color-quest";
  sendJson(response);

  challengeShowIdle();
}

int regionNameToDirection(const char *region) {
  if (region == nullptr)
    return -1;

  if (strcasecmp(region, "front") == 0)
    return 0;
  if (strcasecmp(region, "right") == 0)
    return 1;
  if (strcasecmp(region, "back") == 0)
    return 2;
  if (strcasecmp(region, "left") == 0)
    return 3;

  // Also accept controller direction names as a convenience.
  if (strcasecmp(region, "up") == 0)
    return 0;
  if (strcasecmp(region, "down") == 0)
    return 2;

  return -1;
}

void challengeAnswerDirection(int direction) {
  if (gameState != GS_WAIT_INPUT && gameState != GS_SHOWING)
    return;
  if (direction < 0 || direction > 3)
    return;

  challengeAnswerCorrect = direction == colorTargetDirection;

  if (challengeAnswerCorrect) {
    challengeCorrectCount++;
    tone(PIN_BUZZER, 2400, 100);
    setCQStripColor(0, 80, 0);
  } else {
    tone(PIN_BUZZER, 500, 250);
    setCQStripColor(80, 0, 0);
  }

  challengeShowFeedback(challengeAnswerCorrect);

  JsonDocument feedback;
  feedback["type"] = "task_result";
  feedback["game"] = "color-quest";
  feedback["level"] = challengeLevel;
  feedback["index"] = challengeTaskIndex;
  feedback["correct"] = challengeAnswerCorrect;
  feedback["correctCount"] = challengeCorrectCount;
  sendJson(feedback);

  challengeFeedbackUntil = millis() + 700;
  gameState = GS_FEEDBACK;
}

int joystickToDirection(int x, int y) {
  const int CENTER = 512;
  const int DEAD_ZONE = 200;

  int dx = x - CENTER;
  int dy = y - CENTER;

  if (abs(dx) < DEAD_ZONE && abs(dy) < DEAD_ZONE) {
    return -1;
  }

  if (abs(dx) > abs(dy)) {
    return dx > 0 ? 1 : 3;
  }

  return dy > 0 ? 2 : 0;
}

void handleChallengeInput(JsonDocument &doc) {
  if (gameState != GS_WAIT_INPUT && gameState != GS_SHOWING)
    return;

  if (doc.containsKey("region")) {
    const char *region = doc["region"] | "";
    int direction = regionNameToDirection(region);

    if (direction < 0) {
      sendError("invalid input region");
      return;
    }

    challengeAnswerDirection(direction);
    return;
  }

  if (doc.containsKey("dir")) {
    const char *dir = doc["dir"] | "";

    int direction = -1;

    if (strcasecmp(dir, "up") == 0)
      direction = 0;
    else if (strcasecmp(dir, "right") == 0)
      direction = 1;
    else if (strcasecmp(dir, "down") == 0)
      direction = 2;
    else if (strcasecmp(dir, "left") == 0)
      direction = 3;

    if (direction < 0) {
      sendError("invalid input direction");
      return;
    }

    challengeAnswerDirection(direction);
    return;
  }

  if (doc.containsKey("x") && doc.containsKey("y")) {
    int x = constrain((int)(doc["x"] | 512), 0, 1023);
    int y = constrain((int)(doc["y"] | 512), 0, 1023);

    int direction = joystickToDirection(x, y);

    if (direction >= 0) {
      challengeAnswerDirection(direction);
    }

    return;
  }

  sendError("input needs region, dir or x/y");
}

void sendJson(const JsonDocument &doc) {
  if (!deviceConnected || bleTxCharacteristic == nullptr)
    return;

  String payload;
  serializeJson(doc, payload);
  payload += "\n";

  // notify() only enqueues a packet - actual transmission is paced by the
  // negotiated BLE connection interval (commonly 15-30ms+). Sending many
  // small chunks back-to-back with a gap shorter than that interval lets
  // the stack's internal notification queue fill up faster than the radio
  // can drain it; on the ESP32 Bluedroid stack that tends to hard-reset
  // the link rather than throttle gracefully. Requesting a larger MTU in
  // setup() lets most messages fit in one or two notifications instead of
  // ~10, and the wider per-chunk delay keeps us comfortably under typical
  // connection-interval pacing even for centrals that only negotiate the
  // legacy 23-byte MTU.
  const size_t CHUNK_SIZE = 150;
  const uint32_t CHUNK_DELAY_MS = 15;

  for (size_t offset = 0; offset < payload.length(); offset += CHUNK_SIZE) {
    size_t length = min(CHUNK_SIZE, payload.length() - offset);
    bleTxCharacteristic->setValue((uint8_t *)(payload.c_str() + offset),
                                  length);
    bleTxCharacteristic->notify();
    delay(CHUNK_DELAY_MS);
  }

  Serial.print("TX: ");
  Serial.print(payload);
}

void sendError(const char *message) {
  JsonDocument response;
  response["type"] = "error";
  response["message"] = message;
  sendJson(response);
}

void sendDeviceInfo() {
  if (!deviceConnected)
    return;

  String macAddress = BLEDevice::getAddress().toString().c_str();
  macAddress.toUpperCase();
  macAddress.replace(":", "");

  JsonDocument response;

  response["type"] = "device_info";
  response["deviceId"] = macAddress;
  response["name"] = DEVICE_NAME;
  response["model"] = "ESP32-S3 N16R8";
  response["firmware"] = FIRMWARE_VERSION;

  response["sensors"]["mpu6050"] = mpu6050Present;
  response["sensors"]["qmc5883p"] = qmc5883Present;
  response["sensors"]["oled"] = oledPresent;

  sendJson(response);
}

void sendResponse(const char *command, bool success,
                  const char *message = nullptr) {
  JsonDocument response;

  response["type"] = "response";
  response["status"] = success ? "ok" : "error";
  response["command"] = command;

  if (message != nullptr) {
    response["message"] = message;
  }

  sendJson(response);
}

void handleMove(const char *direction, int speed = DEFAULT_SPEED);

void handleCommandLine(const String &line) {
  if (line.length() == 0)
    return;

  Serial.print("RX: ");
  Serial.println(line);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, line);

  if (error) {
    sendError("invalid JSON");
    return;
  }

  const char *type = doc["type"] | "";

  if (strcmp(type, "client_ready") == 0) {
    clientReady = true;
    Serial.println("Client notification setup confirmed.");
    sendDeviceInfo();
    return;
  }

  const char *command = doc["command"] | "";

  if (strcmp(command, "challenge") == 0) {
    const char *game = doc["game"] | "";

    if (strcmp(game, "color-quest") != 0) {
      sendError("unsupported game");
      return;
    }

    int level = doc["level"] | 0;
    challengeStartLevel(level);
    return;
  }

  if (strcmp(command, "input") == 0) {
    handleChallengeInput(doc);
    return;
  }

  if (strcmp(command, "abort") == 0) {
    if (gameState != GS_IDLE) {
      challengeAbort();
    }
    return;
  }

  // ========================================
  // EXISTING COMMANDS
  // ========================================

  if (strcmp(command, "ping") == 0) {
    sendResponse("ping", true, "Pong from Elxie-CQ");
  }

  else if (strcmp(command, "move") == 0) {
    const char *direction = doc["direction"];

    if (direction == nullptr) {
      sendResponse("move", false, "Missing direction");
      return;
    }

    int speed = constrain((int)(doc["speed"] | DEFAULT_SPEED), 0, 255);
    handleMove(direction, speed);
    sendResponse("move", true);
  }

  else if (strcmp(command, "stop") == 0) {
    motorsStop();
    sendResponse("stop", true);
  }

  else if (strcmp(command, "color") == 0) {
    int r = constrain((int)(doc["r"] | 0), 0, 255);
    int g = constrain((int)(doc["g"] | 0), 0, 255);
    int b = constrain((int)(doc["b"] | 0), 0, 255);

    setStripColor(r, g, b);
    sendResponse("color", true);
  }

  else if (strcmp(command, "strip") == 0) {
    const char *region = doc["region"] | "";
    int r = constrain((int)(doc["r"] | 0), 0, 255);
    int g = constrain((int)(doc["g"] | 0), 0, 255);
    int b = constrain((int)(doc["b"] | 0), 0, 255);

    if (strcasecmp(region, "all") == 0) {
      setStripColor(r, g, b);
      sendResponse("strip", true);
      return;
    }

    if (strcasecmp(region, "front") == 0) {
      setRegionColor(REGION_FRONT, r, g, b);
    } else if (strcasecmp(region, "right") == 0) {
      setRegionColor(REGION_RIGHT, r, g, b);
    } else if (strcasecmp(region, "back") == 0) {
      setRegionColor(REGION_BACK, r, g, b);
    } else if (strcasecmp(region, "left") == 0) {
      setRegionColor(REGION_LEFT, r, g, b);
    } else {
      sendResponse("strip", false, "Unknown region");
      return;
    }

    strip.show();
    sendResponse("strip", true);
  }

  else if (strcmp(command, "buzz") == 0) {
    int freq = constrain((int)(doc["freq"] | 1000), 20, 20000);
    int duration = constrain((int)(doc["duration"] | 200), 1, 5000);

    tone(PIN_BUZZER, freq, duration);
    sendResponse("buzz", true);
  }

  else {
    sendResponse(command, false, "Unknown command");
  }
}

// ========================================
// BLE SERVER CALLBACKS
// ========================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    deviceConnected = true;
    clientReady = false;
    lastTelemetry = millis();

    Serial.println("Web app connected!");
    challengeShowIdle();
  }

  void onDisconnect(BLEServer *server) override {
    deviceConnected = false;
    clientReady = false;

    // A disconnected controller must never leave the robot moving.
    motorsStop();

    // Abort an active game cleanly. The app can start it again after reconnect.
    challengeStopOutputs();
    gameState = GS_IDLE;

    Serial.println("Web app disconnected!");
    BLEDevice::startAdvertising();
    challengeShowIdle();
  }
};

// ========================================
// NUS RX CALLBACKS
// ========================================

class RxCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String value = characteristic->getValue();

    if (value.length() == 0)
      return;

    for (size_t i = 0; i < value.length(); i++) {
      char ch = value[i];

      if (ch == '\n' || ch == '\r') {
        if (rxLineBuffer.length() == 0)
          continue;

        // Only one pending line is needed for the low-rate command protocol.
        // If a line is already pending, process the latest complete command.
        pendingLine = rxLineBuffer;
        havePendingLine = true;
        rxLineBuffer = "";
      } else {
        rxLineBuffer += ch;

        if (rxLineBuffer.length() > 900) {
          Serial.println("BLE RX buffer overflow; discarding line.");
          rxLineBuffer = "";
        }
      }
    }
  }
};

// ========================================
// LIVE TELEMETRY
// ========================================
// TOUCH SENSOR LOGIC
// ========================================

unsigned long touchPressTime = 0;
unsigned long touchReleaseTime = 0;
bool isTouching = false;
int tapCount = 0;
String currentTouchEvent = "none";
bool holdTriggered = false;

void updateTouchState() {
  bool currentTouch = digitalRead(PIN_TOUCH) == HIGH;
  unsigned long now = millis();

  // If newly touched
  if (currentTouch && !isTouching) {
    isTouching = true;
    touchPressTime = now;
    holdTriggered = false;
  }
  
  // If newly released
  if (!currentTouch && isTouching) {
    isTouching = false;
    touchReleaseTime = now;
    
    unsigned long duration = now - touchPressTime;
    if (duration < 1000) {
      tapCount++;
    } else {
      // It was a hold that just ended
      currentTouchEvent = "none";
    }
  }

  // Handle tap counting timeout (wait 300ms for a second tap)
  if (!isTouching && tapCount > 0 && (now - touchReleaseTime > 300)) {
    if (tapCount == 1) {
      currentTouchEvent = "single_tap";
    } else if (tapCount >= 2) {
      currentTouchEvent = "double_tap";
    }
    tapCount = 0;
  }

  // Handle continuous hold
  if (isTouching && !holdTriggered && (now - touchPressTime > 1000)) {
    currentTouchEvent = "hold";
    holdTriggered = true; // prevent re-triggering constantly if we only want one hold event
  }
  
  // Clear tap events after they've been sent in telemetry (cleared in sendLiveTelemetry)
}

String consumeTouchEvent() {
  String event = currentTouchEvent;
  // Only clear the event if it's a tap. Hold persists while touching.
  if (event == "single_tap" || event == "double_tap") {
    currentTouchEvent = "none";
  }
  // If holding but released, it is cleared in updateTouchState
  return event;
}

// ========================================
// LIVE TELEMETRY
// ========================================

int readBatteryPercentage() {
  int raw = analogRead(PIN_BATTERY);
  return constrain((raw * 100L) / 4095L, 0, 100);
}

void sendLiveTelemetry() {
  if (!deviceConnected || !clientReady)
    return;

  // During Colour Quest, telemetry remains optional and does not control
  // the game state. The robot is still authoritative for task scoring.
  JsonDocument telemetry;

  telemetry["type"] = "telemetry";
  telemetry["battery_percentage"] = readBatteryPercentage();
  telemetry["direction"] = qmc5883ReadHeadingByte();

  long frontCm = readSonarCm();
  telemetry["distance"]["front"] = (frontCm < 0) ? -1 : frontCm;

  // Corner IR sensors only.
  // Obstacle is detected when the ADC value drops below 4000.
  telemetry["obstacle"]["frontLeft"] =
      readMuxChannel(MUX_CH_C1) < IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["frontRight"] =
      readMuxChannel(MUX_CH_C2) < IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["rearLeft"] =
      readMuxChannel(MUX_CH_C3) < IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["rearRight"] =
      readMuxChannel(MUX_CH_C4) < IR_OBSTACLE_THRESHOLD;

  telemetry["motion"]["sudden"] = detectSuddenMotion();
  telemetry["pit"]["detected"] = false;
  telemetry["timestamp"] = millis();
  
  telemetry["touch"]["event"] = consumeTouchEvent();

  sendJson(telemetry);
}

// ========================================
// MOTOR CONTROL
// ========================================

void motorsInit() {
  pinMode(PIN_STBY, OUTPUT);
  pinMode(PIN_AIN1, OUTPUT);
  pinMode(PIN_AIN2, OUTPUT);
  pinMode(PIN_BIN1, OUTPUT);
  pinMode(PIN_BIN2, OUTPUT);
  pinMode(PIN_PWMA, OUTPUT);
  pinMode(PIN_PWMB, OUTPUT);

  digitalWrite(PIN_STBY, LOW);
}

void driveMotorA(int speed, bool forward) {
  digitalWrite(PIN_AIN1, forward ? HIGH : LOW);
  digitalWrite(PIN_AIN2, forward ? LOW : HIGH);
  analogWrite(PIN_PWMA, constrain(speed, 0, 255));
}

void driveMotorB(int speed, bool forward) {
  digitalWrite(PIN_BIN1, forward ? HIGH : LOW);
  digitalWrite(PIN_BIN2, forward ? LOW : HIGH);
  analogWrite(PIN_PWMB, constrain(speed, 0, 255));
}

void motorsStop() {
  analogWrite(PIN_PWMA, 0);
  analogWrite(PIN_PWMB, 0);
  digitalWrite(PIN_STBY, LOW);
}

void motorsEnable() { digitalWrite(PIN_STBY, HIGH); }

// Motor A = RIGHT wheel
// Motor B = LEFT wheel
//
// Requested movement behaviour:
//   FRONT/FORWARD -> right forward + left forward
//   RIGHT         -> right idle    + left forward
//   BACK/BACKWARD -> right backward + left backward
//   LEFT          -> right forward + left idle
//
// Speed is PWM, 0..255. A speed value can be supplied by the BLE command;
// otherwise DEFAULT_SPEED is used.
void handleMove(const char *direction, int speed) {
  speed = constrain(speed, 0, 255);

  if (strcmp(direction, "forward") == 0 ||
      strcmp(direction, "front") == 0) {
    motorsEnable();
    driveMotorA(speed, true);   // right wheel forward
    driveMotorB(speed, true);   // left wheel forward

  } else if (strcmp(direction, "backward") == 0 ||
             strcmp(direction, "back") == 0) {
    motorsEnable();
    driveMotorA(speed, false);  // right wheel backward
    driveMotorB(speed, false);  // left wheel backward

  } else if (strcmp(direction, "right") == 0) {
    motorsEnable();
    driveMotorA(0, true);       // right wheel idle
    driveMotorB(speed, true);   // left wheel forward

  } else if (strcmp(direction, "left") == 0) {
    motorsEnable();
    driveMotorA(speed, true);   // right wheel forward
    driveMotorB(0, true);       // left wheel idle

  } else {
    Serial.print("Unknown movement direction: ");
    Serial.println(direction);
  }
}

// ========================================
// SONAR
// ========================================

void sonarInit() {
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
}

long readSonarCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration == 0)
    return -1;

  return duration / 58;
}

// ========================================
// IR MUX
// ========================================

void muxInit() {
  pinMode(PIN_MUX_S0, OUTPUT);
  pinMode(PIN_MUX_S1, OUTPUT);
  pinMode(PIN_MUX_S2, OUTPUT);
  pinMode(PIN_MUX_S3, OUTPUT);
  analogReadResolution(12);
}

int readMuxChannel(uint8_t channel) {
  digitalWrite(PIN_MUX_S0, channel & 0x01);
  digitalWrite(PIN_MUX_S1, (channel >> 1) & 0x01);
  digitalWrite(PIN_MUX_S2, (channel >> 2) & 0x01);
  digitalWrite(PIN_MUX_S3, (channel >> 3) & 0x01);
  delayMicroseconds(50);
  return analogRead(PIN_MUX_SIG);
}

// ========================================
// ENCODERS
// ========================================

volatile long encoderLeftCount = 0;
volatile long encoderRightCount = 0;

void IRAM_ATTR onEncoderLeft() { encoderLeftCount++; }

void IRAM_ATTR onEncoderRight() { encoderRightCount++; }

void encodersInit() {
  pinMode(PIN_ENC_LEFT, INPUT_PULLUP);
  pinMode(PIN_ENC_RIGHT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_LEFT), onEncoderLeft, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_RIGHT), onEncoderRight, RISING);
}

// ========================================
// I2C SCAN
// ========================================

void i2cScan() {
  Serial.println("Scanning I2C bus...");

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);

    if (Wire.endTransmission() == 0) {
      Serial.printf("  Found device at 0x%02X\n", addr);

      if (addr == ADDR_MPU6050)
        mpu6050Present = true;
      if (addr == ADDR_QMC5883P)
        qmc5883Present = true;
      if (addr == ADDR_OLED)
        oledPresent = true;
    }
  }

  Serial.printf("MPU6050 (0x68):  %s\n", mpu6050Present ? "OK" : "MISSING");
  Serial.printf("QMC5883P (0x2C): %s\n", qmc5883Present ? "OK" : "MISSING");
  Serial.printf("OLED (0x3C):     %s\n", oledPresent ? "OK" : "MISSING");
}

// ========================================
// MPU6050
// ========================================

void mpu6050Init() {
  if (!mpu6050Present)
    return;

  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission();
}

bool mpu6050ReadAccel(int16_t &ax, int16_t &ay, int16_t &az) {
  if (!mpu6050Present)
    return false;

  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x3B);

  if (Wire.endTransmission(false) != 0)
    return false;

  Wire.requestFrom((int)ADDR_MPU6050, 6);
  if (Wire.available() < 6)
    return false;

  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();

  return true;
}

long lastAccelMag = 0;

bool detectSuddenMotion() {
  int16_t ax, ay, az;
  if (!mpu6050ReadAccel(ax, ay, az))
    return false;

  long mag = (long)ax * ax + (long)ay * ay + (long)az * az;
  long delta = abs(mag - lastAccelMag);
  lastAccelMag = mag;

  return delta > 200000000L;
}

// ========================================
// QMC5883P
// ========================================

void qmc5883Init() {
  if (!qmc5883Present)
    return;

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x0B);
  Wire.write(0x01);
  Wire.endTransmission();

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x09);
  Wire.write(0x1D);
  Wire.endTransmission();
}

uint8_t qmc5883ReadHeadingByte() {
  if (!qmc5883Present)
    return 127;

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x00);

  if (Wire.endTransmission(false) != 0)
    return 127;

  Wire.requestFrom((int)ADDR_QMC5883P, 6);
  if (Wire.available() < 6)
    return 127;

  int16_t x = Wire.read() | (Wire.read() << 8);
  int16_t y = Wire.read() | (Wire.read() << 8);

  Wire.read();
  Wire.read();

  float headingRad = atan2((float)y, (float)x);
  if (headingRad < 0)
    headingRad += 2 * PI;

  float headingDeg = headingRad * 180.0 / PI;

  return (uint8_t)(headingDeg / 360.0 * 255.0);
}

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Starting Elxie-CQ firmware...");
  Serial.println("Colour Quest game engine enabled.");

  motorsInit();
  sonarInit();
  muxInit();
  encodersInit();

  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BATTERY, INPUT);
  analogReadResolution(12);
  pinMode(PIN_BUZZER, OUTPUT);

  strip.begin();
  strip.clear();
  strip.show();

  // Shared I2C bus for OLED, MPU6050 and QMC5883P.
  Wire.begin(PIN_SDA, PIN_SCL);

  i2cScan();

  mpu6050Init();
  qmc5883Init();
  oledInit();

  randomSeed(esp_random());

  // ========================================
  // BLE / NUS
  // ========================================

  BLEDevice::init(DEVICE_NAME);

  // Request a larger ATT MTU so most JSON messages fit in one or two
  // notifications instead of ~10 tiny 20-byte ones. The actual negotiated
  // size is min(this, whatever the central supports) - Chrome's Web
  // Bluetooth stack generally accepts a large MTU, but this degrades
  // gracefully on centrals that don't.
  BLEDevice::setMTU(247);

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService *service = bleServer->createService(NUS_SERVICE_UUID);

  // ESP32 -> Web App
  bleTxCharacteristic = service->createCharacteristic(
      NUS_CHAR_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);

  bleTxCharacteristic->addDescriptor(new BLE2902());

  // Web App -> ESP32
  bleRxCharacteristic = service->createCharacteristic(
      NUS_CHAR_RX_UUID,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);

  bleRxCharacteristic->setCallbacks(new RxCharacteristicCallbacks());

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();

  advertising->addServiceUUID(NUS_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();

  Serial.println("BLE / NUS started!");
  Serial.print("Device name: ");
  Serial.println(DEVICE_NAME);

  Serial.println("NUS Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
  Serial.println("NUS RX:      6E400002-B5A3-F393-E0A9-E50E24DCCA9E");
  Serial.println("NUS TX:      6E400003-B5A3-F393-E0A9-E50E24DCCA9E");

  challengeShowIdle();
  tone(PIN_BUZZER, 1600, 80);

  Serial.println("Waiting for Web App...");
}

// ========================================
// LOOP
// ========================================

void loop() {
  // Process complete newline-delimited JSON outside the BLE callback.
  if (havePendingLine) {
    noInterrupts();
    String line = pendingLine;
    pendingLine = "";
    havePendingLine = false;
    interrupts();

    handleCommandLine(line);
  }

  // Colour Quest is a non-blocking state machine:
  // SHOWING -> WAIT_INPUT -> FEEDBACK -> next task / finish.
  if (gameState == GS_SHOWING && (long)(millis() - challengeShowUntil) >= 0) {
    challengeBeginAnswerPhase();
  }

  if ((gameState == GS_SHOWING || gameState == GS_WAIT_INPUT) &&
      (long)(millis() - challengeGameDeadline) >= 0) {
    // No answer during the full 10-second task window counts as a failed task.
    challengeAnswerCorrect = false;
    challengeStopOutputs();
    tone(PIN_BUZZER, 500, 250);
    setStripColor(80, 0, 0);
    challengeShowFeedback(false);

    JsonDocument timeout;
    timeout["type"] = "task_result";
    timeout["game"] = "color-quest";
    timeout["level"] = challengeLevel;
    timeout["index"] = challengeTaskIndex;
    timeout["correct"] = false;
    timeout["timeout"] = true;
    timeout["correctCount"] = challengeCorrectCount;
    sendJson(timeout);

    challengeFeedbackUntil = millis() + 700;
    gameState = GS_FEEDBACK;
  }

  if (gameState == GS_FEEDBACK &&
      (long)(millis() - challengeFeedbackUntil) >= 0) {

    challengeTaskIndex++;

    if (challengeTaskIndex >= COLOR_QUEST_TASKS) {
      challengeFinishLevel();
    } else {
      challengeCreateTask();
    }
  }

  if (!deviceConnected && wasDeviceConnected) {
    delay(500);
    BLEDevice::startAdvertising();

    Serial.println("BLE advertising restarted");
    wasDeviceConnected = false;
  }

  if (deviceConnected && !wasDeviceConnected) {
    wasDeviceConnected = true;
  }

  if (deviceConnected && clientReady &&
      millis() - lastTelemetry >= TELEMETRY_INTERVAL) {

    lastTelemetry = millis();

    // Keep existing telemetry functionality.
    sendLiveTelemetry();
  }
  
  updateTouchState();

  // OLED is locally owned: show the happy face whenever no game is active.
  if (gameState == GS_IDLE)
    updateIdleDisplay();

  delay(5);
}