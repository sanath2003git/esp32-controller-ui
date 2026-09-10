// Elxie IR testbench — streams all 16 mux channels as CSV to Processing
// Line format:  D,ch0,ch1,...,ch15\n   (raw 12-bit values 0..4095)
// Serial @115200. Pins match the MAINBOT sketch #defines.
// #define MUX_S0   4
// #define MUX_S1   5
// #define MUX_S2   6
// #define MUX_S3   17
// #define MUX_SIG  1      // CD4067 SIG -> ADC (GPIO1)
#define MUX_S0 7
#define MUX_S1 6
#define MUX_S2 5
#define MUX_S3 4
#define MUX_SIG 1
#define NUM_CH   16

void muxSel(uint8_t ch) {
  digitalWrite(MUX_S0, (ch >> 0) & 1);
  digitalWrite(MUX_S1, (ch >> 1) & 1);
  digitalWrite(MUX_S2, (ch >> 2) & 1);
  digitalWrite(MUX_S3, (ch >> 3) & 1);
}

int muxRead(uint8_t ch) {
  muxSel(ch);
  delayMicroseconds(50);
  analogRead(MUX_SIG);        // dummy read
  long s = 0;
  for (int i = 0; i < 4; i++) s += analogRead(MUX_SIG);
  return s / 4;
}

void setup() {
  Serial.begin(115200);
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);
  pinMode(MUX_SIG, INPUT);
  analogReadResolution(12);
}

void loop() {
  int v[NUM_CH];
  for (int ch = 0; ch < NUM_CH; ch++) v[ch] = muxRead(ch);

  Serial.print("D");
  for (int ch = 0; ch < NUM_CH; ch++) {
    Serial.print(',');
    Serial.print(v[ch]);
  }
  Serial.println();

  delay(40);   // ~25 fps
}