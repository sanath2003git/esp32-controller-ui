/*
  ============================================================
  ELXIE FIRMWARE — MERGED BUILD  (ESP32-S3)
  Combines:
    - BLE (Nordic UART Service) web-app control + Colour Quest
      game engine                                   ["File 1"]
    - ESP-NOW physical remote control with an
      Unlinked / RC / Pet mode state machine         ["File 2"]
  ============================================================

  CONTROL ARBITRATION (as requested):
    - The ESP-NOW remote drives the robot by default (its own
      Unlinked -> RC -> Pet state machine, wandering, petting
      reaction, etc. all run as in file 2).
    - The instant a BLE web-app client connects
      (deviceConnected == true), ESP-NOW input stops being
      acted on. ESP-NOW packets are still received (so the link
      timer stays warm) but are ignored for driving/mode
      purposes; motors and the strip are force-stopped at the
      moment of connection.
    - The instant BLE disconnects, control reverts cleanly to
      the ESP-NOW state machine (it starts again from a fresh
      "just relinked" condition).
    - Only one side ever drives the motors/strip at a time.

  MERGE DECISIONS (as confirmed):
    1. Mux select pins: file 1's mapping (S0=4, S1=5, S2=6, S3=17).
    2. IR sensors: 8 total.
         - 4 "corner" channels (9, 15, 11, 14) — file 1's original
           telemetry sensors. Also reused as ESP-NOW's "side"
           obstacle sensors (same physical sensors).
         - 4 "bottom" channels (10, 8, 12, 13) — new, used ONLY by
           the ESP-NOW state machine for edge/drop safety. They are
           NOT added to the BLE telemetry JSON schema.
    3. Battery: file 1's simple ADC-percentage model
       (raw/4095*100). New addition: a beep alert + a small
       battery icon on the OLED once percentage <= 35%, clearing
       once it rises back to >= 40% (hysteresis so it doesn't
       chatter), repeating every ~60s while low.
    4. Motors: file 1's analogWrite-based driveMotorA/driveMotorB
       primitives throughout. No ledc, no slew-rate ramping —
       ESP-NOW's wander/petting/RC-drive logic has been rewritten
       onto these primitives directly.
    5. Buzzer: file 1's tone()/noTone() throughout. All of file
       2's ledc-based beep effects (petting trill, ask-chirp,
       wander chirp, low-batt jingle) have been re-implemented as
       tone() calls behind a tiny shared "buzzer free at" gate so
       they can't stomp on each other or on Colour Quest's tones.
    6. OLED: file 1's animated happy-face idle screen + Colour
       Quest screens only. File 2's mood-face system is dropped
       entirely. A small low-battery icon is overlaid on whichever
       of those screens is currently showing.
    7. Device name: ELXIE.

  *** PLEASE VERIFY ON FIRST TEST ***
  File 1 documents "Motor A = RIGHT wheel, Motor B = LEFT wheel".
  That mapping is used as ground truth throughout this merge,
  including for the ESP-NOW RC joystick's left/right assignment
  (search "VERIFY" below — two lines). If pushing the physical
  joystick left makes the robot turn right (or vice versa) in RC
  mode, swap those two lines. Nothing else depends on this.

  Also note: BLE and ESP-NOW are run concurrently on the same
  radio (ESP-NOW rides Wi-Fi station mode, BLE rides the
  Bluetooth controller). This is a supported ESP32 coexistence
  pattern for low-rate control traffic like this, but if you
  notice BLE hiccups while the ESP-NOW remote is actively
  streaming packets, that's the radio-sharing trade-off to be
  aware of.
  ============================================================
*/

#include <Adafruit_GFX.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <math.h>
#include <string.h>

// ========================================
// SHARED TYPE DEFINITIONS
// Must appear before any functions so the Arduino
// preprocessor can generate valid prototypes.
// ========================================

struct GameColor {
  const char *name;
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

enum StripRegion { REGION_FRONT, REGION_BACK, REGION_LEFT, REGION_RIGHT };

enum WanderState { WS_CRUISE, WS_BACK, WS_TURN, WS_PAUSE };

// ========================================
// DEVICE
// ========================================

#define DEVICE_NAME "ELXIE"
#define FIRMWARE_VERSION "3.0.0"

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

// Default motor PWM speed (0..255) for BLE "move" commands.
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
// ESP-NOW REMOTE
// ========================================

// NOTE: confirm this matches the remote's ACTUAL printed MAC.
uint8_t REMOTE_MAC[6] = {0x18, 0xfe, 0x34, 0xf5, 0xe8, 0x66};

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
// IR MUX CHANNELS  (8 total)
// ========================================

// Corner sensors used for obstacle telemetry (file 1) AND reused
// as the ESP-NOW "side" obstacle sensors (same physical sensors).
// C1 = corner-front-left  -> CH9
// C2 = corner-front-right -> CH15
// C3 = corner-rear-left   -> CH11
// C4 = corner-rear-right  -> CH14
#define MUX_CH_C1 9
#define MUX_CH_C2 15
#define MUX_CH_C3 11
#define MUX_CH_C4 14
const uint8_t CORNER_CH[4] = {MUX_CH_C1, MUX_CH_C2, MUX_CH_C3, MUX_CH_C4};

// Bottom / drop sensors — new, ESP-NOW mode only (edge safety).
// Not part of the BLE telemetry schema.
const uint8_t BOTTOM_CH[4] = {10, 8, 12, 13}; // FL, FR, RL, RR

#define IR_OBSTACLE_THRESHOLD 4000

// ========================================
// SHARED BUZZER GATE (tone()-based, non-blocking)
// ========================================
// A single "free at" timestamp so Colour Quest tones, BLE "buzz"
// command, and every ESP-NOW ambient effect (petting trill,
// ask-chirp, wander chirp, low-battery jingle) can't stomp on
// each other. tone(pin, freq, duration) is itself non-blocking.

unsigned long buzzerFreeAt = 0;

void playTone(int freq, int durationMs) {
  tone(PIN_BUZZER, freq, durationMs);
  buzzerFreeAt = millis() + durationMs;
}

bool buzzerBusy() { return (long)(millis() - buzzerFreeAt) < 0; }

#define BUZZER_FREQ 2000 // generic chirp tone used by several ESP-NOW effects

// OLED display object — declared here (ahead of its own section) because
// drawBatteryOverlay(), below, needs to reference it, and unlike function
// calls, Arduino does not auto-forward-declare global objects.
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

// ========================================
// EXTERNAL NEOPIXEL STRIP
// ========================================

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
// BATTERY MONITOR  (file 1 percentage model + new low-batt alert)
// ========================================

int readBatteryPercentage() {
  int raw = analogRead(PIN_BATTERY);
  return constrain((raw * 100L) / 4095L, 0, 100);
}

#define BATT_WARN_PCT 35
#define BATT_CLEAR_PCT 40
#define BATT_SAMPLE_MS 2000UL
#define BATT_ALERT_PERIOD_MS 60000UL // re-alert cadence while low

int batteryPercent = 100;
bool batteryLow = false;
unsigned long lastBattSampleMs = 0;
unsigned long lastBattAlertMs = 0;
bool battAlertPlaying = false;
uint8_t battAlertStep = 0;
unsigned long battAlertStepMs = 0;

void serviceBattery() {
  unsigned long now = millis();

  if (now - lastBattSampleMs >= BATT_SAMPLE_MS) {
    lastBattSampleMs = now;
    batteryPercent = readBatteryPercentage();

    if (!batteryLow && batteryPercent <= BATT_WARN_PCT) {
      batteryLow = true;
      lastBattAlertMs = now - BATT_ALERT_PERIOD_MS; // fire promptly
    } else if (batteryLow && batteryPercent >= BATT_CLEAR_PCT) {
      batteryLow = false;
      battAlertPlaying = false;
    }
  }

  if (!batteryLow)
    return;

  // Kick off a new 3-note descending jingle every ~60s, but never
  // interrupt something else already using the buzzer.
  if (!battAlertPlaying && (now - lastBattAlertMs >= BATT_ALERT_PERIOD_MS) &&
      !buzzerBusy()) {
    battAlertPlaying = true;
    battAlertStep = 0;
    battAlertStepMs = now;
  }

  if (battAlertPlaying) {
    if (now - battAlertStepMs >= 150) {
      battAlertStepMs = now;
      const int notes[] = {1400, 1000, 700};
      if (battAlertStep < 3) {
        playTone(notes[battAlertStep], 140);
        battAlertStep++;
      } else {
        battAlertPlaying = false;
        lastBattAlertMs = now;
      }
    }
  }
}

// Small low-battery glyph, top-right corner. Call right before any
// display.display() on a screen that should reflect battery state.
void drawBatteryOverlay() {
  if (!oledPresent || !batteryLow)
    return;
  display.drawRect(112, 1, 14, 7, SSD1306_WHITE);
  display.drawRect(126, 3, 2, 3, SSD1306_WHITE);
  display.fillRect(114, 3, 3, 3, SSD1306_WHITE); // single bar = low
}

// ========================================
// OLED
// ========================================

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

  drawBatteryOverlay();
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

enum ActiveGame {
  GAME_NONE,
  GAME_COLOR_QUEST,
  GAME_REFLEX_DASH
};
ActiveGame currentGame = GAME_NONE;
bool isMoving = false;

enum ReflexDashState { RDS_IDLE, RDS_ACTIVE_GO, RDS_ACTIVE_STOP, RDS_FEEDBACK };
ReflexDashState reflexDashState = RDS_IDLE;
int rdLevel = 0;
int rdPhaseCount = 0;
int rdMaxPhases = 10;
unsigned long rdPhaseEnd = 0;
unsigned long rdReactionWindowEnd = 0;
bool rdPenaltyApplied = false;
unsigned long rdScorePoints = 0;
unsigned long rdMaxPossiblePoints = 0;

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
  drawBatteryOverlay();
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
  display.printf("Score: %d/%d", challengeCorrectCount, COLOR_QUEST_TASKS);
  display.setCursor(8, 56);
  display.println("Next task...");
  drawBatteryOverlay();
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
  if (level % 2 != 0)
    return 5000;
  return 2500;
}

unsigned long challengeAnswerTimeout(int level) {
  if (level % 2 != 0)
    return 5000;
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
// L2: same primary-vs-secondary recognition with a higher presentation
// challenge. L3: one secondary + three primary. Target = the only secondary.
// L4: same secondary-vs-primary recognition with a higher presentation
// challenge. L5: four hue/tint variants. Target = one exact variant. L6: four
// different extended colours. Target = one exact region.
//
// For every level, colorTargetDirection identifies the physical region
// whose displayed colour must be selected by the user.
void challengeBuildTask() {
  static const int PRIMARY[] = {0, 1, 2};   // red, green, blue
  static const int SECONDARY[] = {3, 4, 5}; // yellow, cyan, magenta

  if (challengeLevel <= 4) {
    int targetColor;
    int distractorColors[3];

    if (challengeLevel <= 2) {
      targetColor = PRIMARY[random(3)];
      distractorColors[0] = SECONDARY[0]; // yellow
      distractorColors[1] = SECONDARY[1]; // cyan
      distractorColors[2] = SECONDARY[2]; // magenta
    } else {
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
    drawBatteryOverlay();
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
  currentGame = GAME_COLOR_QUEST;
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

  playTone(1800, 80);
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

  playTone(score >= 0.8f ? 2400 : 900, 150);

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
    drawBatteryOverlay();
    display.display();
  }

  gameState = GS_IDLE;
  challengeLevel = 0;
  currentGame = GAME_NONE;
  challengeShowIdle();
}

void challengeAbort() {
  challengeStopOutputs();
  noTone(PIN_BUZZER);

  gameState = GS_IDLE;
  currentGame = GAME_NONE;
  challengeLevel = 0;
  challengeTaskIndex = 0;
  challengeCorrectCount = 0;

  JsonDocument response;
  response["type"] = "aborted";
  response["game"] = "color-quest";
  sendJson(response);

  challengeShowIdle();
}

// ========================================
// REFLEX DASH GAME ENGINE
// ========================================

void rdStopOutputs() { 
  setStripColor(0, 0, 0); 
}

void rdCreatePhase() {
  unsigned long now = millis();
  rdPenaltyApplied = false;
  
  // Random GO or STOP (simple 50/50 for now)
  bool isGo = random(2) == 0;
  
  if (isGo) {
    reflexDashState = RDS_ACTIVE_GO;
    setStripColor(0, 255, 0); // Green
    rdPhaseEnd = now + random(2000, 5000); // 2-5s GO phase
    if (oledPresent) {
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(2);
      display.setCursor(20, 20);
      display.println("GO!");
      drawBatteryOverlay();
      display.display();
    }
  } else {
    reflexDashState = RDS_ACTIVE_STOP;
    setStripColor(255, 0, 0); // Red
    rdPhaseEnd = now + random(2000, 4000); // 2-4s STOP phase
    // Tighten reaction window based on level (1 = 1000ms, 10 = 300ms)
    long reactionWindow = map(rdLevel, 1, 10, 1000, 300);
    rdReactionWindowEnd = now + reactionWindow;
    if (oledPresent) {
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(2);
      display.setCursor(20, 20);
      display.println("STOP!");
      drawBatteryOverlay();
      display.display();
    }
  }
}

void rdFinishLevel() {
  rdStopOutputs();
  
  float score = 0.0f;
  if (rdMaxPossiblePoints > 0) {
    score = (float)rdScorePoints / (float)rdMaxPossiblePoints;
  }
  
  JsonDocument result;
  result["type"] = "response";
  result["game"] = "reflex-dash";
  result["level"] = rdLevel;
  result["score"] = score;
  sendJson(result);

  playTone(score >= 0.7f ? 2400 : 900, 150);

  if (oledPresent) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.printf("RD L%d COMPLETE", rdLevel);
    display.setTextSize(2);
    display.setCursor(10, 18);
    display.printf("Score:%d%%", (int)(score * 100));
    drawBatteryOverlay();
    display.display();
  }

  reflexDashState = RDS_IDLE;
  currentGame = GAME_NONE;
  rdLevel = 0;
  challengeShowIdle();
}

void rdAbort() {
  rdStopOutputs();
  noTone(PIN_BUZZER);
  
  reflexDashState = RDS_IDLE;
  currentGame = GAME_NONE;
  rdLevel = 0;

  JsonDocument response;
  response["type"] = "aborted";
  response["game"] = "reflex-dash";
  sendJson(response);

  challengeShowIdle();
}

void rdStartLevel(int level) {
  currentGame = GAME_REFLEX_DASH;
  rdLevel = constrain(level, 1, 10);
  rdPhaseCount = 0;
  rdScorePoints = 0;
  rdMaxPossiblePoints = 0;
  rdMaxPhases = 5 + rdLevel; // Scale phases with level

  Serial.printf("Starting Reflex Dash level %d\n", rdLevel);
  playTone(1800, 80);
  rdCreatePhase();
}

void updateReflexDash() {
  unsigned long now = millis();
  
  if (reflexDashState == RDS_ACTIVE_GO) {
    if (isMoving) {
      rdScorePoints++;
    }
    rdMaxPossiblePoints++;
    
    if (now > rdPhaseEnd) {
      rdPhaseCount++;
      if (rdPhaseCount >= rdMaxPhases) {
        rdFinishLevel();
      } else {
        rdCreatePhase();
      }
    }
  } else if (reflexDashState == RDS_ACTIVE_STOP) {
    if (now > rdReactionWindowEnd) { 
      if (isMoving) {
        if (!rdPenaltyApplied) {
          playTone(300, 300); // harsh buzz penalty
          setStripColor(255, 0, 0);
          rdPenaltyApplied = true;
        }
        if (rdScorePoints > 5) rdScorePoints -= 5; // penalty
      }
    }
    
    if (now > rdPhaseEnd) {
      rdPhaseCount++;
      if (rdPhaseCount >= rdMaxPhases) {
        rdFinishLevel();
      } else {
        rdCreatePhase();
      }
    }
  }
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
    playTone(2400, 100);
    setCQStripColor(0, 80, 0);
  } else {
    playTone(500, 250);
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

extern bool petting;
uint8_t lastBleColorR = 0, lastBleColorG = 0, lastBleColorB = 0;

void handleCommandLine(const String &line) {
  // If a BLE command comes in while petting, stop petting immediately
  if (petting) {
    petting = false;
    motorsStop();
    noTone(PIN_BUZZER);
  }

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

    if (strcmp(game, "color-quest") == 0) {
      int level = doc["level"] | 0;
      challengeStartLevel(level);
    } else if (strcmp(game, "reflex-dash") == 0) {
      int level = doc["level"] | 0;
      rdStartLevel(level);
    } else {
      sendError("unsupported game");
    }
    return;
  }

  if (strcmp(command, "input") == 0) {
    if (currentGame == GAME_COLOR_QUEST) {
      handleChallengeInput(doc);
    }
    return;
  }

  if (strcmp(command, "abort") == 0) {
    if (currentGame == GAME_COLOR_QUEST) {
      challengeAbort();
    } else if (currentGame == GAME_REFLEX_DASH) {
      rdAbort();
    }
    return;
  }

  // ========================================
  // EXISTING COMMANDS
  // ========================================

  if (strcmp(command, "ping") == 0) {
    sendResponse("ping", true, "Pong from ELXIE");
  }
  else if (strcmp(command, "led") == 0) {
    const char* hex = doc["color"] | "#000000";
    if (hex[0] == '#') hex++;
    long rgb = strtol(hex, NULL, 16);
    int r = (rgb >> 16) & 0xFF;
    int g = (rgb >> 8) & 0xFF;
    int b = rgb & 0xFF;
    
    lastBleColorR = r;
    lastBleColorG = g;
    lastBleColorB = b;

    setStripColor(r, g, b);
    sendResponse("led", true);
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
    
    lastBleColorR = r;
    lastBleColorG = g;
    lastBleColorB = b;

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

    playTone(freq, duration);
    sendResponse("buzz", true);
  }

  else {
    sendResponse(command, false, "Unknown command");
  }
}

// ========================================
// ESP-NOW MODE STATE MACHINE  (Unlinked / RC / Pet)
// Only acted on while deviceConnected == false.
// ========================================

typedef struct __attribute__((packed)) {
  int16_t x;
  int16_t y;
  uint8_t btn1;
  uint8_t btn2;
  uint8_t sw;
} CommandPacket;

typedef struct __attribute__((packed)) {
  uint8_t alert;
} FeedbackPacket;

CommandPacket lastCmd = {0, 0, 0, 0, 0};
volatile unsigned long lastRxMs = 0;
volatile bool haveCmd = false;
portMUX_TYPE cmdMux = portMUX_INITIALIZER_UNLOCKED;

#define ALERT_OK 0
#define ALERT_OBSTACLE 1
#define ALERT_DROP 2

#define X_CENTER 512
#define Y_CENTER 512
#define DEADZONE 150
#define SWAP_AXES 1
#define INVERT_FWD 1
#define INVERT_TURN 0
#define DRIVE_CAP 200

#define SONAR_MIN_CM 20
#define SONAR_REVERSE_PWM 150

enum Mode { MODE_UNLINKED, MODE_RC, MODE_PET };
Mode curMode = MODE_UNLINKED;

#define LINK_TIMEOUT_MS 500    // no packet -> unlinked
#define PET_TIMEOUT_MS 60000UL // remote idle 60s -> Pet mode
#define PET_SLEEP_MS 30000UL   // idle this long *within* Pet -> sleep

unsigned long lastActivityMs = 0;
bool prevLinked = false;
bool prevBtn1 = false, prevBtn2 = false, prevSw = false;
uint8_t stripColorIdx = 0;
bool headlight = false;
int lastDistCmEspNow = 999;

// ---- Petting reaction (ESP-NOW mode only; independent of the BLE
//      tap/hold touch detector, which keeps running for BLE telemetry) ----
#define PET_HOLD_MS 150
#define PET_DUR_MS 1500
#define PET_WOBBLE_PWM 90
#define PET_WOBBLE_MS 180
bool petting = false;
unsigned long petStartMs = 0;
unsigned long petTouchSinceMs = 0;
bool prevPetTouch = false;
unsigned long petWobbleMs = 0;
bool petWobbleDir = false;
uint8_t petColorStep = 0;
unsigned long petColorMs = 0;
uint8_t petTrillStep = 0;
unsigned long petTrillMs = 0;

// ---- Pet-mode "ask for a pet" idle wiggle ----
unsigned long petAskNextMs = 0;
unsigned long petAskStartMs = 0;
bool petAsking = false;
bool petAskDir = false;
unsigned long petAskFlipMs = 0;
#define PET_ASK_MIN_GAP 6000UL
#define PET_ASK_MAX_GAP 12000UL
#define PET_ASK_DUR_MS 700
#define PET_ASK_PWM 80
#define PET_ASK_FLIP_MS 160

// ---- Wander (roaming Pet behaviour, floor) ----
WanderState wState = WS_CRUISE;
unsigned long wStateMs = 0;
unsigned long wStateDur = 0;
int wTurnDir = 1;
unsigned long wNextChirpMs = 0;
unsigned long wNextPauseMs = 0;

#define WANDER_CRUISE_PWM 95
#define WANDER_BACK_PWM 90
#define WANDER_TURN_PWM 100
#define WANDER_BACK_MS 450
#define WANDER_TURN_MIN_MS 350
#define WANDER_TURN_MAX_MS 900
#define WANDER_PAUSE_MIN_MS 800
#define WANDER_PAUSE_MAX_MS 1800
#define WANDER_CHIRP_MIN_GAP 3000UL
#define WANDER_CHIRP_MAX_GAP 7000UL
#define WANDER_PAUSE_MIN_GAP 8000UL
#define WANDER_PAUSE_MAX_GAP 16000UL

// ---- Low-level signed-speed adapters onto file 1's motor primitives ----
// Motor A = RIGHT wheel, Motor B = LEFT wheel (per file 1's documented
// wiring). See the "VERIFY" note in the header comment.
void driveASigned(int spd) {
  spd = constrain(spd, -255, 255);
  motorsEnable();
  driveMotorA(abs(spd), spd >= 0);
}
void driveBSigned(int spd) {
  spd = constrain(spd, -255, 255);
  motorsEnable();
  driveMotorB(abs(spd), spd >= 0);
}

// ========================================
// ESP-NOW callbacks
// ========================================

void onEspNowRecv(const esp_now_recv_info_t *info, const uint8_t *data,
                  int len) {
  for (int i = 0; i < 6; i++)
    if (info->src_addr[i] != REMOTE_MAC[i])
      return;
  if (len != sizeof(CommandPacket))
    return;
  portENTER_CRITICAL(&cmdMux);
  memcpy(&lastCmd, data, sizeof(lastCmd));
  lastRxMs = millis();
  haveCmd = true;
  portEXIT_CRITICAL(&cmdMux);
}

void sendEspNowFeedback(uint8_t alert) {
  FeedbackPacket fb = {alert};
  esp_now_send(REMOTE_MAC, (uint8_t *)&fb, sizeof(fb));
}

// ========================================
// ESP-NOW strip helpers (reuse file 1's `strip` object / setStripColor)
// ========================================

void applyEspNowStripState() {
  if (headlight) {
    setStripColor(255, 255, 255);
    return;
  }
  switch (stripColorIdx % 4) {
  case 0:
    setStripColor(0, 0, 0);
    break;
  case 1:
    setStripColor(255, 0, 0);
    break;
  case 2:
    setStripColor(0, 255, 0);
    break;
  case 3:
    setStripColor(0, 0, 255);
    break;
  }
}

void espNowStripBlink(uint8_t r, uint8_t g, uint8_t b, int times, int onMs,
                      int offMs) {
  for (int i = 0; i < times; i++) {
    setStripColor(r, g, b);
    delay(onMs);
    setStripColor(0, 0, 0);
    delay(offMs);
  }
}

// Ambient "not linked" chaser — needs individual pixel addressing, so it
// talks to the shared `strip` object directly rather than via setStripColor.
void espNowStripChaserStep() {
  static uint8_t pos = 0;
  static unsigned long last = 0;
  if (millis() - last < 80)
    return;
  last = millis();
  strip.clear();
  strip.setPixelColor(pos, strip.Color(0, 80, 255));
  strip.setPixelColor((pos + NUM_STRIP_PIXELS - 1) % NUM_STRIP_PIXELS,
                      strip.Color(0, 20, 60));
  strip.show();
  pos = (pos + 1) % NUM_STRIP_PIXELS;
}

void espNowPetColor(uint8_t i) {
  switch (i % 5) {
  case 0:
    setStripColor(255, 150, 200);
    break;
  case 1:
    setStripColor(150, 220, 255);
    break;
  case 2:
    setStripColor(200, 255, 170);
    break;
  case 3:
    setStripColor(255, 220, 150);
    break;
  default:
    setStripColor(210, 170, 255);
    break;
  }
}

void espNowBreatheStep() {
  static unsigned long last = 0;
  if (millis() - last < 40)
    return;
  last = millis();
  float t = (millis() % 4000) / 4000.0f;
  float b = 0.15f + 0.25f * (0.5f * (1 - cos(2 * PI * t)));
  uint8_t r = (uint8_t)(120 * b);
  uint8_t g = (uint8_t)(180 * b);
  uint8_t bl = (uint8_t)(255 * b);
  setStripColor(r, g, bl);
}

// ========================================
// ESP-NOW petting reaction
// ========================================

void espNowStartPetting() {
  petting = true;
  petStartMs = millis();
  petWobbleMs = millis();
  petWobbleDir = false;
  petColorStep = 0;
  petColorMs = millis();
  petTrillStep = 0;
  petTrillMs = millis();
}

bool espNowServicePetting() {
  unsigned long now = millis();
  if (now - petStartMs >= PET_DUR_MS) {
    petting = false;
    motorsStop();
    noTone(PIN_BUZZER);
    if (deviceConnected) {
      setStripColor(lastBleColorR, lastBleColorG, lastBleColorB);
    } else {
      applyEspNowStripState();
    }
    return false;
  }
  if (now - petWobbleMs >= PET_WOBBLE_MS) {
    petWobbleMs = now;
    petWobbleDir = !petWobbleDir;
    if (petWobbleDir) {
      driveASigned(+PET_WOBBLE_PWM);
      driveBSigned(-PET_WOBBLE_PWM);
    } else {
      driveASigned(-PET_WOBBLE_PWM);
      driveBSigned(+PET_WOBBLE_PWM);
    }
  }
  if (now - petColorMs >= 120) {
    petColorMs = now;
    espNowPetColor(petColorStep++);
  }
  if (now - petTrillMs >= 90 && !buzzerBusy()) {
    petTrillMs = now;
    const int notes[] = {1200, 1600, 2100, 0};
    int f = notes[petTrillStep % 4];
    if (f > 0)
      playTone(f, 90);
    else
      noTone(PIN_BUZZER);
    petTrillStep++;
  }
  return true;
}

// ========================================
// ESP-NOW "ask for a pet" idle wiggle
// ========================================

void espNowScheduleNextPetAsk() {
  unsigned long gap = PET_ASK_MIN_GAP +
                      (unsigned long)random(PET_ASK_MAX_GAP - PET_ASK_MIN_GAP);
  petAskNextMs = millis() + gap;
}
void espNowStartPetAsk() {
  petAsking = true;
  petAskStartMs = millis();
  petAskFlipMs = millis();
  petAskDir = false;
  if (!buzzerBusy())
    playTone(BUZZER_FREQ, 50);
}
bool espNowServicePetAsk(bool safeToMove) {
  unsigned long now = millis();
  if (!safeToMove) {
    if (petAsking) {
      petAsking = false;
      motorsStop();
      espNowScheduleNextPetAsk();
    }
    return false;
  }
  if (!petAsking)
    return false;
  if (now - petAskStartMs >= PET_ASK_DUR_MS) {
    petAsking = false;
    motorsStop();
    espNowScheduleNextPetAsk();
    return false;
  }
  if (now - petAskFlipMs >= PET_ASK_FLIP_MS) {
    petAskFlipMs = now;
    petAskDir = !petAskDir;
    if (petAskDir) {
      driveASigned(+PET_ASK_PWM);
      driveBSigned(-PET_ASK_PWM);
    } else {
      driveASigned(-PET_ASK_PWM);
      driveBSigned(+PET_ASK_PWM);
    }
  }
  return true;
}

// ========================================
// ESP-NOW wander behaviour (roaming Pet mode, floor)
// ========================================

void espNowWanderChirp() {
  if (!buzzerBusy())
    playTone(BUZZER_FREQ, 70);
}
void espNowScheduleWanderChirp() {
  wNextChirpMs =
      millis() + WANDER_CHIRP_MIN_GAP +
      (unsigned long)random(WANDER_CHIRP_MAX_GAP - WANDER_CHIRP_MIN_GAP);
}
void espNowScheduleWanderPause() {
  wNextPauseMs =
      millis() + WANDER_PAUSE_MIN_GAP +
      (unsigned long)random(WANDER_PAUSE_MAX_GAP - WANDER_PAUSE_MIN_GAP);
}
void espNowEnterWanderState(WanderState s, unsigned long dur) {
  wState = s;
  wStateMs = millis();
  wStateDur = dur;
}
void espNowWanderInit() {
  espNowEnterWanderState(WS_CRUISE, 0);
  espNowScheduleWanderChirp();
  espNowScheduleWanderPause();
}

void espNowServiceWander(bool blocked, bool edge) {
  unsigned long now = millis();

  if (now >= wNextChirpMs) {
    espNowWanderChirp();
    espNowScheduleWanderChirp();
  }

  if ((edge || blocked) && wState == WS_CRUISE) {
    motorsStop();
    wTurnDir = (random(2) == 0) ? 1 : -1;
    espNowEnterWanderState(WS_BACK, WANDER_BACK_MS);
    return;
  }

  switch (wState) {
  case WS_CRUISE: {
    if (now >= wNextPauseMs) {
      motorsStop();
      espNowEnterWanderState(
          WS_PAUSE, WANDER_PAUSE_MIN_MS +
                        random(WANDER_PAUSE_MAX_MS - WANDER_PAUSE_MIN_MS));
      espNowScheduleWanderPause();
      break;
    }
    driveASigned(WANDER_CRUISE_PWM);
    driveBSigned(WANDER_CRUISE_PWM);
    break;
  }
  case WS_BACK: {
    if (edge) {
      motorsStop();
      espNowEnterWanderState(
          WS_TURN,
          WANDER_TURN_MIN_MS + random(WANDER_TURN_MAX_MS - WANDER_TURN_MIN_MS));
      break;
    }
    driveASigned(-WANDER_BACK_PWM);
    driveBSigned(-WANDER_BACK_PWM);
    if (now - wStateMs >= wStateDur) {
      motorsStop();
      espNowEnterWanderState(
          WS_TURN,
          WANDER_TURN_MIN_MS + random(WANDER_TURN_MAX_MS - WANDER_TURN_MIN_MS));
    }
    break;
  }
  case WS_TURN: {
    driveASigned(WANDER_TURN_PWM * wTurnDir);
    driveBSigned(-WANDER_TURN_PWM * wTurnDir);
    if (now - wStateMs >= wStateDur) {
      motorsStop();
      espNowEnterWanderState(WS_CRUISE, 0);
    }
    break;
  }
  case WS_PAUSE:
  default: {
    motorsStop();
    if (now - wStateMs >= wStateDur) {
      espNowEnterWanderState(WS_CRUISE, 0);
    }
    break;
  }
  }
}

// ========================================
// ESP-NOW mode machine — the main per-loop function.
// Only called while deviceConnected == false.
// ========================================

void runEspNowControl() {
  CommandPacket cmd;
  unsigned long rxMs;
  bool have;
  portENTER_CRITICAL(&cmdMux);
  memcpy(&cmd, &lastCmd, sizeof(cmd));
  rxMs = lastRxMs;
  have = haveCmd;
  portEXIT_CRITICAL(&cmdMux);

  bool linkAlive = have && (millis() - rxMs < LINK_TIMEOUT_MS);

  // ---- NOT LINKED ----
  if (!linkAlive) {
    curMode = MODE_UNLINKED;
    motorsStop();
    espNowStripChaserStep();
    prevLinked = false;
    prevBtn1 = prevBtn2 = prevSw = false;
    if (petting) {
      petting = false;
      noTone(PIN_BUZZER);
    }
    if (petAsking)
      petAsking = false;
    prevPetTouch = false;
    return;
  }

  // Just (re)linked — green blink, seed activity so we begin in RC.
  if (!prevLinked) {
    espNowStripBlink(0, 255, 0, 2, 120, 120);
    applyEspNowStripState();
    prevLinked = true;
    lastActivityMs = millis();
    espNowScheduleNextPetAsk();
  }

  // ---- sensors (side/corner + bottom drop) ----
  int sideVal[4], botVal[4];
  int dropCount = 0;
  bool obstacle = false;
  for (int i = 0; i < 4; i++) {
    botVal[i] = readMuxChannel(BOTTOM_CH[i]);
    if (botVal[i] > IR_OBSTACLE_THRESHOLD)
      dropCount++;
  }
  for (int i = 0; i < 4; i++) {
    sideVal[i] = readMuxChannel(CORNER_CH[i]);
    if (sideVal[i] < IR_OBSTACLE_THRESHOLD)
      obstacle = true;
  }

  long frontCm = readSonarCm();
  lastDistCmEspNow = (frontCm < 0) ? 999 : (int)frontCm;
  bool tooClose = (frontCm > 0 && frontCm < SONAR_MIN_CM);
  bool allDrop = (dropCount == 4);

  static unsigned long lastDbg = 0;
  if (millis() - lastDbg > 300) {
    lastDbg = millis();
    const char *mstr = (curMode == MODE_RC)    ? "RC"
                       : (curMode == MODE_PET) ? "PET"
                                               : "UNLINKED";
    Serial.printf("[%s] SIDE %4d %4d %4d %4d | BOT %4d %4d %4d %4d | "
                  "drop=%d obst=%d dist=%dcm idle=%lums | batt=%d%%%s\n",
                  mstr, sideVal[0], sideVal[1], sideVal[2], sideVal[3],
                  botVal[0], botVal[1], botVal[2], botVal[3], dropCount,
                  obstacle, lastDistCmEspNow, millis() - lastActivityMs,
                  batteryPercent, batteryLow ? " LOW" : "");
  }

  // ---- detect real remote activity (stick or button edges) ----
  int dxRaw = cmd.x - X_CENTER;
  int dyRaw = cmd.y - Y_CENTER;
  bool stickIdle = (abs(dxRaw) < DEADZONE && abs(dyRaw) < DEADZONE);

  bool b1 = cmd.btn1, b2 = cmd.btn2, s = cmd.sw;
  bool btnEdge = (b1 && !prevBtn1) || (b2 && !prevBtn2) || (s && !prevSw);

  bool activeNow = (!stickIdle) || btnEdge;
  if (activeNow)
    lastActivityMs = millis();

  // ---- button actions (edge-triggered) — work in BOTH RC and Pet ----
  if (b1 && !prevBtn1 && !buzzerBusy())
    playTone(BUZZER_FREQ, 60);
  prevBtn1 = b1;
  if (b2 && !prevBtn2) {
    stripColorIdx++;
    applyEspNowStripState();
  }
  prevBtn2 = b2;
  if (s && !prevSw) {
    headlight = !headlight;
    applyEspNowStripState();
  }
  prevSw = s;

  // ---- mode from inactivity timer ----
  Mode prevMode = curMode;
  if (millis() - lastActivityMs < PET_TIMEOUT_MS)
    curMode = MODE_RC;
  else
    curMode = MODE_PET;

  if (curMode != prevMode) {
    if (curMode == MODE_PET) {
      espNowWanderInit();
      applyEspNowStripState();
    } else {
      petAsking = false;
      motorsStop();
      applyEspNowStripState();
    }
  }

  // ---- alert byte (drop highest) ----
  uint8_t alert = ALERT_OK;
  if (allDrop)
    alert = ALERT_DROP;
  else if (tooClose || obstacle)
    alert = ALERT_OBSTACLE;

  // ---- touch / petting (ESP-NOW mode only) ----
  bool touch = (digitalRead(PIN_TOUCH) == HIGH);
  if (touch && !prevPetTouch)
    petTouchSinceMs = millis();
  prevPetTouch = touch;
  if (!petting && touch && stickIdle && !allDrop && !tooClose &&
      (millis() - petTouchSinceMs >= PET_HOLD_MS)) {
    espNowStartPetting();
    petAsking = false;
  }

  // ============================================================
  //  BEHAVIOUR BY MODE
  // ============================================================
  if (petting) {
    if (allDrop || !stickIdle) {
      petting = false;
      motorsStop();
      noTone(PIN_BUZZER);
      applyEspNowStripState();
    } else {
      espNowServicePetting();
    }

  } else if (curMode == MODE_PET) {
    bool asleep = (millis() - lastActivityMs) > (PET_TIMEOUT_MS + PET_SLEEP_MS);

    if (allDrop) {
      motorsStop();
    } else if (asleep) {
      motorsStop();
      espNowBreatheStep();
    } else {
      bool edge = (dropCount > 0);
      bool blocked = tooClose || obstacle;
      espNowServiceWander(blocked, edge);
      espNowBreatheStep();
      // occasional "ask for a pet" wiggle while cruising and safe
      if (!espNowServicePetAsk(!edge && !blocked) && wState == WS_CRUISE &&
          millis() >= petAskNextMs && !edge && !blocked) {
        espNowStartPetAsk();
      }
    }

  } else {
    // ---- RC MODE — live joystick drive ----
    if (allDrop) {
      motorsStop();
    } else {
      int dx = cmd.x - X_CENTER;
      int dy = cmd.y - Y_CENTER;
      if (abs(dx) < DEADZONE)
        dx = 0;
      if (abs(dy) < DEADZONE)
        dy = 0;

      int fwdAxis, turnAxis;
      if (SWAP_AXES) {
        fwdAxis = dx;
        turnAxis = dy;
      } else {
        fwdAxis = dy;
        turnAxis = dx;
      }

      int fwd = (INVERT_FWD ? +fwdAxis : -fwdAxis);
      int turn = (INVERT_TURN ? -turnAxis : +turnAxis);

      fwd = map(fwd, -512, 512, -DRIVE_CAP, DRIVE_CAP);
      turn = map(turn, -512, 512, -DRIVE_CAP, DRIVE_CAP);

      int left = fwd + turn;
      int right = fwd - turn;

      int peak = max(abs(left), abs(right));
      if (peak > DRIVE_CAP) {
        left = (left * DRIVE_CAP) / peak;
        right = (right * DRIVE_CAP) / peak;
      }

      if (tooClose) {
        int backSpeed = -SONAR_REVERSE_PWM;
        int bl = backSpeed + (turn / 2);
        int br = backSpeed - (turn / 2);
        driveASigned(br); // Motor A = right wheel  <-- VERIFY on first test
        driveBSigned(bl); // Motor B = left wheel   <-- VERIFY on first test
      } else {
        driveASigned(right); // Motor A = right wheel  <-- VERIFY on first test
        driveBSigned(left);  // Motor B = left wheel   <-- VERIFY on first test
      }
    }
  }

  // ---- feedback to remote (on change + slow keep-alive) ----
  static uint8_t prevAlertSent = 0xFF;
  static unsigned long lastAlertSent = 0;
  if (alert != prevAlertSent || millis() - lastAlertSent > 1000) {
    sendEspNowFeedback(alert);
    prevAlertSent = alert;
    lastAlertSent = millis();
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

    // BLE takes over immediately: force-stop anything ESP-NOW was doing.
    motorsStop();
    setStripColor(0, 0, 0);
    noTone(PIN_BUZZER);
    petting = false;
    petAsking = false;
    curMode = MODE_UNLINKED;

    Serial.println("Web app connected! BLE now has control.");
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

    // Hand control back to ESP-NOW from a clean, fresh state.
    prevLinked = false;
    lastActivityMs = millis();
    curMode = MODE_UNLINKED;
    petting = false;
    petAsking = false;

    Serial.println("Web app disconnected! ESP-NOW control resumes.");
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
// TOUCH SENSOR LOGIC (always runs; feeds BLE telemetry)
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
    holdTriggered =
        true; // prevent re-triggering constantly if we only want one hold event
  }
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
// LIVE TELEMETRY (BLE)
// ========================================

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
  isMoving = false;
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
  isMoving = true;

  if (strcmp(direction, "forward") == 0 || strcmp(direction, "front") == 0) {
    motorsEnable();
    driveMotorA(speed, true); // right wheel forward
    driveMotorB(speed, true); // left wheel forward

  } else if (strcmp(direction, "backward") == 0 ||
             strcmp(direction, "back") == 0) {
    motorsEnable();
    driveMotorA(speed, false); // right wheel backward
    driveMotorB(speed, false); // left wheel backward

  } else if (strcmp(direction, "right") == 0) {
    motorsEnable();
    driveMotorA(0, true);     // right wheel idle
    driveMotorB(speed, true); // left wheel forward

  } else if (strcmp(direction, "left") == 0) {
    motorsEnable();
    driveMotorA(speed, true); // right wheel forward
    driveMotorB(0, true);     // left wheel idle

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
  Serial.println("Starting ELXIE merged firmware...");
  Serial.println("BLE + Colour Quest, and ESP-NOW Pet/RC mode.");

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
  // ESP-NOW / REMOTE
  // ========================================

  WiFi.mode(WIFI_STA);
  delay(200);
  Serial.print("My MAC (for pairing the remote): ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init FAILED — rebooting in 2s");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, REMOTE_MAC, 6);
  peer.channel = 0;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK)
    Serial.println("add_peer failed (feedback to remote may not send)");

  lastActivityMs = millis();
  espNowScheduleNextPetAsk();
  applyEspNowStripState();

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

  batteryPercent = readBatteryPercentage();
  batteryLow = (batteryPercent <= BATT_WARN_PCT);

  challengeShowIdle();
  playTone(1600, 80);

  Serial.println("Waiting for Web App (BLE) or remote (ESP-NOW)...");
}

// ========================================
// LOOP
// ========================================

void updateColorQuest() {
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
    playTone(500, 250);
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
}

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

  // Game Routing
  if (currentGame == GAME_COLOR_QUEST) {
    updateColorQuest();
  } else if (currentGame == GAME_REFLEX_DASH) {
    updateReflexDash();
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

  // OLED is locally owned: show the happy face whenever no game is active,
  // regardless of whether BLE or ESP-NOW currently has control.
  if (gameState == GS_IDLE)
    updateIdleDisplay();

  // Low-battery watch runs regardless of who has control.
  serviceBattery();

  // ---- Control arbitration ----
  // ESP-NOW packets keep arriving in the background (onEspNowRecv) either
  // way, so the link timer stays warm; they're just not acted on for
  // driving/mode purposes while BLE is connected.
  if (!deviceConnected) {
    runEspNowControl();
  } else {
    // When BLE is connected, still allow the petting reaction if touched
    bool touch = (digitalRead(PIN_TOUCH) == HIGH);
    static bool prevBleTouch = false;
    static unsigned long bleTouchSince = 0;
    
    if (touch && !prevBleTouch) bleTouchSince = millis();
    prevBleTouch = touch;
    
    // Trigger petting if touched for PET_HOLD_MS (150ms) and no game is active
    if (!petting && touch && gameState == GS_IDLE && (millis() - bleTouchSince >= 150)) {
        espNowStartPetting();
    }
    
    if (petting) {
        espNowServicePetting();
    }
  }

  delay(5);
}
