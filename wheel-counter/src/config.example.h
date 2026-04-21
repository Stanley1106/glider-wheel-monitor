#pragma once

#include <stdint.h>

// Copy this file to config.h and fill in your local settings.

// Wi-Fi and backend endpoint configuration.
constexpr char WIFI_SSID[] = "YOUR_WIFI_SSID";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
constexpr char SCRIPT_URL[] = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

// Hardware pin mapping.
constexpr uint8_t SENSOR_PIN = 7;  // IRS-180 / FC-51 digital output
constexpr uint8_t DHT_PIN = 2;
constexpr uint8_t I2C_SDA = 5;
constexpr uint8_t I2C_SCL = 6;

// Sampling and upload timing.
constexpr unsigned long DEBOUNCE_MS = 100;
constexpr unsigned long UPLOAD_INTERVAL_MS = 10000;

// Wheel geometry used for local speed display only.
constexpr float WHEEL_CIRC_M = 0.88f;
