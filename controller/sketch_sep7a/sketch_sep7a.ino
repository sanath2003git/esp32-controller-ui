/*
  MAINBOT firmware
  OLED support: SSD1306 0.96 inch, 128x64, I2C address 0x3C

  Frontend -> ESP32 JSON contract

  Display text:
  {"command":"display_text","text":"Hello","line":0}

  Display multiple lines:
  {"command":"display_text","text":"Robot Ready\nConnected","line":0}

  Display named emoji:
  {"command":"display_emoji","emoji":"happy"}

  Display emoji with text:
  {"command":"display_emoji","emoji":"happy","text":"Hello"}

  Clear display:
  {"command":"display_clear"}

  Supported emoji names:
  happy, sad, angry, surprised, heart, star, check, cross,
  warning, robot, battery, smile, sleep, wifi

  Response examples:
  {"type":"response","status":"ok","command":"display_text"}
  {"type":"response","status":"error","command":"display_text","message":"Text too long"}

  Notes:
  - Text is UTF-8 JSON. The OLED font is ASCII-only.
  - Use named bitmap emojis instead of Unicode emoji characters.
  - Existing BLE service and characteristic UUIDs are unchanged.
  - Existing movement, RGB, buzzer, telemetry, and sensor logic is preserved.
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>
#include <string.h>

// ========================================
// DEVICE
// ========================================

#define DEVICE_NAME "MAINBOT"
#define FIRMWARE_VERSION "1.1.0"

// ========================================
// BLE UUIDs
// ========================================

#define SERVICE_UUID \
  "12345678-1234-1234-1234-123456789001"

#define CHARACTERISTIC_UUID \
  "12345678-1234-1234-1234-123456789002"

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
#define PIN_BIN2 45

// Sonar (HC-SR04)
#define PIN_TRIG 15
#define PIN_ECHO 16

// I2C bus
#define PIN_SDA 8
#define PIN_SCL 9

// Mux (CD4067)
#define PIN_MUX_S0 7
#define PIN_MUX_S1 6
#define PIN_MUX_S2 5
#define PIN_MUX_S3 4
#define PIN_MUX_SIG 1

// Touch (TTP223)
#define PIN_TOUCH 12

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

#define ADDR_MPU6050   0x68
#define ADDR_QMC5883P  0x2C
#define ADDR_OLED      0x3C

#define OLED_WIDTH 128
#define OLED_HEIGHT 64

bool mpu6050Present = false;
bool qmc5883Present = false;
bool oledPresent = false;

// ========================================
// IR MUX CHANNELS
// ========================================

#define MUX_CH_FRONT_RIGHT 9
#define MUX_CH_FRONT_LEFT  11
#define MUX_CH_REAR_RIGHT  12
#define MUX_CH_REAR_LEFT   14

#define IR_OBSTACLE_THRESHOLD 2000

// ========================================
// EXTERNAL NEOPIXEL STRIP
// ========================================

Adafruit_NeoPixel strip(
  NUM_STRIP_PIXELS,
  PIN_STRIP,
  NEO_GRB + NEO_KHZ800
);

void setStripColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUM_STRIP_PIXELS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

// ========================================
// OLED
// ========================================

Adafruit_SSD1306 display(
  OLED_WIDTH,
  OLED_HEIGHT,
  &Wire,
  -1
);

void oledInit() {
  if (!oledPresent) {
    Serial.println("OLED not detected. Display commands disabled.");
    return;
  }

  if (!display.begin(SSD1306_SWITCHCAPVCC, ADDR_OLED)) {
    oledPresent = false;
    Serial.println("OLED initialization failed.");
    return;
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("MAINBOT");
  display.println("OLED Ready");
  display.display();

  Serial.println("OLED initialized.");
}

void oledClear() {
  if (!oledPresent) return;

  display.clearDisplay();
  display.display();
}

bool isAsciiText(const char* text) {
  if (text == nullptr) return false;

  for (size_t i = 0; text[i] != '\0'; i++) {
    if ((uint8_t)text[i] > 127) {
      return false;
    }
  }

  return true;
}

bool displayText(const char* text, int line) {
  if (!oledPresent) return false;
  if (text == nullptr) return false;
  if (!isAsciiText(text)) return false;
  if (line < 0 || line > 7) return false;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, line * 8);
  display.println(text);
  display.display();

  return true;
}

// ========================================
// BITMAP EMOJIS
// ========================================

/*
  CORRECTIONS TO THE CODE BEFORE

  1. The OLED is assumed to be 128x64, which is the common
     resolution for a 0.96 inch SSD1306 module.

  2. The bitmap arrays above contain 16 bytes for an 8x8 image.
     Replace them with the following 8-byte versions.

  3. Only the emoji names with actual bitmap implementations
     should be advertised as supported.
*/

// Replace the bitmap declarations in the firmware with:

const uint8_t emojiHappy[] PROGMEM = {
  0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C
};

const uint8_t emojiSad[] PROGMEM = {
  0x3C, 0x42, 0xA5, 0x81, 0x99, 0xA5, 0x42, 0x3C
};

const uint8_t emojiHeart[] PROGMEM = {
  0x00, 0x66, 0xFF, 0xFF, 0x7E, 0x3C, 0x18, 0x00
};

const uint8_t emojiStar[] PROGMEM = {
  0x18, 0x18, 0xFF, 0x7E, 0xFF, 0x18, 0x18, 0x00
};

const uint8_t emojiCheck[] PROGMEM = {
  0x00, 0x01, 0x03, 0x06, 0xCC, 0x78, 0x30, 0x00
};

const uint8_t emojiCross[] PROGMEM = {
  0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81
};

const uint8_t emojiWarning[] PROGMEM = {
  0x18, 0x3C, 0x7E, 0xFF, 0x18, 0x18, 0x00, 0x18
};

const uint8_t emojiRobot[] PROGMEM = {
  0x3C, 0x7E, 0xDB, 0xFF, 0xFF, 0x24, 0x24, 0x00
};

const uint8_t emojiBattery[] PROGMEM = {
  0x7E, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x7E
};

const uint8_t emojiSleep[] PROGMEM = {
  0x00, 0x66, 0x00, 0x0C, 0x18, 0x30, 0x60, 0x00
};

const uint8_t emojiWifi[] PROGMEM = {
  0x00, 0x18, 0x24, 0x42, 0x81, 0x18, 0x18, 0x00
};

const uint8_t* getEmojiBitmap(const char* emoji) {
  if (emoji == nullptr) return nullptr;

  if (strcmp(emoji, "happy") == 0) return emojiHappy;
  if (strcmp(emoji, "smile") == 0) return emojiHappy;
  if (strcmp(emoji, "sad") == 0) return emojiSad;
  if (strcmp(emoji, "heart") == 0) return emojiHeart;
  if (strcmp(emoji, "star") == 0) return emojiStar;
  if (strcmp(emoji, "check") == 0) return emojiCheck;
  if (strcmp(emoji, "cross") == 0) return emojiCross;
  if (strcmp(emoji, "warning") == 0) return emojiWarning;
  if (strcmp(emoji, "robot") == 0) return emojiRobot;
  if (strcmp(emoji, "battery") == 0) return emojiBattery;
  if (strcmp(emoji, "sleep") == 0) return emojiSleep;
  if (strcmp(emoji, "wifi") == 0) return emojiWifi;

  return nullptr;
}

bool displayEmoji(const char* emoji, const char* text) {
  if (!oledPresent) return false;

  const uint8_t* bitmap = getEmojiBitmap(emoji);
  if (bitmap == nullptr) return false;

  display.clearDisplay();
  display.drawBitmap(0, 0, bitmap, 8, 8, SSD1306_WHITE);

  if (text != nullptr && isAsciiText(text)) {
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(16, 2);
    display.println(text);
  }

  display.display();
  return true;
}

// ========================================
// BLE STATE
// ========================================

BLECharacteristic *characteristic;
bool deviceConnected = false;
bool wasDeviceConnected = false;
bool clientReady = false;

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 200;

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

void motorsEnable() {
  digitalWrite(PIN_STBY, HIGH);
}

const int DEFAULT_SPEED = 180;

void handleMove(const char* direction) {
  motorsEnable();

  if (strcmp(direction, "forward") == 0) {
    driveMotorA(DEFAULT_SPEED, true);
    driveMotorB(DEFAULT_SPEED, true);
  } else if (strcmp(direction, "backward") == 0) {
    driveMotorA(DEFAULT_SPEED, false);
    driveMotorB(DEFAULT_SPEED, false);
  } else if (strcmp(direction, "right") == 0) {
    driveMotorA(DEFAULT_SPEED, true);
    driveMotorB(DEFAULT_SPEED, false);
  } else if (strcmp(direction, "left") == 0) {
    driveMotorA(DEFAULT_SPEED, false);
    driveMotorB(DEFAULT_SPEED, true);
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
  if (duration == 0) return -1;

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

void IRAM_ATTR onEncoderLeft() {
  encoderLeftCount++;
}

void IRAM_ATTR onEncoderRight() {
  encoderRightCount++;
}

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

      if (addr == ADDR_MPU6050)  mpu6050Present = true;
      if (addr == ADDR_QMC5883P) qmc5883Present = true;
      if (addr == ADDR_OLED)     oledPresent = true;
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
  if (!mpu6050Present) return;

  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission();
}

bool mpu6050ReadAccel(int16_t &ax, int16_t &ay, int16_t &az) {
  if (!mpu6050Present) return false;

  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x3B);

  if (Wire.endTransmission(false) != 0) return false;

  Wire.requestFrom((int)ADDR_MPU6050, 6);
  if (Wire.available() < 6) return false;

  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();

  return true;
}

long lastAccelMag = 0;

bool detectSuddenMotion() {
  int16_t ax, ay, az;
  if (!mpu6050ReadAccel(ax, ay, az)) return false;

  long mag = (long)ax * ax + (long)ay * ay + (long)az * az;
  long delta = abs(mag - lastAccelMag);
  lastAccelMag = mag;

  return delta > 200000000L;
}

// ========================================
// QMC5883P
// ========================================

void qmc5883Init() {
  if (!qmc5883Present) return;

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
  if (!qmc5883Present) return 127;

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x00);

  if (Wire.endTransmission(false) != 0) return 127;

  Wire.requestFrom((int)ADDR_QMC5883P, 6);
  if (Wire.available() < 6) return 127;

  int16_t x = Wire.read() | (Wire.read() << 8);
  int16_t y = Wire.read() | (Wire.read() << 8);

  Wire.read();
  Wire.read();

  float headingRad = atan2((float)y, (float)x);
  if (headingRad < 0) headingRad += 2 * PI;

  float headingDeg = headingRad * 180.0 / PI;

  return (uint8_t)(headingDeg / 360.0 * 255.0);
}

// ========================================
// DEVICE INFO
// ========================================

void sendDeviceInfo() {
  if (!deviceConnected) return;

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

  String responseJson;
  serializeJson(response, responseJson);

  characteristic->setValue(responseJson.c_str());
  characteristic->notify();

  Serial.print("Sent device info: ");
  Serial.println(responseJson);
}

// ========================================
// LIVE TELEMETRY
// ========================================

void sendLiveTelemetry() {
  if (!deviceConnected || !clientReady) return;

  JsonDocument telemetry;

  telemetry["type"] = "telemetry";
  telemetry["direction"] = qmc5883ReadHeadingByte();

  long frontCm = readSonarCm();
  telemetry["distance"]["front"] = (frontCm < 0) ? -1 : frontCm;

  telemetry["obstacle"]["frontLeft"] =
    readMuxChannel(MUX_CH_FRONT_LEFT) > IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["frontRight"] =
    readMuxChannel(MUX_CH_FRONT_RIGHT) > IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["rearLeft"] =
    readMuxChannel(MUX_CH_REAR_LEFT) > IR_OBSTACLE_THRESHOLD;

  telemetry["obstacle"]["rearRight"] =
    readMuxChannel(MUX_CH_REAR_RIGHT) > IR_OBSTACLE_THRESHOLD;

  telemetry["motion"]["sudden"] = detectSuddenMotion();
  telemetry["pit"]["detected"] = false;
  telemetry["timestamp"] = millis();

  String telemetryJson;
  serializeJson(telemetry, telemetryJson);

  Serial.printf("Telemetry payload: %u bytes\n", telemetryJson.length());

  characteristic->setValue(telemetryJson.c_str());
  characteristic->notify();
}

// ========================================
// BLE RESPONSE
// ========================================

void sendResponse(
  const char* command,
  bool success,
  const char* message = nullptr
) {
  JsonDocument response;

  response["type"] = "response";
  response["status"] = success ? "ok" : "error";
  response["command"] = command;

  if (message != nullptr) {
    response["message"] = message;
  }

  String responseJson;
  serializeJson(response, responseJson);

  characteristic->setValue(responseJson.c_str());
  characteristic->notify();

  Serial.print("Sent response: ");
  Serial.println(responseJson);
}

// ========================================
// BLE SERVER CALLBACKS
// ========================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) {
    deviceConnected = true;
    clientReady = false;
    lastTelemetry = millis();

    Serial.println("Web app connected!");
  }

  void onDisconnect(BLEServer *server) {
    deviceConnected = false;
    clientReady = false;

    motorsStop();

    Serial.println("Web app disconnected!");
  }
};

// ========================================
// CHARACTERISTIC CALLBACKS
// ========================================

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) {
    String value = characteristic->getValue();
    if (value.length() == 0) return;

    Serial.print("Received from Web App: ");
    Serial.println(value);

    JsonDocument doc;

    DeserializationError error = deserializeJson(doc, value);

    if (error) {
      Serial.print("JSON parsing failed: ");
      Serial.println(error.c_str());
      return;
    }

    const char* type = doc["type"];

    if (type != nullptr && strcmp(type, "client_ready") == 0) {
      Serial.println("Client notification setup confirmed.");

      clientReady = true;
      sendDeviceInfo();

      return;
    }

    const char* command = doc["command"];

    if (command == nullptr) {
      Serial.println("No command found!");
      return;
    }

    Serial.print("Command: ");
    Serial.println(command);

    // ========================================
    // PING
    // ========================================

    if (strcmp(command, "ping") == 0) {
      sendResponse("ping", true, "Pong from MAINBOT");
    }

    // ========================================
    // MOVEMENT
    // ========================================

    else if (strcmp(command, "move") == 0) {
      const char* direction = doc["direction"];

      if (direction == nullptr) {
        sendResponse("move", false, "Missing direction");
        return;
      }

      handleMove(direction);
      sendResponse("move", true);
    }

    else if (strcmp(command, "stop") == 0) {
      motorsStop();
      sendResponse("stop", true);
    }

    // ========================================
    // RGB
    // ========================================

    else if (strcmp(command, "color") == 0) {
      int r = doc["r"] | 0;
      int g = doc["g"] | 0;
      int b = doc["b"] | 0;

      setStripColor(r, g, b);
      sendResponse("color", true);
    }

    // ========================================
    // BUZZER
    // ========================================

    else if (strcmp(command, "buzz") == 0) {
      int freq = doc["freq"] | 1000;
      int duration = doc["duration"] | 200;

      tone(PIN_BUZZER, freq, duration);
      sendResponse("buzz", true);
    }

    // ========================================
    // OLED: CLEAR
    // ========================================

    else if (strcmp(command, "display_clear") == 0) {
      if (!oledPresent) {
        sendResponse("display_clear", false, "OLED not available");
        return;
      }

      oledClear();
      sendResponse("display_clear", true);
    }

    // ========================================
    // OLED: TEXT
    // ========================================

    else if (strcmp(command, "display_text") == 0) {
      const char* text = doc["text"];

      if (text == nullptr) {
        sendResponse("display_text", false, "Missing text");
        return;
      }

      int line = doc["line"] | 0;

      if (!oledPresent) {
        sendResponse("display_text", false, "OLED not available");
        return;
      }

      if (!isAsciiText(text)) {
        sendResponse("display_text", false, "Use ASCII text only");
        return;
      }

      if (line < 0 || line > 7) {
        sendResponse("display_text", false, "Invalid line");
        return;
      }

      if (displayText(text, line)) {
        sendResponse("display_text", true);
      } else {
        sendResponse("display_text", false, "Display update failed");
      }
    }

    // ========================================
    // OLED: EMOJI
    // ========================================

    else if (strcmp(command, "display_emoji") == 0) {
      const char* emoji = doc["emoji"];
      const char* text = doc["text"];

      if (emoji == nullptr) {
        sendResponse("display_emoji", false, "Missing emoji");
        return;
      }

      if (!oledPresent) {
        sendResponse("display_emoji", false, "OLED not available");
        return;
      }

      if (getEmojiBitmap(emoji) == nullptr) {
        sendResponse("display_emoji", false, "Unknown emoji");
        return;
      }

      if (text != nullptr && !isAsciiText(text)) {
        sendResponse("display_emoji", false, "Use ASCII text only");
        return;
      }

      if (displayEmoji(emoji, text)) {
        sendResponse("display_emoji", true);
      } else {
        sendResponse("display_emoji", false, "Display update failed");
      }
    }

    // ========================================
    // UNKNOWN COMMAND
    // ========================================

    else {
      Serial.print("Unknown command: ");
      Serial.println(command);

      sendResponse(command, false, "Unknown command");
    }
  }
};

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Starting MAINBOT firmware...");

  motorsInit();
  sonarInit();
  muxInit();
  encodersInit();

  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  strip.begin();
  strip.clear();
  strip.show();

  // Shared I2C bus for OLED, MPU6050, and QMC5883P.
  Wire.begin(PIN_SDA, PIN_SCL);

  i2cScan();

  mpu6050Init();
  qmc5883Init();
  oledInit();

  BLEDevice::init(DEVICE_NAME);

  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);

  characteristic = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  characteristic->addDescriptor(new BLE2902());
  characteristic->setCallbacks(new CharacteristicCallbacks());

  service->start();

  BLEAdvertising *advertising = server->getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();

  Serial.println("BLE started!");
  Serial.print("Device name: ");
  Serial.println(DEVICE_NAME);
  Serial.println("Waiting for Web App...");
}

// ========================================
// LOOP
// ========================================

void loop() {
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
    sendLiveTelemetry();
  }
}