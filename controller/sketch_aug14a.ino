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


// ========================================
// BLE
// ========================================

BLECharacteristic *characteristic;

bool deviceConnected = false;
bool wasDeviceConnected = false;

unsigned long lastNotification = 0;

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
// SERVER CALLBACKS
// ========================================

class ServerCallbacks : public BLEServerCallbacks {

  void onConnect(BLEServer *server) {

    deviceConnected = true;

    Serial.println("Web app connected!");

  }


  void onDisconnect(BLEServer *server) {

    deviceConnected = false;

    Serial.println("Web app disconnected!");
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
    // MOVE COMMAND (Training / Challenge D-pad)
    // ====================================

    else if (
      strcmp(command, "move") == 0
    ) {

      const char* direction =
        doc["direction"] | "";

      // -------------------------------
      // Mock motor movement
      // -------------------------------

      Serial.print(
        "[MOCK] Motor moving: "
      );

      Serial.println(direction);

      // TODO: replace with real motor driver calls,
      // e.g. moveMotor(direction);

      JsonDocument response;

      response["status"] = "ok";
      response["command"] = "move";
      response["direction"] = direction;

      String responseJson;

      serializeJson(
        response,
        responseJson
      );

      characteristic->setValue(
        responseJson.c_str()
      );

      characteristic->notify();
    }


    // ====================================
    // STOP COMMAND
    // ====================================

    else if (
      strcmp(command, "stop") == 0
    ) {

      Serial.println(
        "[MOCK] Motor stopped"
      );

      // TODO: replace with real motor driver call,
      // e.g. stopMotor();

      JsonDocument response;

      response["status"] = "ok";
      response["command"] = "stop";

      String responseJson;

      serializeJson(
        response,
        responseJson
      );

      characteristic->setValue(
        responseJson.c_str()
      );

      characteristic->notify();
    }


    // ====================================
    // START CHALLENGE COMMAND
    // ====================================

    else if (
      strcmp(command, "start_challenge") == 0
    ) {

      const char* challengeMode =
        doc["mode"] | "";

      int level =
        doc["level"] | 0;

      Serial.print(
        "[MOCK] Starting challenge, mode: "
      );

      Serial.print(challengeMode);

      Serial.print(
        ", level: "
      );

      Serial.println(level);

      // TODO: kick off real challenge/game logic here.

      JsonDocument response;

      response["status"] = "ok";
      response["command"] = "start_challenge";
      response["mode"] = challengeMode;
      response["level"] = level;

      String responseJson;

      serializeJson(
        response,
        responseJson
      );

      characteristic->setValue(
        responseJson.c_str()
      );

      characteristic->notify();
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

  // Restart advertising only after the BLE stack has completed teardown of
  // the prior GATT session. Starting it directly in onDisconnect can allow
  // a new client to connect before notification state is ready.
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

  if (
    deviceConnected &&
    !wasDeviceConnected
  ) {
    wasDeviceConnected = true;
  }

  // Responses are sent when the Web App writes a command.

}
