const fs = require('fs');
const path = require('path');

async function testPort(port) {
  console.log(`Testing port ${port}...`);
  try {
    // 1. PIN Login to get token
    const loginRes = await fetch(`http://localhost:${port}/api/auth/pin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "0000" }) // Admin default PIN
    });

    if (!loginRes.ok) {
      console.log(`Port ${port}: Login failed. Status: ${loginRes.status}`);
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log(`Port ${port}: Login successful! Token: ${token ? "EXISTS" : "MISSING"}`);

    if (!token) return;

    // 2. Fetch sales summary
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = thirtyDaysAgo.toISOString().split("T")[0];
    const to = today;

    const summaryRes = await fetch(`http://localhost:${port}/api/reports/sales-summary?transactionType=all&from=${from}&to=${to}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      console.log(`Port ${port} Sales Summary:`, JSON.stringify(summaryData, null, 2));
    } else {
      console.log(`Port ${port}: Failed to fetch summary. Status: ${summaryRes.status}`);
    }

  } catch (e) {
    console.log(`Port ${port} error:`, e.message);
  }
}

async function run() {
  for (let port = 3847; port <= 3850; port++) {
    await testPort(port);
  }
}

run();
