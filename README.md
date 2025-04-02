# OCPP1.6 Charge Point Simulator

## 📌 Overview
The **Charge Point Simulator** is a tool designed to simulate communication between a **Charge Point** and a **Central System (CS)** using the **OCPP 1.6 JSON** protocol. It is useful for testing various charging transaction scenarios, including **Remote Start Transaction**, **Stop Transaction**, **Status Notification**, and **Meter Values**.

## ⚙️ Features
- **Remote Start & Stop Transaction Simulation**
  - Supports **Remote Start Transaction** initiated by the Central System.
  - Sends **Start Transaction** with valid **meterStart** and **idTag**.
  - Sends **Stop Transaction** when the energy limit or balance is reached.

- **Status Notification**
  - Periodically sends **connector status** (e.g., Available, Preparing, Charging, Finishing).
  - Manages status transitions based on transaction conditions.

- **Meter Values Reporting**
  - Continuously updates **meter values** during an active transaction.
  - Monitors energy consumption limits based on **user deposit**.

- **Error Handling Simulation**
  - Handles various errors that may occur during communication with the Central System.

## 🔗 Supported Protocol
- **OCPP 1.6 JSON**
  - Uses WebSocket for real-time communication between Charge Point and Central System.

## 🛠 Use Cases
✅ **Test Central System** before deployment on physical Charge Points.  
✅ **Simulate charging transaction scenarios**, including network conditions.  
✅ **Validate pricing logic and customer balance calculations** before live implementation.

## 🛠 How to Install
Follow these steps to install and run the Charge Point Simulator:
### 1️⃣ Prerequisites 
Before you begin, make sure you have the following installed:  
- NodeJs v22.14.0 (LTS)
- NPM 10.9.2

### 2️⃣ Clone the Repository
```
$ git clone https://github.com/ivantans/ocpp16-charge-point-simulator <your_folder>
```

### 3️⃣ Install Dependencies
```
$ npm install
```

### 4️⃣ Start the Simulator
```
npx http-server -p 3000
```
---
Use this simulator for **development, testing, and debugging** in OCPP-based projects!