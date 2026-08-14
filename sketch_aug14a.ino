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

unsigned long lastNotification = 0;


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

    BLEAdvertising *advertising =
      server->getAdvertising();

    advertising->start();
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
    // COLOR COMMAND
    // ====================================

    if (
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

  // For now we don't send periodic JSON.

  // We will send responses only when
  // the Web App sends a command.

}