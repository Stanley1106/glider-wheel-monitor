#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

#define SENSOR_PIN         7   // IRS-180 / FC-51
#define DHT_PIN            2
#define I2C_SDA            5
#define I2C_SCL            6
#define DEBOUNCE_MS        100
#define WHEEL_CIRC_M       0.88f
#define UPLOAD_INTERVAL_MS 10000

#define OLED_WIDTH  128
#define OLED_HEIGHT 64
#define OLED_ADDR   0x3C

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

unsigned long lapCount = 0;
unsigned long lastTrigger = 0;
bool lastSensorPin = HIGH;

portMUX_TYPE dataMux = portMUX_INITIALIZER_UNLOCKED;

unsigned long lastUploadLaps = 0;

float lastTemp = 0, lastHum = 0, lastLux = 0, lastRpm = 0;

void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);  display.printf("Laps: %lu", lapCount);
  display.setCursor(0, 12); display.printf("Dist: %.2f m", lapCount * WHEEL_CIRC_M);
  display.setCursor(0, 24); display.printf("RPM:  %.1f", lastRpm);
  display.setCursor(0, 36); display.printf("T:%.1fC  H:%.0f%%", lastTemp, lastHum);
  display.setCursor(0, 48); display.printf("Lux: %.0f", lastLux);
  display.setCursor(80, 48); display.print(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "No WiFi");
  display.display();
}

void addLap(const char* source) {
  unsigned long now = millis();
  if (now - lastTrigger <= DEBOUNCE_MS) return;

  unsigned long lapsSnapshot;
  portENTER_CRITICAL(&dataMux);
  lapCount++;
  lapsSnapshot = lapCount;
  portEXIT_CRITICAL(&dataMux);

  lastTrigger = now;

  float distance = lapsSnapshot * WHEEL_CIRC_M;
  Serial.printf("[%s] Laps: %lu  Distance: %.2f m\n", source, lapsSnapshot, distance);
  Serial.printf(">laps:%lu\n", lapsSnapshot);
  Serial.printf(">distance:%.2f\n", distance);
  updateDisplay();
}

String getTimestamp() {
  struct tm t;
  if (!getLocalTime(&t)) return "1970/01/01 00:00:00";
  char buf[24];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &t);
  return String(buf);
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected: %s\n", WiFi.localIP().toString().c_str());
  configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
  Serial.print("NTP sync");
  struct tm t;
  while (!getLocalTime(&t)) { delay(500); Serial.print("."); }
  Serial.printf("\nTime: %s\n", getTimestamp().c_str());
}

void uploadTask(void* param) {
  connectWiFi();

  while (true) {
    vTaskDelay(pdMS_TO_TICKS(UPLOAD_INTERVAL_MS));

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    float lux  = lightMeter.readLightLevel();
    if (isnan(temp)) temp = 0;
    if (isnan(hum))  hum  = 0;
    if (lux < 0)     lux  = 0;

    portENTER_CRITICAL(&dataMux);
    unsigned long laps  = lapCount;
    unsigned long delta = lapCount - lastUploadLaps;
    lastUploadLaps = lapCount;
    portEXIT_CRITICAL(&dataMux);

    float rpm = delta * (60000.0f / UPLOAD_INTERVAL_MS);

    lastTemp = temp; lastHum = hum; lastLux = lux; lastRpm = rpm;
    updateDisplay();

    if (WiFi.status() != WL_CONNECTED) connectWiFi();
    HTTPClient http;
    String ts = getTimestamp();
    String url = String(SCRIPT_URL)
      + "?ts="          + ts
      + "&laps_delta="  + delta
      + "&temperature=" + temp
      + "&humidity="    + hum
      + "&lux="         + lux;
    http.begin(url);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    int code = http.GET();
    Serial.printf("Upload: HTTP %d  delta=%lu T=%.1f H=%.1f Lux=%.0f\n", code, delta, temp, hum, lux);
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  delay(500);

  Wire.begin(I2C_SDA, I2C_SCL);
  dht.begin();
  lightMeter.begin();

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED init failed");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.print("Connecting WiFi...");
    display.display();
  }

  pinMode(SENSOR_PIN, INPUT_PULLUP);

  xTaskCreate(uploadTask, "upload", 8192, NULL, 1, NULL);

  Serial.println("Wheel counter ready.");
}

void loop() {
  bool currentPin = digitalRead(SENSOR_PIN);

  if (currentPin == HIGH && lastSensorPin == LOW) {
    addLap("IR");
  }

  lastSensorPin = currentPin;
  delay(1);
}
