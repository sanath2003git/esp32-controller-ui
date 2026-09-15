# BLE JSON Contract — v2

## Handshake

```json
{"type":"client_ready"}
```

---

## Browser → ESP32

### Move
```json
{"command":"move","direction":"forward"}
```

### Stop
```json
{"command":"stop"}
```

### Strip (NeoPixel Region)
```json
{"command":"strip","region":"front","r":255,"g":0,"b":0}
{"command":"strip","region":"back","r":255,"g":0,"b":0}
{"command":"strip","region":"left","r":255,"g":0,"b":0}
{"command":"strip","region":"right","r":255,"g":0,"b":0}
{"command":"strip","region":"all","r":255,"g":0,"b":0}
```

### Buzzer / Horn
```json
{"command":"buzz","freq":1200,"duration":400}
```

### OLED — Expression Sequence
```json
{"command":"display_expr","sequence":[0,2,1]}
```

### OLED — Text
```json
{"command":"display_text","text":"Hello!","line":0}
```

### OLED — Clear
```json
{"command":"display_clear"}
```

### Controller Mode
```json
{"command":"set_controller","mode":"ble"}
{"command":"set_controller","mode":"physical"}
{"command":"set_controller","mode":"none"}
```

---

## ESP32 → Browser

### Device Info
```json
{
  "type": "device_info",
  "deviceId": "A1B2C3D4E5F6",
  "name": "MAINBOT",
  "model": "ESP32-S3 N16R8",
  "firmware": "2.0.0",
  "sensors": {
    "mpu6050": true,
    "qmc5883p": true,
    "oled": true
  }
}
```

### Telemetry
```json
{
  "type": "telemetry",
  "direction": 127,
  "distance": {
    "front": 42
  },
  "obstacle": {
    "frontLeft": false,
    "frontRight": false,
    "rearLeft": false,
    "rearRight": false
  },
  "motion": {
    "sudden": false
  },
  "pit": {
    "detected": false
  },
  "battery": {
    "robot": 87,
    "remote": 62
  },
  "touch": {
    "event": "none"
  },
  "controller": {
    "active": "ble"
  },
  "timestamp": 123456
}
```

### Command Response
```json
{
  "type": "response",
  "status": "ok",
  "command": "move",
  "direction": "forward"
}
```

### Error Response
```json
{
  "type": "response",
  "status": "error",
  "command": "strip",
  "message": "Unknown region"
}
```

---

## Allowed Values

### `direction` (move)
`"forward"` `"backward"` `"left"` `"right"`

### `region` (strip)
`"front"` `"back"` `"left"` `"right"` `"all"`

### `mode` (set_controller)
`"ble"` `"physical"` `"none"`

### `touch.event` (telemetry)
`"none"` `"single_tap"` `"double_tap"` `"hold"`

### `controller.active` (telemetry)
`"ble"` `"physical"` `"none"`

### `sequence` IDs (display_expr)
| ID | Expression |
|----|------------|
| 0  | Happy      |
| 1  | Sad        |
| 2  | Heart      |
| 3  | Star       |
| 4  | Check      |
| 5  | Cross      |
| 6  | Warning    |
| 7  | Robot      |
| 8  | Battery    |
| 9  | Sleep      |
| 10 | WiFi       |
