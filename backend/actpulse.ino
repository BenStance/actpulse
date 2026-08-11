#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

// ===================== CONFIGURATION =====================

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Backend configuration (IMPORTANT: use your PC IP, NOT localhost)
const char* BACKEND_URL = "http://192.168.1.112:3000";

// Device API key (must match your DeviceApiKeyGuard)
const char* API_KEY = "YOUR_DEVICE_API_KEY";

// GPIO Pins
#define RELAY_PIN 18

// Timing
#define HEARTBEAT_INTERVAL 30000   // 30 seconds
#define DEBOUNCE_DELAY 500         // 0.5 second stability check

// =========================================================

// State tracking
String lastState = "";
unsigned long lastHeartbeat = 0;

// ===================== WIFI CONNECT =====================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("WiFi disconnected. Reconnecting...");
  WiFi.disconnect();
  connectWiFi();
}

// ===================== TIME SETUP (NTP) =====================
void syncTime() {
  configTime(0, 0, "pool.ntp.org");

  Serial.print("Syncing time");
  time_t now = time(nullptr);

  while (now < 100000) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }

  Serial.println("\nTime synced!");
}

// ===================== GET UNIX TIMESTAMP =====================
unsigned long getTimestamp() {
  time_t now;
  time(&now);
  return (unsigned long)now;
}

// ===================== SEND STATUS =====================
void sendStatus(String state) {
  ensureWiFiConnected();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;

  String url = String(BACKEND_URL) + "/sensors/status";
  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("ApiKey ") + API_KEY);

  unsigned long timestamp = getTimestamp();

  String payload = "{";
  payload += "\"status\":\"" + state + "\",";
  payload += "\"timestamp\":" + String(timestamp);
  payload += "}";

  int httpResponseCode = http.POST(payload);

  Serial.println("---- STATUS SENT ----");
  Serial.println(payload);
  Serial.print("Response: ");
  Serial.println(httpResponseCode);

  http.end();
}

// ===================== SEND HEARTBEAT =====================
void sendHeartbeat() {
  ensureWiFiConnected();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;

  String url = String(BACKEND_URL) + "/sensors/heartbeat";
  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("ApiKey ") + API_KEY);

  unsigned long timestamp = getTimestamp();
  String payload = "{";
  payload += "\"timestamp\":" + String(timestamp);
  payload += "}";

  int httpResponseCode = http.POST(payload);

  Serial.println("---- HEARTBEAT SENT ----");
  Serial.println(payload);
  Serial.print("Response: ");
  Serial.println(httpResponseCode);

  http.end();
}

// ===================== READ RELAY STATE =====================
String readDeviceState() {
  int value = digitalRead(RELAY_PIN);

  // Relay logic:
  // HIGH = ON
  // LOW  = OFF

  if (value == HIGH) return "ON";
  else return "OFF";
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, INPUT);

  connectWiFi();
  syncTime();

  // Send initial heartbeat + state
  sendHeartbeat();

  String initialState = readDeviceState();
  lastState = initialState;

  sendStatus(initialState);
}

// ===================== LOOP =====================
void loop() {

  // 1. Read current state
  String currentState = readDeviceState();

  // 2. Detect state change
  if (currentState != lastState) {
    delay(DEBOUNCE_DELAY); // debounce

    String confirmState = readDeviceState();

    if (confirmState == currentState) {
      lastState = currentState;
      sendStatus(currentState);
    }
  }

  // 3. Heartbeat every 30 seconds
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  delay(100);
}
