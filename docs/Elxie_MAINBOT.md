# Elxie - MAINBOT Pinout Reference

ESP32-S3 · matches MAINBOT v3.1 wiring with the v1.2 change applied  
(onboard NeoPixel removed, GPIO48 freed & reserved for motor control, external strip = 30 LEDs)

---

## Pinout Table

| Subsystem                    | Signal                                  | ESP32-S3 GPIO |
| ---------------------------- | --------------------------------------- | ------------- |
| **Motor driver (TB6612FNG)** | STBY                                    | 14            |
|                              | PWMA (motor A speed)                    | 18            |
|                              | AIN1                                    | 19            |
|                              | AIN2                                    | 20            |
|                              | PWMB (motor B speed)                    | 21            |
|                              | BIN1                                    | 47            |
|                              | BIN2                                    | 48            |
| **Sonar (HC-SR04)**          | TRIG                                    | 15            |
|                              | ECHO                                    | 16            |
| **I2C bus**                  | SDA                                     | 8             |
|                              | SCL                                     | 9             |
| **Mux (CD4067, IR bank)**    | S0                                      | 4             |
|                              | S1                                      | 5             |
|                              | S2                                      | 6             |
|                              | S3                                      | 17            |
|                              | SIG (shared analog in)                  | 1             |
| **Touch (TTP223)**           | signal                                  | 12            |
| **Buzzer (passive)**         | PWM out                                 | 13            |
| **External NeoPixel strip**  | data                                    | 10            |
| **Encoders**                 | left                                    | 39            |
|                              | right                                   | 40            |
| **Reserved**                 | freed from onboard NeoPixel, unassigned | 45            |

---

## I2C Device Addresses

- MPU6050 → `0x68`
- QMC5883P → `0x2C`
- OLED (SSD1306) → `0x3C`

---

## IR Mux Channels (wired)

These are CD4067 channel numbers selected via S0-S3, not separate GPIOs.  
All four channels share the single MUX_SIG analog input (GPIO 1).

| Position         | Mux channel |
| ---------------- | ----------- |
| Front-right (FR) | 9           |
| Front-left (FL)  | 11          |
| Rear-right (RR)  | 12          |
| Rear-left (RL)   | 14          |

⚠️ The full product brief calls for **16 IR channels** (8 front line-sensing array + 4 bottom-edge + 4 side-edge).  
Currently, only these 4 corner channels are wired. Add the remaining channel numbers once assigned.

---

## Not Yet Wired

- Sound sensor / microphone
- Battery-voltage ADC sensing

Both are specified in the product brief but absent from this pin reference.

---

_Generated from the pin definitions in `Elxie_AP_WebControl_v0.2.ino` / `MAINBOT_test_bench_v1.2.ino`._
