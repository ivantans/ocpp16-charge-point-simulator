// Tunggu sampai DOM sepenuhnya dimuat sebelum mengakses elemen
document.addEventListener("DOMContentLoaded", function () {
  // DEFAULT EVENT BUTTON
  const connectButton = document.getElementById("connectButton");
  const bootNotificationButton = document.getElementById("bootNotificationButton");
  const statusNotificationButton1 = document.getElementById("statusNotificationButton1");
  const statusNotificationButton2 = document.getElementById("statusNotificationButton2");
  const startTransactionButton1 = document.getElementById("startTransactionButton1");
  const startTransactionButton2 = document.getElementById("startTransactionButton2");
  const authorizeButton1 = document.getElementById("authorizeButton1")
  const authorizeButton2 = document.getElementById("authorizeButton2")
  const setToPreparingButton1 = document.getElementById("setToPreparingButton1");
  const setToPreparingButton2 = document.getElementById("setToPreparingButton2");
  // Set default state
  connectButton.disabled = false;
  bootNotificationButton.disabled = true;
  statusNotificationButton1.disabled = true;
  statusNotificationButton2.disabled = true;
  startTransactionButton1.disabled = false;
  startTransactionButton2.disabled = false;
  authorizeButton1.disabled = true
  authorizeButton2.disabled = true
  setToPreparingButton1.disabled = true
  setToPreparingButton2.disabled = true

  // Fungsi untuk toggle button ON/OFF
  window.toggleButtons = function (connected) {
    connectButton.disabled = connected;
    authorizeButton1.disabled = !connected
    authorizeButton2.disabled = !connected
    bootNotificationButton.disabled = !connected;
    statusNotificationButton1.disabled = !connected;
    statusNotificationButton2.disabled = !connected;
    startTransactionButton1.disabled = !connected;
    startTransactionButton2.disabled = !connected;
    setToPreparingButton1.disabled = !connected;
    setToPreparingButton2.disabled = !connected;
  };
});
