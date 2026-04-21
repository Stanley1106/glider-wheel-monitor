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

namespace {
constexpr int OLED_WIDTH = 128;
constexpr int OLED_HEIGHT = 64;
constexpr uint8_t OLED_ADDR = 0x3C;

constexpr long TIMEZONE_OFFSET_SEC = 8 * 3600;
constexpr int DAYLIGHT_OFFSET_SEC = 0;
constexpr char NTP_PRIMARY[] = "pool.ntp.org";
constexpr char NTP_SECONDARY[] = "time.google.com";
}

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

unsigned long lapCount = 0;
unsigned long lastTrigger = 0;
bool lastSensorPin = HIGH;

portMUX_TYPE dataMux = portMUX_INITIALIZER_UNLOCKED;

unsigned long lastUploadLaps = 0;

float lastTemp = 0, lastHum = 0, lastLux = 0, lastSpeedKmh = 0;

void updateDisplay() {
  float distanceMeters = lapCount * WHEEL_CIRC_M;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);  display.printf("Laps:%lu Dist:%.1fm", lapCount, distanceMeters);
  display.setCursor(0, 16); display.printf("Speed: %.2f km/h", lastSpeedKmh);
  display.setCursor(0, 32); display.printf("T:%.1fC  H:%.0f%%", lastTemp, lastHum);
  display.setCursor(0, 48); display.printf("Lux: %.0f", lastLux);
  display.setCursor(80, 48); display.print(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "No WiFi");
  display.display();
}

void addLap() {
  unsigned long now = millis();
  if (now - lastTrigger <= DEBOUNCE_MS) return;

  unsigned long lapsSnapshot;
  portENTER_CRITICAL(&dataMux);
  lapCount++;
  lapsSnapshot = lapCount;
  portEXIT_CRITICAL(&dataMux);

  lastTrigger = now;

  Serial.printf("Laps: %lu\n", lapsSnapshot);
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
  configTime(TIMEZONE_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_PRIMARY, NTP_SECONDARY);
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
    unsigned long laps = lapCount;
    unsigned long lapDelta = lapCount - lastUploadLaps;
    lastUploadLaps = lapCount;
    portEXIT_CRITICAL(&dataMux);

    lastTemp = temp;
    lastHum = hum;
    lastLux = lux;
    lastSpeedKmh = lapDelta * WHEEL_CIRC_M * 3600.0f / UPLOAD_INTERVAL_MS;
    updateDisplay();

    if (WiFi.status() != WL_CONNECTED) connectWiFi();
    HTTPClient http;
    String ts = getTimestamp();
    String url = String(SCRIPT_URL)
      + "?ts="          + ts
      + "&laps="        + laps
      + "&temperature=" + temp
      + "&humidity="    + hum
      + "&lux="         + lux;
    http.begin(url);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    int code = http.GET();
    Serial.printf("Upload: HTTP %d laps=%lu T=%.1f H=%.1f Lux=%.0f\n", code, laps, temp, hum, lux);
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
    addLap();
  }

  lastSensorPin = currentPin;
  delay(1);
}
