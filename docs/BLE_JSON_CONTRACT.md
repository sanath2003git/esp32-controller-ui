# ESP32 ↔ Frontend BLE JSON Contract

This document describes the JSON payloads accepted and produced by the current
web frontend. It is the implementation contract for the ESP32 firmware.

## BLE transport

| Item | Value |
| --- | --- |
| Advertising service UUID | `12345678-1234-1234-1234-123456789001` |
| GATT characteristic UUID | `12345678-1234-1234-1234-123456789002` |
| Characteristic capabilities | `READ`, `WRITE`, `NOTIFY` |
| Encoding | UTF-8 JSON text |

Use **one complete JSON object per BLE write or notification**. Do not combine
multiple JSON objects into one packet or split one object across packets: the
browser parses each received notification as one complete JSON string.

The browser filters devices by the service UUID; its advertised device name is
not currently validated.

## Connection sequence

1. The browser connects, obtains the characteristic, and enables notifications.
2. The browser writes the following handshake message:

```json
{"type":"client_ready"}
```

3. On receiving `client_ready`, the ESP32 should notify one `device_info`
   message.
4. The ESP32 may then notify telemetry periodically (the current firmware uses
   a 2-second interval).

The firmware should wait for `client_ready` before sending notifications. This
prevents the initial device-info message being sent before the browser's
notification listener is ready.

## Browser → ESP32 writes

The frontend serializes these objects exactly as JSON. Command objects do not
include a `type` or request ID.

### Client-ready handshake

```json
{"type":"client_ready"}
```

### Movement

```json
{"command":"move","direction":"forward"}
```

`command` must be `"move"`. `direction` is required and must be exactly one of:

- `"forward"`
- `"backward"`
- `"left"`
- `"right"`

### Emergency stop

```json
{"command":"stop"}
```

### RGB LED color

```json
{"command":"color","r":255,"g":0,"b":0}
```

`r`, `g`, and `b` should be integer channel values from `0` through `255`.
The current buttons send these presets:

| Button | JSON channels |
| --- | --- |
| Red | `r: 255, g: 0, b: 0` |
| Green | `r: 0, g: 255, b: 0` |
| Blue | `r: 0, g: 0, b: 255` |
| Off | `r: 0, g: 0, b: 0` |

## ESP32 → browser notifications

Every notification must be valid JSON. The frontend rejects malformed JSON and
messages that do not conform to one of the forms below.

### Device information (required after client-ready)

```json
{
  "type": "device_info",
  "deviceId": "A1B2C3D4E5F6",
  "name": "MAINBOT",
  "model": "ESP32-S3 N16R8",
  "firmware": "0.1.0"
}
```

All five fields are required strings. `deviceId` is displayed by the UI; a
stable MAC-derived identifier is suitable.

### Telemetry (required wire shape)

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
  "timestamp": 123456
}
```

Telemetry field requirements:

| Field | Required | Type / meaning |
| --- | --- | --- |
| `type` | Yes | Exact string `"telemetry"` |
| `direction` | Yes | Number; robot heading in degrees, displayed directly by the UI |
| `distance.front` | Yes | Number in centimetres, or `null` when unavailable |
| `obstacle.frontLeft` | Yes | Boolean; obstacle sensor state |
| `obstacle.frontRight` | Yes | Boolean; obstacle sensor state |
| `obstacle.rearLeft` | Yes | Boolean; obstacle sensor state |
| `obstacle.rearRight` | Yes | Boolean; obstacle sensor state |
| `motion.sudden` | Yes | Boolean; a rising `true` state triggers “Sudden motion detected” |
| `pit.detected` | Yes | Boolean; a rising `true` state triggers “Pit detected ahead” |
| `timestamp` | No | Number; typically ESP32 `millis()` |

`direction`, `distance`, `obstacle`, `motion`, and `pit` must be at the root
of the JSON object. Do **not** wrap them inside a `telemetry` object. The
frontend normalizes this flat wire format internally after it validates it.

### Command response (recommended)

Notify a result after each command so that it appears in the frontend's latest
message debug panel:

```json
{
  "type": "response",
  "status": "ok",
  "command": "move",
  "direction": "forward"
}
```

`type`, `status`, and `command` are required strings. Extra fields are allowed;
for example, echo `direction` for a move and `r`, `g`, `b` for a color command.
Use `status: "ok"` on success and a descriptive status such as `"error"` on
failure.

For temporary backwards compatibility, the frontend also accepts a response
that omits `type`, provided it contains string `status` and `command`:

```json
{"status":"ok","command":"color","r":255,"g":0,"b":0}
```

New firmware should always include `"type":"response"`.

## Examples

Successful move exchange:

```text
Browser write:       {"command":"move","direction":"left"}
ESP32 notification: {"type":"response","status":"ok","command":"move","direction":"left"}
```

Unavailable front-distance reading:

```json
{
  "type": "telemetry",
  "direction": 0,
  "distance": { "front": null },
  "obstacle": {
    "frontLeft": false,
    "frontRight": false,
    "rearLeft": false,
    "rearRight": false
  },
  "motion": { "sudden": false },
  "pit": { "detected": false }
}
```

## Current implementation notes

- The existing ESP32 sketch already uses the specified UUIDs, handshake,
  device-info payload, and flat telemetry payload.
- Its `color` response currently omits `type`; this works only because of the
  backwards-compatible parser. Add `"type":"response"` when updating it.
- The frontend has no command-ID field and does not correlate responses to
  individual writes. Do not require an `id` from the browser at this stage.
