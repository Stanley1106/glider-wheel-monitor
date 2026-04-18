#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include "config.h"

#define SENSOR_PIN         4
#define DHT_PIN            2
#define I2C_SDA            5
#define I2C_SCL            6
#define DEBOUNCE_MS        100
#define WHEEL_CIRC_M       0.88f
#define UPLOAD_INTERVAL_MS 30000

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;

unsigned long lapCount = 0;
unsigned long lastTrigger = 0;
bool lastPin = HIGH;

unsigned long lastUploadMs = 0;
unsigned long lastUploadLaps = 0;

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected: %s\n", WiFi.localIP().toString().c_str());
}

void uploadData(unsigned long totalLaps, unsigned long lapsDelta, float distanceM, float rpm,
                float temp, float hum, float lux) {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  HTTPClient http;
  String url = String(SCRIPT_URL)
    + "?total_laps="  + totalLaps
    + "&laps_delta="  + lapsDelta
    + "&distance_m="  + distanceM
    + "&rpm="         + rpm
    + "&temperature=" + temp
    + "&humidity="    + hum
    + "&lux="         + lux;

  http.begin(url);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  int code = http.GET();
  Serial.printf("Upload: HTTP %d  T=%.1f H=%.1f Lux=%.0f\n", code, temp, hum, lux);
  http.end();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  delay(500);

  Wire.begin(I2C_SDA, I2C_SCL);
  dht.begin();
  lightMeter.begin();

  pinMode(SENSOR_PIN, INPUT_PULLUP);
  connectWiFi();
  Serial.println("Wheel counter ready.");
}

void loop() {
  bool currentPin = digitalRead(SENSOR_PIN);
  unsigned long now = millis();

  if (currentPin == LOW && lastPin == HIGH && (now - lastTrigger > DEBOUNCE_MS)) {
    lapCount++;
    lastTrigger = now;
    float distance = lapCount * WHEEL_CIRC_M;
    Serial.printf("Laps: %lu  Distance: %.2f m\n", lapCount, distance);
    Serial.printf(">laps:%lu\n", lapCount);
    Serial.printf(">distance:%.2f\n", distance);
  }
  lastPin = currentPin;

  if (now - lastUploadMs >= UPLOAD_INTERVAL_MS) {
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    float lux  = lightMeter.readLightLevel();

    if (isnan(temp)) temp = 0;
    if (isnan(hum))  hum  = 0;
    if (lux < 0)     lux  = 0;

    unsigned long delta = lapCount - lastUploadLaps;
    float rpm = delta * (60000.0f / UPLOAD_INTERVAL_MS);

    uploadData(lapCount, delta, lapCount * WHEEL_CIRC_M, rpm, temp, hum, lux);
    lastUploadLaps = lapCount;
    lastUploadMs = now;
  }

  delay(1);
}
