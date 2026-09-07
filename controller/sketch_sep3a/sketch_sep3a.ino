#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#include <Wire.h>

// ========================================
// DEVICE
// ========================================

#define DEVICE_NAME "MAINBOT"
#define FIRMWARE_VERSION "1.0.0"

// ========================================
// BLE UUIDs (unchanged from test sketch so the
// existing web controller keeps working)
// ========================================

#define SERVICE_UUID \
  "12345678-1234-1234-1234-123456789001"

#define CHARACTERISTIC_UUID \
  "12345678-1234-1234-1234-123456789002"

// ========================================
// PIN MAP — from Elxie_MAINBOT_Pinout.pdf (v3.1 + v1.2 change)
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

// Mux (CD4067, IR bank)
#define PIN_MUX_S0 7
#define PIN_MUX_S1 6
#define PIN_MUX_S2 5
#define PIN_MUX_S3 4
#define PIN_MUX_SIG 1   // shared analog input, ADC1-capable pin

// Touch (TTP223)
#define PIN_TOUCH 12

// Buzzer (passive)
#define PIN_BUZZER 13

// External NeoPixel strip
#define PIN_STRIP 10
#define NUM_STRIP_PIXELS 30

// Encoders
#define PIN_ENC_LEFT 39
#define PIN_ENC_RIGHT 40

// GPIO48 is freed/reserved per v1.2 change — intentionally unused here.

// ========================================
// I2C DEVICE ADDRESSES
// ========================================

#define ADDR_MPU6050   0x68
#define ADDR_QMC5883P  0x2C
#define ADDR_OLED      0x3C

bool mpu6050Present  = false;
bool qmc5883Present   = false;
bool oledPresent      = false;

// ========================================
// IR MUX CHANNELS — corner sensors currently wired
// (product brief calls for 16 channels total; only
// these 4 corner channels are wired today)
// ========================================

#define MUX_CH_FRONT_RIGHT 9
#define MUX_CH_FRONT_LEFT  11
#define MUX_CH_REAR_RIGHT  12
#define MUX_CH_REAR_LEFT   14

// Tune this after bench-testing against your actual floor/obstacle contrast
#define IR_OBSTACLE_THRESHOLD 2000  // 12-bit ADC (0-4095), adjust empirically

// ========================================
// EXTERNAL NEOPIXEL STRIP
// ========================================

Adafruit_NeoPixel strip(NUM_STRIP_PIXELS, PIN_STRIP, NEO_GRB + NEO_KHZ800);

void setStripColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUM_STRIP_PIXELS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b));
  }
  strip.show();
}

// ========================================
// BLE STATE
// ========================================

BLECharacteristic *characteristic;
bool deviceConnected = false;
bool wasDeviceConnected = false;
bool clientReady = false;

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 200; // real sensors can go much faster than the 2s mock

// ========================================
// MOTOR CONTROL (TB6612FNG)
// ========================================

void motorsInit() {
  pinMode(PIN_STBY, OUTPUT);
  pinMode(PIN_AIN1, OUTPUT);
  pinMode(PIN_AIN2, OUTPUT);
  pinMode(PIN_BIN1, OUTPUT);
  pinMode(PIN_BIN2, OUTPUT);
  pinMode(PIN_PWMA, OUTPUT);
  pinMode(PIN_PWMB, OUTPUT);
  digitalWrite(PIN_STBY, LOW); // start disabled
}

// speed: 0-255, dir: true = forward
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
// SONAR (HC-SR04)
// ========================================

void sonarInit() {
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
}

// Returns distance in cm, or -1 on timeout (nothing in range / no echo)
long readSonarCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout (~5m range)
  if (duration == 0) return -1;

  return duration / 58; // standard HC-SR04 conversion
}

// ========================================
// IR MUX (CD4067)
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
  delayMicroseconds(50); // let mux settle
  return analogRead(PIN_MUX_SIG);
}

// ========================================
// ENCODERS
// ========================================

volatile long encoderLeftCount = 0;
volatile long encoderRightCount = 0;

void IRAM_ATTR onEncoderLeft()  { encoderLeftCount++; }
void IRAM_ATTR onEncoderRight() { encoderRightCount++; }

void encodersInit() {
  pinMode(PIN_ENC_LEFT, INPUT_PULLUP);
  pinMode(PIN_ENC_RIGHT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_LEFT), onEncoderLeft, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_RIGHT), onEncoderRight, RISING);
}

// ========================================
// I2C SCAN — proves wiring/address before trusting sensor libs
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
// MPU6050 — minimal register-level driver (no external lib required)
// ========================================

void mpu6050Init() {
  if (!mpu6050Present) return;
  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // wake up
  Wire.endTransmission();
}

// Fills ax, ay, az in raw LSB units (not converted to g)
bool mpu6050ReadAccel(int16_t &ax, int16_t &ay, int16_t &az) {
  if (!mpu6050Present) return false;
  Wire.beginTransmission(ADDR_MPU6050);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)ADDR_MPU6050, 6);
  if (Wire.available() < 6) return false;
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  return true;
}

// Jerk-based sudden-motion flag: compares consecutive accel magnitude samples
long lastAccelMag = 0;
bool detectSuddenMotion() {
  int16_t ax, ay, az;
  if (!mpu6050ReadAccel(ax, ay, az)) return false;
  long mag = (long)ax * ax + (long)ay * ay + (long)az * az; // squared magnitude
  long delta = abs(mag - lastAccelMag);
  lastAccelMag = mag;
  return delta > 200000000L; // tune this threshold on the bench
}

// ========================================
// QMC5883P — compass heading
// NOTE: register map below follows the common QMC58x3-family layout.
// The "P" variant's datasheet should be checked to confirm register
// addresses/scale before trusting heading output.
// ========================================

void qmc5883Init() {
  if (!qmc5883Present) return;
  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x0B); // period/set-reset register (typical for this family)
  Wire.write(0x01);
  Wire.endTransmission();

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x09); // control register 1
  Wire.write(0x1D); // mode=continuous, ODR=200Hz, RNG=8G, OSR=512 (typical)
  Wire.endTransmission();
}

// Returns heading scaled to 0-255 (matches the mock's 0-255 "direction" field)
uint8_t qmc5883ReadHeadingByte() {
  if (!qmc5883Present) return 127;

  Wire.beginTransmission(ADDR_QMC5883P);
  Wire.write(0x00); // data output start register (typical)
  if (Wire.endTransmission(false) != 0) return 127;
  Wire.requestFrom((int)ADDR_QMC5883P, 6);
  if (Wire.available() < 6) return 127;

  int16_t x = Wire.read() | (Wire.read() << 8);
  int16_t y = Wire.read() | (Wire.read() << 8);
  Wire.read(); Wire.read(); // z, unused for heading

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
// LIVE TELEMETRY — replaces the old mock cycle,
// same JSON shape the web controller already expects
// ========================================

void sendLiveTelemetry() {
  if (!deviceConnected || !clientReady) return;

  JsonDocument telemetry;
  telemetry["type"] = "telemetry";

  telemetry["direction"] = qmc5883ReadHeadingByte();

  long frontCm = readSonarCm();
  telemetry["distance"]["front"] = (frontCm < 0) ? -1 : frontCm;

  telemetry["obstacle"]["frontLeft"]  = readMuxChannel(MUX_CH_FRONT_LEFT)  > IR_OBSTACLE_THRESHOLD;
  telemetry["obstacle"]["frontRight"] = readMuxChannel(MUX_CH_FRONT_RIGHT) > IR_OBSTACLE_THRESHOLD;
  telemetry["obstacle"]["rearLeft"]   = readMuxChannel(MUX_CH_REAR_LEFT)   > IR_OBSTACLE_THRESHOLD;
  telemetry["obstacle"]["rearRight"]  = readMuxChannel(MUX_CH_REAR_RIGHT)  > IR_OBSTACLE_THRESHOLD;

  telemetry["motion"]["sudden"] = detectSuddenMotion();

  // Bottom-edge (pit) sensors aren't wired yet per the pinout reference —
  // always false until those channels are assigned.
  telemetry["pit"]["detected"] = false;

  telemetry["timestamp"] = millis();

  String telemetryJson;
  serializeJson(telemetry, telemetryJson);

  // A BLE notification must fit in the negotiated ATT payload (MTU - 3).
  // The web controller only consumes the fields above. Keeping encoder and
  // touch data out of this legacy message prevents the BLE stack from
  // truncating the JSON before it reaches the browser.
  Serial.printf("Telemetry payload: %u bytes\n", telemetryJson.length());

  characteristic->setValue(telemetryJson.c_str());
  characteristic->notify();
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
// CHARACTERISTIC CALLBACKS — command handling
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

    JsonDocument response;

    if (strcmp(command, "ping") == 0) {
      response["type"] = "response";
      response["status"] = "ok";
      response["command"] = "ping";
      response["message"] = "Pong from MAINBOT";
    }
    else if (strcmp(command, "move") == 0) {
      const char* direction = doc["direction"];
      if (direction == nullptr) {
        Serial.println("Move command missing direction!");
        return;
      }
      handleMove(direction);
      response["type"] = "response";
      response["status"] = "ok";
      response["command"] = "move";
      response["direction"] = direction;
    }
    else if (strcmp(command, "stop") == 0) {
      motorsStop();
      response["type"] = "response";
      response["status"] = "ok";
      response["command"] = "stop";
    }
    else if (strcmp(command, "color") == 0) {
      int r = doc["r"] | 0;
      int g = doc["g"] | 0;
      int b = doc["b"] | 0;
      setStripColor(r, g, b);
      response["type"] = "response";
      response["status"] = "ok";
      response["command"] = "color";
      response["r"] = r;
      response["g"] = g;
      response["b"] = b;
    }
    else if (strcmp(command, "buzz") == 0) {
      int freq = doc["freq"] | 1000;
      int duration = doc["duration"] | 200;
      tone(PIN_BUZZER, freq, duration);
      response["type"] = "response";
      response["status"] = "ok";
      response["command"] = "buzz";
    }
    else {
      Serial.print("Unknown command: ");
      Serial.println(command);
      return;
    }

    String responseJson;
    serializeJson(response, responseJson);
    characteristic->setValue(responseJson.c_str());
    characteristic->notify();
    Serial.print("Sent response: ");
    Serial.println(responseJson);
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

  Wire.begin(PIN_SDA, PIN_SCL);
  i2cScan();
  mpu6050Init();
  qmc5883Init();
  // OLED driver intentionally omitted here — add Adafruit_SSD1306 init
  // once you decide what you want displayed on it.

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
