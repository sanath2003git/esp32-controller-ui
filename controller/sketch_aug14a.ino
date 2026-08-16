#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>


// ========================================
// DEVICE
// ========================================

#define DEVICE_NAME "Robot-Test"
#define FIRMWARE_VERSION "0.1.0"


// ========================================
// BLE UUIDs
// ========================================

#define SERVICE_UUID \
  "12345678-1234-1234-1234-123456789001"

#define CHARACTERISTIC_UUID \
  "12345678-1234-1234-1234-123456789002"


// ========================================
// RGB LED
// ========================================

#define RGB_PIN 48
#define NUM_PIXELS 1

Adafruit_NeoPixel pixel(
  NUM_PIXELS,
  RGB_PIN,
  NEO_GRB + NEO_KHZ800
);

void setRobotTestColor(
  uint8_t r,
  uint8_t g,
  uint8_t b
) {
  pixel.setPixelColor(
    0,
    pixel.Color(r, g, b)
  );

  pixel.show();
}


// ========================================
// BLE
// ========================================

BLECharacteristic *characteristic;

bool deviceConnected = false;
bool wasDeviceConnected = false;

// Becomes true after the Web App enables notifications
// and sends the client_ready message.
bool clientReady = false;


// ========================================
// MOCK TELEMETRY
// ========================================

unsigned long lastTelemetry = 0;

const unsigned long TELEMETRY_INTERVAL = 2000;

int mockTelemetryIndex = 0;


// ========================================
// DEVICE INFO
// ========================================

void sendDeviceInfo() {

  if (!deviceConnected) {
    return;
  }

  String macAddress =
    BLEDevice::getAddress().toString().c_str();

  macAddress.toUpperCase();
  macAddress.replace(":", "");

  JsonDocument response;

  response["type"] = "device_info";
  response["deviceId"] = macAddress;
  response["name"] = DEVICE_NAME;
  response["model"] = "ESP32-S3 N16R8";
  response["firmware"] = FIRMWARE_VERSION;

  String responseJson;

  serializeJson(
    response,
    responseJson
  );

  characteristic->setValue(
    responseJson.c_str()
  );

  characteristic->notify();

  Serial.print(
    "Sent device info: "
  );

  Serial.println(
    responseJson
  );
}


// ========================================
// MOCK TELEMETRY
// ========================================

void sendMockTelemetry() {

  if (!deviceConnected || !clientReady) {
    return;
  }

  JsonDocument telemetry;


  // ======================================
  // TELEMETRY TYPE
  // ======================================

  telemetry["type"] = "telemetry";


  // ======================================
  // STATE 1
  // ======================================

  if (mockTelemetryIndex == 0) {

    telemetry["direction"] = 127;

    telemetry["distance"]["front"] = 42;

    telemetry["obstacle"]["frontLeft"] = false;
    telemetry["obstacle"]["frontRight"] = false;
    telemetry["obstacle"]["rearLeft"] = false;
    telemetry["obstacle"]["rearRight"] = false;

    telemetry["motion"]["sudden"] = false;

    telemetry["pit"]["detected"] = false;
  }


  // ======================================
  // STATE 2
  // ======================================

  else if (mockTelemetryIndex == 1) {

    telemetry["direction"] = 130;

    telemetry["distance"]["front"] = 39;

    telemetry["obstacle"]["frontLeft"] = false;
    telemetry["obstacle"]["frontRight"] = false;
    telemetry["obstacle"]["rearLeft"] = true;
    telemetry["obstacle"]["rearRight"] = false;

    telemetry["motion"]["sudden"] = false;

    telemetry["pit"]["detected"] = false;
  }


  // ======================================
  // STATE 3
  // ======================================

  else if (mockTelemetryIndex == 2) {

    telemetry["direction"] = 124;

    telemetry["distance"]["front"] = 45;

    telemetry["obstacle"]["frontLeft"] = false;
    telemetry["obstacle"]["frontRight"] = false;
    telemetry["obstacle"]["rearLeft"] = false;
    telemetry["obstacle"]["rearRight"] = false;

    telemetry["motion"]["sudden"] = true;

    telemetry["pit"]["detected"] = false;
  }


  // ======================================
  // STATE 4
  // ======================================

  else {

    telemetry["direction"] = 128;

    telemetry["distance"]["front"] = 50;

    telemetry["obstacle"]["frontLeft"] = false;
    telemetry["obstacle"]["frontRight"] = false;
    telemetry["obstacle"]["rearLeft"] = false;
    telemetry["obstacle"]["rearRight"] = false;

    telemetry["motion"]["sudden"] = false;

    telemetry["pit"]["detected"] = false;
  }


  // ======================================
  // TIMESTAMP
  // ======================================

  telemetry["timestamp"] = millis();


  // ======================================
  // SERIALIZE JSON
  // ======================================

  String telemetryJson;

  serializeJson(
    telemetry,
    telemetryJson
  );


  // ======================================
  // SEND BLE NOTIFICATION
  // ======================================

  characteristic->setValue(
    telemetryJson.c_str()
  );

  characteristic->notify();


  // ======================================
  // SERIAL DEBUG
  // ======================================

  Serial.print(
    "Sent telemetry: "
  );

  Serial.println(
    telemetryJson
  );


  // ======================================
  // NEXT STATE
  // ======================================

  mockTelemetryIndex++;

  if (mockTelemetryIndex >= 4) {
    mockTelemetryIndex = 0;
  }
}


// ========================================
// SERVER CALLBACKS
// ========================================

class ServerCallbacks : public BLEServerCallbacks {

  void onConnect(BLEServer *server) {

    deviceConnected = true;

    clientReady = false;

    mockTelemetryIndex = 0;

    lastTelemetry = millis();

    Serial.println(
      "Web app connected!"
    );
  }


  void onDisconnect(BLEServer *server) {

    deviceConnected = false;

    clientReady = false;

    Serial.println(
      "Web app disconnected!"
    );
  }
};


// ========================================
// CHARACTERISTIC CALLBACKS
// ========================================

class CharacteristicCallbacks
  : public BLECharacteristicCallbacks {

  void onWrite(
    BLECharacteristic *characteristic
  ) {

    String value =
      characteristic->getValue();


    if (value.length() == 0) {
      return;
    }


    // ====================================
    // PRINT RECEIVED DATA
    // ====================================

    Serial.print(
      "Received from Web App: "
    );

    Serial.println(value);


    // ====================================
    // PARSE JSON
    // ====================================

    JsonDocument doc;

    DeserializationError error =
      deserializeJson(
        doc,
        value
      );


    // ====================================
    // CHECK JSON
    // ====================================

    if (error) {

      Serial.print(
        "JSON parsing failed: "
      );

      Serial.println(
        error.c_str()
      );

      return;
    }


    // ====================================
    // MESSAGE TYPE
    // ====================================

    const char* type =
      doc["type"];


    // ====================================
    // CLIENT READY HANDSHAKE
    // ====================================

    if (
      type != nullptr &&
      strcmp(type, "client_ready") == 0
    ) {

      Serial.println(
        "Client notification setup confirmed."
      );

      clientReady = true;

      sendDeviceInfo();

      return;
    }


    // ====================================
    // GET COMMAND
    // ====================================

    const char* command =
      doc["command"];


    if (command == nullptr) {

      Serial.println(
        "No command found!"
      );

      return;
    }


    Serial.print(
      "Command: "
    );

    Serial.println(command);


    // ====================================
    // PING COMMAND
    // ====================================

    if (
      strcmp(command, "ping") == 0
    ) {

      pixel.setPixelColor(
        0,
        pixel.Color(0, 255, 0)
      );

      pixel.show();

      JsonDocument response;

      response["type"] =
        "response";

      response["status"] =
        "ok";

      response["command"] =
        "ping";

      response["message"] =
        "Pong from ESP32";

      String responseJson;

      serializeJson(
        response,
        responseJson
      );

      characteristic->setValue(
        responseJson.c_str()
      );

      characteristic->notify();

      Serial.print(
        "Sent response: "
      );

      Serial.println(
        responseJson
      );
    }

// ====================================
// MOVE COMMAND
// ====================================

else if (
  strcmp(command, "move") == 0
) {

  const char* direction =
    doc["direction"];


  if (direction == nullptr) {

    Serial.println(
      "Move command missing direction!"
    );

    return;
  }


  Serial.print(
    "Movement direction: "
  );

  Serial.println(direction);


  // ==================================
  // FORWARD
  // ==================================

  if (
    strcmp(direction, "forward") == 0
  ) {

    // Yellow
    setRobotTestColor(
      255,
      255,
      0
    );

    Serial.println(
      "TEST: FORWARD -> YELLOW"
    );
  }


  // ==================================
  // BACKWARD
  // ==================================

  else if (
    strcmp(direction, "backward") == 0
  ) {

    // Cyan
    setRobotTestColor(
      0,
      255,
      255
    );

    Serial.println(
      "TEST: BACKWARD -> CYAN"
    );
  }


  // ==================================
  // RIGHT
  // ==================================

  else if (
    strcmp(direction, "right") == 0
  ) {

    // Magenta
    setRobotTestColor(
      255,
      0,
      255
    );

    Serial.println(
      "TEST: RIGHT -> MAGENTA"
    );
  }


  // ==================================
  // LEFT
  // ==================================

  else if (
    strcmp(direction, "left") == 0
  ) {

    // White
    setRobotTestColor(
      255,
      255,
      255
    );

    Serial.println(
      "TEST: LEFT -> WHITE"
    );
  }


  // ==================================
  // UNKNOWN DIRECTION
  // ==================================

  else {

    Serial.print(
      "Unknown movement direction: "
    );

    Serial.println(direction);

    return;
  }


  // ==================================
  // SEND RESPONSE TO WEB APP
  // ==================================

  JsonDocument response;

  response["type"] =
    "response";

  response["status"] =
    "ok";

  response["command"] =
    "move";

  response["direction"] =
    direction;


  String responseJson;

  serializeJson(
    response,
    responseJson
  );


  characteristic->setValue(
    responseJson.c_str()
  );

  characteristic->notify();


  Serial.print(
    "Sent movement response: "
  );

  Serial.println(
    responseJson
  );
}

// ====================================
// STOP COMMAND
// ====================================

else if (
  strcmp(command, "stop") == 0
) {

  // Orange
  setRobotTestColor(
    255,
    165,
    0
  );

  Serial.println(
    "TEST: STOP -> ORANGE"
  );


  // ==================================
  // SEND RESPONSE TO WEB APP
  // ==================================

  JsonDocument response;

  response["type"] =
    "response";

  response["status"] =
    "ok";

  response["command"] =
    "stop";


  String responseJson;

  serializeJson(
    response,
    responseJson
  );


  characteristic->setValue(
    responseJson.c_str()
  );

  characteristic->notify();


  Serial.print(
    "Sent stop response: "
  );

  Serial.println(
    responseJson
  );
}

    // ====================================
    // COLOR COMMAND
    // ====================================

    else if (
      strcmp(command, "color") == 0
    ) {

      int r =
        doc["r"] | 0;

      int g =
        doc["g"] | 0;

      int b =
        doc["b"] | 0;


      Serial.print("R: ");
      Serial.println(r);

      Serial.print("G: ");
      Serial.println(g);

      Serial.print("B: ");
      Serial.println(b);


      // -------------------------------
      // Set RGB LED
      // -------------------------------

      pixel.setPixelColor(
        0,
        pixel.Color(
          r,
          g,
          b
        )
      );

      pixel.show();


      Serial.println(
        "RGB LED updated!"
      );


      // =================================
      // SEND RESPONSE TO WEB APP
      // =================================

      JsonDocument response;

      response["status"] =
        "ok";

      response["command"] =
        "color";

      response["r"] =
        r;

      response["g"] =
        g;

      response["b"] =
        b;


      String responseJson;


      serializeJson(
        response,
        responseJson
      );


      characteristic->setValue(
        responseJson.c_str()
      );


      characteristic->notify();


      Serial.print(
        "Sent response: "
      );

      Serial.println(
        responseJson
      );
    }


    // ====================================
    // UNKNOWN COMMAND
    // ====================================

    else {

      Serial.print(
        "Unknown command: "
      );

      Serial.println(command);
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

  Serial.println(
    "Starting Robot BLE..."
  );


  // ========================================
  // RGB LED
  // ========================================

  pixel.begin();

  pixel.clear();

  pixel.show();


  // ========================================
  // BLE INITIALIZATION
  // ========================================

  BLEDevice::init(
    DEVICE_NAME
  );


  // ========================================
  // BLE SERVER
  // ========================================

  BLEServer *server =
    BLEDevice::createServer();


  server->setCallbacks(
    new ServerCallbacks()
  );


  // ========================================
  // BLE SERVICE
  // ========================================

  BLEService *service =
    server->createService(
      SERVICE_UUID
    );


  // ========================================
  // BLE CHARACTERISTIC
  // ========================================

  characteristic =
    service->createCharacteristic(

      CHARACTERISTIC_UUID,

      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_NOTIFY
    );


  // ========================================
  // NOTIFICATION DESCRIPTOR
  // ========================================

  characteristic->addDescriptor(
    new BLE2902()
  );


  // ========================================
  // CHARACTERISTIC CALLBACK
  // ========================================

  characteristic->setCallbacks(
    new CharacteristicCallbacks()
  );


  // ========================================
  // START SERVICE
  // ========================================

  service->start();


  // ========================================
  // ADVERTISING
  // ========================================

  BLEAdvertising *advertising =
    server->getAdvertising();


  advertising->addServiceUUID(
    SERVICE_UUID
  );


  advertising->setScanResponse(
    true
  );


  advertising->start();


  // ========================================
  // READY
  // ========================================

  Serial.println(
    "BLE started!"
  );

  Serial.print(
    "Device name: "
  );

  Serial.println(
    DEVICE_NAME
  );

  Serial.println(
    "Waiting for Web App..."
  );
}


// ========================================
// LOOP
// ========================================

void loop() {

  // ========================================
  // RESTART ADVERTISING AFTER DISCONNECT
  // ========================================

  if (
    !deviceConnected &&
    wasDeviceConnected
  ) {

    delay(500);

    BLEDevice::startAdvertising();

    Serial.println(
      "BLE advertising restarted"
    );

    wasDeviceConnected = false;
  }


  // ========================================
  // TRACK CONNECTION
  // ========================================

  if (
    deviceConnected &&
    !wasDeviceConnected
  ) {

    wasDeviceConnected = true;
  }


  // ========================================
  // MOCK TELEMETRY
  // ========================================

  if (
    deviceConnected &&
    clientReady &&
    millis() - lastTelemetry >= TELEMETRY_INTERVAL
  ) {

    lastTelemetry = millis();

    sendMockTelemetry();
  }
}