let startTransactionButton1 = document.getElementById("startTransactionButton1");
let stopTransactionButton1 = document.getElementById("stopTransactionButton1");
let setToPreparingButton1 = document.getElementById("setToPreparingButton1");
let startTransactionButton2 = document.getElementById("startTransactionButton2");
let stopTransactionButton2 = document.getElementById("stopTransactionButton2");
let setToPreparingButton2 = document.getElementById("setToPreparingButton2");
startTransactionButton1.disabled = false;
stopTransactionButton1.disabled = true;
startTransactionButton2.disabled = false;
stopTransactionButton2.disabled = true;
setToPreparingButton1.disabled = true
setToPreparingButton2.disabled = true
let socket;
let heartbeatInterval;
let pendingBootInterval; // Interval untuk BootNotification jika status Pending
let reconnectInterval; // Interval untuk auto-reconnect
let lastWsUrl = null; // Simpan URL WebSocket terakhir yang digunakan
let pendingRequest = {};
let chargingInterval1;
let chargingInterval2;
let runningConnectorTransactionId1;
let runningConnectorTransactionId2;
let runningIdTagConnector1;
let runningIdTagConnector2;
let runningIdTag1;
let runningIdTag2;
let meterValuesInterval1;
let meterValuesInterval2;

// CONSOLE TO HTML FUNCTION
function logToConsole(message) {
  const logConsole = document.getElementById("logConsole");
  const logEntry = document.createElement("p");
  logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logConsole.appendChild(logEntry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// HANDLE BUTTON FUNCTION
function connectToWs() {
  const wsUrlValue = document.getElementById("wsUrl").value;

  if (!wsUrlValue) {
    logToConsole("⚠️ Harap masukkan URL WebSocket!");
    return;
  }

  lastWsUrl = wsUrlValue; // Simpan URL WebSocket terakhir
  connectWebSocket(wsUrlValue);
}

function connectWebSocket(url) {
  logToConsole(`🔌 Mencoba menghubungkan ke ${url}...`);

  socket = new WebSocket(url, ["ocpp1.6"]);

  socket.onopen = () => {
    logToConsole(`✅ Terhubung ke ${url}`);
    toggleButtons(true);
    bootNotification(); // Kirim BootNotification saat koneksi berhasil
    stopReconnect(); // Hentikan auto-reconnect jika sukses
  };

  socket.onerror = (e) => {
    logToConsole(`⚠️ Terjadi error: ${JSON.stringify(e)}`);
  };

  socket.onclose = () => {
    logToConsole(`🔴 WebSocket terputus`);
    toggleButtons(false);
    stopPendingBootNotification();
    stopHeartbeat();
    startReconnect(); // Mulai auto-reconnect
  };

  socket.onmessage = (event) => handleIncomingMessage(event);
}

// INTERVAL UNTUK STATUS PENDING (Kirim BootNotification terus setiap 5 detik)
function startPendingBootNotification() {
  if (pendingBootInterval) return; // Hindari lebih dari 1 interval berjalan
  pendingBootInterval = setInterval(() => {
    bootNotification();
  }, 5000);
}

function stopPendingBootNotification() {
  if (pendingBootInterval) {
    clearInterval(pendingBootInterval);
    pendingBootInterval = null;
  }
}

// INTERVAL UNTUK STATUS ACCEPTED (Kirim Heartbeat setiap `interval` detik)
function startHeartbeat(interval) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const response = [2, crypto.randomUUID(), "Heartbeat", {}];
      socket.send(JSON.stringify(response));
      logToConsole(`📤 Heartbeat terkirim: ${JSON.stringify(response)}`);
    } else {
      stopHeartbeat();
    }
  }, interval * 1000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// FUNGSI AUTO RECONNECT
function startReconnect() {
  if (!reconnectInterval && lastWsUrl) {
    logToConsole(
      "🔄 WebSocket terputus, mencoba menyambung kembali setiap 5 detik..."
    );
    reconnectInterval = setInterval(() => {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectWebSocket(lastWsUrl);
      }
    }, 30000);
  }
}

function stopReconnect() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
    logToConsole("✅ Auto-reconnect dihentikan, koneksi berhasil.");
  }
}


// ============================================================== HANDLE MESSAGE ==============================================================

function handleIncomingMessage(event) {
  logToConsole(`📥 Pesan dari server: ${event.data}`);

  try {
    const message = JSON.parse(event.data);
    const messageTypeId = message[0];
    const messageId = message[1];
    // ============================================================== REQUESTED MESSAGE ==============================================================
    if (messageTypeId === 2) {
      const action = message[2];
      const payload = message[3];

      if (action === "Reset") {
        const response = [3, messageId, { status: "Accepted" }]
        logToConsole(JSON.stringify(response));
        socket.send(JSON.stringify(response));
      }

      if (action === "RemoteStartTransaction") {
        remoteStartTransaction(payload.connectorId, payload.idTag, messageId)
      }
      if (action === "RemoteStopTransaction") {
        remoteStopTransaction(payload.transactionId, messageId, true);
      }

      if (action === "TriggerMessage") {
        if (payload.requestedMessage === "BootNotification") {
          try {
            const response = [3, messageId, { status: "Accepted" }]
            socket.send(JSON.stringify(response));
            console.log("telah dikirim ", response)
            bootNotification();
          } catch (e) {
            console.error("failed to send bootnotification when triggermessage ", e);
            return
          }
        }

        if (payload.requestedMessage === "Heartbeat") {
          try {
            const response = [3, messageId, { status: "Accepted" }]
            socket.send(JSON.stringify(response));

            socket.send(JSON.stringify([2, crypto.randomUUID(), "Heartbeat", {}]))
            console.log("telah dikirim ", response)
          } catch (e) {
            console.error("failed to send Heartbeat when triggermessage ", e);
            return
          }
        }
        if (payload.requestedMessage === "MeterValues") {
          try {
            const acceptedMessage = [3, messageId, { status: "Accepted" }];
            if (!payload.connector) {
              if (chargingInterval1) {
                socket.send(JSON.stringify(acceptedMessage));
                sendMeterValuesRequest(1);
                return;
              }
              if (chargingInterval2) {
                socket.send(JSON.stringify(acceptedMessage));
                sendMeterValuesRequest(2);
                return;
              }
              socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
              return;
            }

            if (payload.connector) {
              if (payload.connector === 1 && chargingInterval1) {
                socket.send(JSON.stringify(acceptedMessage));
                sendMeterValuesRequest(1);
                return;
              }
              if (payload.connector === 2 && chargingInterval2) {
                socket.send(JSON.stringify(acceptedMessage));
                sendMeterValuesRequest(2);
                return;
              }

              socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
              return;
            }
            socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
          } catch (e) {
            console.error("failed to send MeterValues when triggermessage ", e);
            return
          }
        }

        if (payload.requestedMessage === "StatusNotification") {
          socket.send(JSON.stringify([3, messageId, { status: "Accepted" }]));

          if (!payload.connectorId) {
            statusNotification(1)
            statusNotification(2)
          }

          if (payload.connectorId && payload.connectorId === 1) {
            statusNotification(1)
          }
          if (payload.connectorId && payload.connectorId === 2) {
            statusNotification(2)
          }
        }

        if (payload.requestedMessage === "DiagnosticsStatusNotification" || payload.requestedMessage === "FirmwareStatusNotification") {
          try {
            const response = [3, messageId, { status: "NotImplemented" }]
            socket.send(JSON.stringify(response));
            console.log("telah dikirim ", response)
          } catch (e) {
            console.error("failed to send DiagnosticsStatusNotification when triggermessage ", e);
            return
          }
        }
      }
    }

    // ============================================================== RESPONSE MESSAGE ==============================================================
    if (messageTypeId === 3 && pendingRequest[messageId]) {
      const responseData = message[2];

      const requestType = pendingRequest[messageId].type;
      if (requestType === "BootNotification") {
        console.log(responseData);
        if (responseData?.status === "Accepted") {
          logToConsole(
            `✅ BootNotification diterima. Mengatur interval ke ${responseData.interval} detik.`
          );
          stopPendingBootNotification(); // Hentikan jika ada interval pending berjalan
          statusNotification(1);
          statusNotification(2);
          startHeartbeat(responseData.interval);
        } else {
          logToConsole(
            `🔄 Status pending. Mengirim ulang BootNotification setiap 5 detik.`
          );
          startPendingBootNotification();
        }
      }

      if (requestType === "Authorize") {
        if (responseData?.idTagInfo?.status === "Accepted") {
          logToConsole("✅ Authorize berhasil.");
          console.log(pendingRequest[messageId])
          if (pendingRequest[messageId].connectorId === 1) {
            runningIdTagConnector1 = pendingRequest[messageId].connectorId
            pendingRequest[messageId].resolve(); // Panggil resolve untuk melanjutkan StartTransaction
          }

          if (pendingRequest[messageId].connectorId === 2) {
            runningIdTagConnector2 = pendingRequest[messageId].connectorId
            pendingRequest[messageId].resolve(); // Panggil resolve untuk melanjutkan StartTransaction
          }

          pendingRequest[messageId].reject("Authorize gagal, connectorId di dapat dari server tapi tidak sesuai dengan charge point");
        } else {
          logToConsole("❌ Authorize gagal.");
          pendingRequest[messageId].reject("Authorize gagal");
        }
        delete pendingRequest[messageId]; // Hapus setelah digunakan
      }

      if (requestType === "StartTransaction") {
        if (responseData.idTagInfo.status === "Accepted") {
          if (pendingRequest[messageId].connectorId == 1) {
            runningConnectorTransactionId1 = responseData.transactionId;
          }
          if (pendingRequest[messageId].connectorId == 2) {
            runningConnectorTransactionId2 = responseData.transactionId;
          }
          pendingRequest[messageId].resolve();
        } else {
          logToConsole("❌ StartTransaction tidak diterima central system.");
          pendingRequest[messageId].reject("StartTransaction gagal");
        }
      }
    }
  } catch (error) {
    console.log(error);
    logToConsole("⚠️ Gagal membaca pesan dari server.", error);
  }
}

// ============================================================== MESSAGE HANDLER END ==============================================================


function remoteStartTransaction(connectorId, idTag, messageId) {
  console.log("id tag nya adalah: ", idTag)
  console.log("connector id nya ", connectorId)
  if (!connectorId) {
    socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
  }

  if (connectorId === 1) {
    const status = document.getElementById("status1").value;
    if (status !== "Preparing" || chargingInterval1) {
      socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
      return;
    }
    socket.send(JSON.stringify([3, messageId, { status: "Accepted" }]))
    startTransaction(connectorId, idTag);
  }

  if (connectorId === 2) {
    const status = document.getElementById("status2").value;
    if (status !== "Preparing" || chargingInterval2) {
      socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]));
      return
    }
    socket.send(JSON.stringify([3, messageId, { status: "Accepted" }]))
    startTransaction(connectorId, idTag);
  }

  return
}

function remoteStopTransaction(transactionId, messageId, bool) {
  if (runningConnectorTransactionId1 === transactionId) {
    socket.send(JSON.stringify([3, messageId, { status: "Accepted" }]))
    stopTransaction(1, bool)
    return
  }

  if (runningConnectorTransactionId2 === transactionId) {
    socket.send(JSON.stringify([3, messageId, { status: "Accepted" }]))
    stopTransaction(2, bool)
    return
  }
  socket.send(JSON.stringify([3, messageId, { status: "Rejected" }]))
  return
}

// =============== BUTTON FUNCTION ===================
// KIRIM BOOT NOTIFICATION
function bootNotification() {
  const cpVendorValue = document.getElementById("cpVendor").value;
  const cpModelValue = document.getElementById("cpModel").value;

  const messageId = `bootNotification-${crypto.randomUUID()}`;
  const response = [
    2,
    messageId,
    "BootNotification",
    { chargePointVendor: cpVendorValue, chargePointModel: cpModelValue },
  ];
  pendingRequest[messageId] = {
    type: "BootNotification",
    timestamp: Date.now(),
  };
  socket.send(JSON.stringify(response));
  logToConsole(`📤 BootNotification terkirim: ${JSON.stringify(response)}`);
}


function authorize(connectorId, idTag) {
  return new Promise((resolve, reject) => {
    let idTagValue;

    if (!idTag) {
      if (connectorId === 1) {
        idTagValue = document.getElementById("idTag1").value;
      }
      if (connectorId === 2) {
        idTagValue = document.getElementById("idTag2").value;
      }
    }

    if (idTag) {
      idTagValue = idTag
    }
    if (!idTagValue) {
      logToConsole("⚠️ Masukkan idTag yang benar!");
      return reject("idTag kosong");
    }

    const messageId = `authorize-${crypto.randomUUID()}`;
    const response = [2, messageId, "Authorize", { idTag: idTagValue }];

    pendingRequest[messageId] = {
      type: "Authorize",
      timestamp: Date.now(),
      idTag: idTagValue,
      connectorId,
      resolve, // Simpan resolve untuk digunakan di handleIncomingMessage
      reject,
    };

    socket.send(JSON.stringify(response));
    logToConsole(`📤 Authorize terkirim: ${JSON.stringify(response)}`);

  });
}

function sendStartTransactionRequest(connectorId, idTag) {
  return new Promise((resolve, reject) => {
    if (!connectorId) {
      logToConsole("⚠️ Masukkan connectorId yang benar!");
      return reject("connectorId kosong");
    }
    console.log("ini id tag di send start transaction request: ", idTag)

    let idTagValue;
    let meterValueWh
    if (!idTag) {
      if (connectorId === 1) {
        const meterValue = parseFloat(document.getElementById("meterStart1").value) || 0;
        console.log("ini metervalue ", meterValue)
        meterValueWh = Math.round(meterValue * 1000);
        console.log("ini metervalue wh", meterValueWh)
        idTagValue = document.getElementById("idTag1").value;
      }
      if (connectorId === 2) {
        const meterValue = parseFloat(document.getElementById("meterStart2").value) || 0;
        meterValueWh = Math.round(meterValue * 1000);
        idTagValue = document.getElementById("idTag2").value;
      }
    }
    if (idTag) {
      idTagValue = idTag
      if (connectorId === 1) {
        const meterValue = parseFloat(document.getElementById("meterStart1").value) || 0;
        meterValueWh = Math.round(meterValue * 1000);
        runningIdTag1 = idTag
      }
      if (connectorId === 2) {
        const meterValue = parseFloat(document.getElementById("meterStart2").value) || 0;
        meterValueWh = Math.round(meterValue * 1000);
        runningIdTag1 = idTag
      }
    }
    if (!idTagValue) {
      logToConsole("⚠️ Masukkan idTag yang benar!");
      return reject("idTag kosong");
    }

    console.log("ini meter values ", meterValueWh)

    const messageId = `startTransaction-${crypto.randomUUID()}`;
    const response = [
      2,
      messageId,
      "StartTransaction",
      {
        connectorId,
        idTag: idTagValue,
        meterStart: meterValueWh,
        timestamp: new Date().toISOString(),
      },
    ];

    pendingRequest[messageId] = {
      type: "StartTransaction",
      connectorId: connectorId,
      timestamp: Date.now(),
      resolve,
      reject,
    };

    socket.send(JSON.stringify(response));
    logToConsole(`📤 StartTransaction terkirim: ${JSON.stringify(response)}`);
  });
}

function charging(connectorId) {
  if (!connectorId) {
    console.log("Tidak ada connectorId");
    return;
  }

  if (connectorId == 1) {
    let meterStartInput = document.getElementById("meterStart1");
    let meterStart = parseFloat(meterStartInput.value) || 0; // Ambil nilai awal dari input
    let voltage = parseInt(document.getElementById("voltage1").value); // Volt
    let current = parseInt(document.getElementById("ampere1").value);
    let power = voltage * current; // Watt (W)
    let energyPerSecond = power / 3600000; // kWh per detik (3600 detik * 1000)

    console.log("✅ Charging dimulai...");
    console.log("meterStartInput: ", meterStartInput);
    console.log("meterStart: ", meterStart);
    console.log("voltage: ", voltage);
    console.log("current: ", current);
    console.log("power: ", power);
    console.log("energyPerSecond: ", energyPerSecond);

    if (chargingInterval1) {
      clearInterval(chargingInterval1);
      console.log(
        "⚠️ Interval sebelumnya dihentikan untuk menghindari duplikasi."
      );
    }

    chargingInterval1 = setInterval(() => {
      meterStart += energyPerSecond; // Tambahkan energi yang dikonsumsi per detik
      meterStartInput.value = meterStart.toFixed(6); // Update UI dengan 6 angka desimal

      console.log(`🔋 Meter Start: ${meterStart.toFixed(6)} kWh`);
    }, 1000);
  }
  if (connectorId == 2) {
    let meterStartInput = document.getElementById("meterStart2");
    let meterStart = parseFloat(meterStartInput.value) || 0; // Ambil nilai awal dari input
    let voltage = parseInt(document.getElementById("voltage2").value); // Volt
    let current = parseInt(document.getElementById("ampere2").value);
    let power = voltage * current; // Watt (W)
    let energyPerSecond = power / 3600000; // kWh per detik (3600 detik * 1000)

    console.log("✅ Charging dimulai...");
    console.log("meterStartInput: ", meterStartInput);
    console.log("meterStart: ", meterStart);
    console.log("voltage: ", voltage);
    console.log("current: ", current);
    console.log("power: ", power);
    console.log("energyPerSecond: ", energyPerSecond);

    if (chargingInterval2) {
      clearInterval(chargingInterval2);
      console.log("⚠️ Interval sebelumnya dihentikan untuk menghindari duplikasi.");
    }

    chargingInterval2 = setInterval(() => {
      meterStart += energyPerSecond; // Tambahkan energi yang dikonsumsi per detik
      meterStartInput.value = meterStart.toFixed(6); // Update UI dengan 6 angka desimal

      console.log(`🔋 Meter Start: ${meterStart.toFixed(6)} kWh`);
    }, 1000);
  }
}

function setMeterValuesInterval(connectorId) {
  return setInterval(() => {
    sendMeterValuesRequest(connectorId)
  }, 10000);
}

function sendMeterValuesRequest(connectorId) {
  if (connectorId === 1) {
    const meterValue = parseFloat(document.getElementById("meterStart1").value) || 0;
    const meterValueWh = (meterValue * 1000).toFixed(3); // Ubah dari kWh ke Wh
    const messageId = `meterValues-${crypto.randomUUID()}`;
    // transactionId: runningConnectorTransactionId1,
    const response = [2, messageId, "MeterValues", { connectorId: connectorId, transactionId: runningConnectorTransactionId1, meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{ value: meterValueWh, context: "Sample.Periodic", format: "Raw", measurand: "Energy.Active.Import.Register", location: "Cable", unit: "Wh", },], },], },];
    logToConsole(`📤 MeterValue terkirim: ${JSON.stringify(response)}`);
    console.log(JSON.stringify(response));
    socket.send(JSON.stringify(response));
  }

  if (connectorId === 2) {
    const meterValue = parseFloat(document.getElementById("meterStart2").value) || 0;
    const meterValueWh = (meterValue * 1000).toFixed(3); // Ubah dari kWh ke Wh
    const messageId = `meterValues-${crypto.randomUUID()}`;
    // transactionId: runningConnectorTransactionId2,
    const response = [2, messageId, "MeterValues", { connectorId: connectorId, transactionId: runningConnectorTransactionId2, meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{ value: meterValueWh, context: "Sample.Periodic", format: "Raw", measurand: "Energy.Active.Import.Register", location: "Cable", unit: "Wh", },], },], },];
    logToConsole(`📤 MeterValue terkirim: ${JSON.stringify(response)}`);
    console.log(JSON.stringify(response));
    socket.send(JSON.stringify(response));
  }
}


function generate9DigitNumber() {
  return Math.floor(100_000_000 + Math.random() * 900_000_000);
}

function startTransaction(connectorId, idTag) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setConnectorStatus(connectorId, "Charging");
    charging(connectorId)

    if (connectorId === 1) {
      runningConnectorTransactionId1 = generate9DigitNumber()
      startTransactionButton1.disabled = true;
      stopTransactionButton1.disabled = false;
      setToPreparingButton1.disabled = true;

      if (meterValuesInterval1) {
        clearInterval(meterValuesInterval1);
        console.log("⚠️ MeterValues sebelumnya dihentikan untuk menghindari duplikasi.");
      }
      meterValuesInterval1 = setMeterValuesInterval(connectorId);
    }

    if (connectorId === 2) {
      runningConnectorTransactionId2 = generate9DigitNumber()
      startTransactionButton2.disabled = true;
      stopTransactionButton2.disabled = false;
      setToPreparingButton2.disabled = true;


      if (meterValuesInterval2) {
        clearInterval(meterValuesInterval2);
        console.log("⚠️ MeterValues sebelumnya dihentikan untuk menghindari duplikasi.");
      }

      meterValuesInterval2 = setMeterValuesInterval(connectorId)
    }
  }

  console.log("masuk start trasanction")
  authorize(connectorId, idTag)
    .then(() => {
      sendStartTransactionRequest(connectorId, idTag)
        .then(() => {
          logToConsole("🚀 Mulai StartTransaction setelah Authorize berhasil.");
          console.log("connectorId: ", connectorId);

          setConnectorStatus(connectorId, "Charging");
          charging(connectorId);
          if (connectorId === 1) {
            startTransactionButton1.disabled = true;
            stopTransactionButton1.disabled = false;
            setToPreparingButton1.disabled = true;

            if (meterValuesInterval1) {
              clearInterval(meterValuesInterval1);
              console.log("⚠️ MeterValues sebelumnya dihentikan untuk menghindari duplikasi.");
            }
            meterValuesInterval1 = setMeterValuesInterval(connectorId);
          }

          if (connectorId === 2) {
            startTransactionButton2.disabled = true;
            stopTransactionButton2.disabled = false;
            setToPreparingButton2.disabled = true;


            if (meterValuesInterval2) {
              clearInterval(meterValuesInterval2);
              console.log("⚠️ MeterValues sebelumnya dihentikan untuk menghindari duplikasi.");
            }

            meterValuesInterval2 = setMeterValuesInterval(connectorId)
          }
        })
        .catch((e) => {
          logToConsole(`⚠️ Gagal memulai StartTransaction: ${e}`);
        });
    })
    .catch((e) => {
      logToConsole(`⚠️ Gagal memulai StartTransaction: ${e}`);
    });
}

function stopTransaction(connectorId, remoteIdTagBool) {
  let meterValueWh;
  let idTag;
  let runningConnectorTransactionId;

  if (connectorId === 1) {
    clearInterval(chargingInterval1);
    clearInterval(meterValuesInterval1);
    chargingInterval1 = null; // Reset variabel agar bisa mulai lagi nanti
    meterValuesInterval1 = null
    startTransactionButton1.disabled = false;
    stopTransactionButton1.disabled = true;
    setToPreparingButton1.disabled = false

    setConnectorStatus(1, "Available")
    const meterValue = parseFloat(document.getElementById("meterStart1").value) || 0;

    meterValueWh = Math.round(meterValue * 1000); // Konversi ke Wh tanpa pembulatan aneh
    if (!remoteIdTagBool) {
      idTag = document.getElementById("idTag1").value
    } else {
      idTag = runningIdTag1;
    }

    runningConnectorTransactionId = runningConnectorTransactionId1

  }
  if (connectorId === 2) {
    clearInterval(chargingInterval2);
    clearInterval(meterValuesInterval2);
    chargingInterval2 = null; // Reset variabel agar bisa mulai lagi nanti
    meterValuesInterval2 = null
    startTransactionButton2.disabled = false;
    stopTransactionButton2.disabled = true;
    setToPreparingButton2.disabled = false
    setConnectorStatus(2, "Available")
    const meterValue = parseFloat(document.getElementById("meterStart2").value) || 0;

    meterValueWh = Math.round(meterValue * 1000); // Konversi ke Wh tanpa pembulatan aneh
    if (!remoteIdTagBool) {
      idTag = document.getElementById("idTag2").value
    } else {
      idTag = runningIdTag2
    }
    runningConnectorTransactionId = runningConnectorTransactionId2
  }

  const messageId = crypto.randomUUID();
  const response = [
    2,
    messageId,
    "StopTransaction",
    {
      transactionId: runningConnectorTransactionId,
      timestamp: new Date().toISOString(),
      meterStop: meterValueWh,
      reason: 'Local',
      transactionData: [],
      idTag: idTag
    }
  ];
  socket.send(JSON.stringify(response))
  console.log(JSON.stringify(response));
}

function setConnectorStatus(connectorId, status) {
  if (!connectorId || !status) {
    console.error("connectorId dan status harus diisi");
    return;
  }
  if (connectorId == 1) {
    const statusInput = document.getElementById("status1");
    statusInput.value = status;
  }
  if (connectorId == 2) {
    const statusInput = document.getElementById("status2");
    statusInput.value = status;
  }
  statusNotification(connectorId);
  logToConsole(`✅ Set connector ${connectorId} to ${status}`);
}

function statusNotification(connectorId) {
  if (!connectorId) {
    console.error(
      "FUNCTION: statusNotification, connectorId tidak boleh kosong"
    );
    return;
  }
  const messageId = `statusNotification-${crypto.randomUUID()}`;
  pendingRequest[messageId] = {
    type: "StatusNotification",
    timestamp: Date.now(),
  };
  if (connectorId == 1) {
    const status1Value = document.getElementById("status1").value;
    const errorCode1Value = document.getElementById("errorCode1").value;
    const response = [
      2,
      messageId,
      "StatusNotification",
      {
        connectorId: parseInt(connectorId),
        errorCode: errorCode1Value,
        status: status1Value,
      },
    ];
    if (!socket) {
      return
    }
    socket.send(JSON.stringify(response));
    console.log(response);
    logToConsole(`📤 StatusNotification terkirim: ${JSON.stringify(response)}`);
  }
  if (connectorId == 2) {
    const status2Value = document.getElementById("status2").value;
    const errorCode2Value = document.getElementById("errorCode2").value;
    const response = [
      2,
      messageId,
      "StatusNotification",
      {
        connectorId: parseInt(connectorId),
        errorCode: errorCode2Value,
        status: status2Value,
      },
    ];
    socket.send(JSON.stringify(response));
    console.log(response);
    logToConsole(`📤 StatusNotification terkirim: ${JSON.stringify(response)}`);
  }

  if (connectorId !== 1 && connectorId !== 2) {
    console.log("input connector id salah");
    return;
  }
}

function disconnectWs() {
  socket.close(1000, "Close by user");
}


// Custom WebSocket URL & Card Id
// Authorize
// BootNotification
// heartbeat sesuai interval
// StatusNotification setiap BootNotification
// logging interface
// custom cp vendor / cp model
// Auto reconnecting when disconnect
// Auto send bootnotification when bootnotification response status is Pending
