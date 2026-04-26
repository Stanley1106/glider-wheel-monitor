# Wheel Counter Firmware

ESP32-C3 firmware for counting sugar glider wheel laps and uploading activity/environment readings.

The firmware counts wheel sensor triggers, reads DHT22 temperature/humidity and BH1750 light data, shows current values on an SSD1306 OLED, and uploads readings to a Google Apps Script endpoint.

## Hardware

- ESP32-C3 DevKitM-1 / ESP32-C3 SuperMini compatible board
- FC-51 or compatible IR obstacle sensor for wheel lap detection
- DHT22 temperature and humidity sensor
- BH1750 light sensor
- SSD1306 128x64 I2C OLED

Default pins are defined in [src/config.example.h](src/config.example.h):

- `SENSOR_PIN = 7`
- `DHT_PIN = 2`
- `I2C_SDA = 5`
- `I2C_SCL = 6`

## Setup

Install PlatformIO first. The official options are:

- Use the PlatformIO IDE extension for VS Code. PlatformIO Core is included and can be used from the PlatformIO IDE terminal.
- For standalone CLI usage, install PlatformIO Core with the official installer script.

Official references:

- [PlatformIO Core installation](https://docs.platformio.org/en/latest/core/installation/)
- [PlatformIO Core CLI](https://docs.platformio.org/en/latest/core/)

Copy the example config and fill in local settings:

```powershell
cd wheel-counter
copy src\config.example.h src\config.h
```

Edit `src/config.h`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SCRIPT_URL`
- hardware pins, if your wiring differs
- `UPLOAD_INTERVAL_MS`
- `WHEEL_CIRC_M`

`src/config.h` is ignored by git so local Wi-Fi credentials stay out of commits.

## Build And Flash

This project uses PlatformIO.

```bash
cd wheel-counter
pio run
pio run --target upload
pio device monitor
```

The default serial monitor and upload port is `COM9`, configured in [platformio.ini](platformio.ini).

These commands match PlatformIO's documented CLI flow: `pio run` builds the project, `pio run --target upload` processes the upload target, and `pio device monitor` opens the serial monitor.

Official references:

- [pio run](https://docs.platformio.org/en/latest/core/userguide/cmd_run.html)
- [PlatformIO project targets](https://docs.platformio.org/en/latest/projectconf/sections/env/options/build/targets.html)
- [pio device monitor](https://docs.platformio.org/en/latest/core/userguide/device/cmd_monitor.html)

## Uploaded Data

Every upload sends a GET request to `SCRIPT_URL` with these query parameters:

- `ts` - local timestamp after NTP sync
- `laps_delta` - laps counted since the previous upload
- `laps_total` - total laps since the current local day started
- `temperature`
- `humidity`
- `lux`

The dashboard currently uses `laps_delta` as the source for activity charts and daily totals.

## Runtime Behavior

- The main loop watches the IR sensor edge and debounces lap triggers.
- A FreeRTOS upload task handles Wi-Fi, NTP sync, sensor reads, display updates, and HTTP uploads.
- A critical section protects shared lap counters between the loop and upload task.
- The daily lap counter resets at local midnight using UTC+8 time.
