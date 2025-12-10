// backend/src/utils/mockBank.js

export async function mockBankCharge({ amount, user }) {
  // Basit validasyon
  if (typeof amount !== "number" || amount <= 0) {
    return {
      success: false,
      error: "Invalid amount",
    };
  }

  // 300–800 ms arası random bekleme
  const delayMs = 300 + Math.floor(Math.random() * 501); // 300–800

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // Rastgele 5 haneli sayı (00000–99999)
  const randomFiveDigits = String(Math.floor(Math.random() * 100000)).padStart(
    5,
    "0"
  );

  return {
    success: true,
    transactionId: "BANKTX-" + Date.now(),
    authCode: "OK" + randomFiveDigits,
  };
}
