require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let dbWarnShown = false;

const insertTelemetrySql = `
INSERT INTO telemetry_packets (
  source, temperature, pressure, altitude, humidity, battery_voltage, battery_current, power,
  gas_resistance, battery, latitude, longitude, gnss_altitude, packet_count,
  primary_parachute, secondary_parachute,
  accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, mag_x, mag_y, mag_z,
  signal, data_rate
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,
  $9,$10,$11,$12,$13,$14,
  $15,$16,
  $17,$18,$19,$20,$21,$22,$23,$24,$25,
  $26,$27
);
`;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const io = require('socket.io')(3000, {
  cors: { origin: "*" },
  transports: ['websocket'],
});

const temperatureValues = [22.98, 23.00, 23.02];
const pressureValues = [1004.9, 1005.0, 1005.1];
const altitudeValues = [319.9, 320.0, 320.1];
const humidityValues = [33.9, 34.0, 34.1];
const batteryVoltageValues = [3.94, 3.95, 3.96];
const batteryCurrentValues = [913, 915, 917];
const gasResistanceValues = [7458, 7460, 7462];
const batteryValues = [93, 94, 95];
const latitudeValues = [13.733328, 13.733330, 13.733332];
const longitudeValues = [80.204928, 80.204930, 80.204932];


let currentTime = 0;
const flightDuration = 600; // 10 minutes in seconds
const maxAltitude = 700; // maximum altitude in meters
const launchPadAltitude = 100; // starting altitude
let packetCount = 0;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Function to simulate realistic GNSS altitude based on flight phase
function simulateGNSSAltitude() {
  currentTime++;
  
  // Reset time if we reach the end of the flight duration
  if (currentTime >= flightDuration) {
    currentTime = 0;
  }

  // Flight phases
  if (currentTime < 120) { // Launch and ascent (0-2 minutes)
    return launchPadAltitude + (maxAltitude - launchPadAltitude) * (currentTime / 120) + (Math.random() * 5 - 2.5);
  } else if (currentTime < 240) { // Float phase (2-4 minutes)
    return maxAltitude + (Math.random() * 10 - 5);
  } else if (currentTime < 540) { // Descent phase (4-9 minutes)
    const timeInDescent = currentTime - 240;
    const descentProgress = timeInDescent / 300;
    return maxAltitude - (maxAltitude - launchPadAltitude) * (descentProgress * descentProgress) + (Math.random() * 5 - 2.5);
  } else { // Landing phase (9-10 minutes)
    return launchPadAltitude + (Math.random() * 2 - 1);
  }
}

setInterval(() => {
  // Increment packet count
  packetCount++;
  
  // Simulate signal strength in dBm (-120 to -10)
  const signal = (Math.random() * 110 - 120).toFixed(0);
  // Simulate data rate in kB/s (0.5 to 2.0)
  const data_rate = (Math.random() * 1.5 + 0.5).toFixed(2);
  
  // Get battery values
  const voltage = pick(batteryVoltageValues);
  const current = pick(batteryCurrentValues);
  
  // Calculate power (P = V * I), convert current from mA to A
  const power = (voltage * current / 1000).toFixed(2); // Watts
  
  // Get simulated GNSS altitude
  const gnssAltitude = simulateGNSSAltitude().toFixed(1);
  
  const packet = {
    team_id: "2024ASI-052",
    timestamp: Date.now(),
    temperature: pick(temperatureValues).toFixed(2),
    pressure: pick(pressureValues).toFixed(2),
    altitude: pick(altitudeValues).toFixed(2),
    humidity: pick(humidityValues).toFixed(2),
    voltage: voltage.toFixed(2),
    battery_current: current.toFixed(0),
    power: power, // Added power calculation
    gas_resistance: pick(gasResistanceValues).toFixed(0),
    battery: pick(batteryValues).toFixed(0),
    latitude: pick(latitudeValues).toFixed(6),
    longitude: pick(longitudeValues).toFixed(6),
    gnss_altitude: gnssAltitude, // Added GNSS altitude
    packet_count: packetCount,   // Added packet count
    primary_parachute: "DEPLOYED",
    secondary_parachute: "NOT DEPLOYED",
    accel_x: (Math.random() * 2 - 1).toFixed(3), // -1 to 1 m/s²
    accel_y: (Math.random() * 2 - 1).toFixed(3),
    accel_z: (9.8 + Math.random() * 0.4 - 0.2).toFixed(3), // ~9.8 m/s²
    gyro_x: (Math.random() * 20 - 10).toFixed(3), // -10 to 10 °/s
    gyro_y: (Math.random() * 20 - 10).toFixed(3),
    gyro_z: (Math.random() * 20 - 10).toFixed(3),
    mag_x: (Math.random() * 100 - 50).toFixed(3), // -50 to 50 μT
    mag_y: (Math.random() * 100 - 50).toFixed(3),
    mag_z: (Math.random() * 100 - 50).toFixed(3),
    signal,
    data_rate
  };

  io.emit("new_data", packet);

  // Save to DB (best-effort)
  if (!pool) {
    if (!dbWarnShown) {
      console.log('DATABASE_URL not set; simulator will not save to DB.');
      dbWarnShown = true;
    }
  } else {
    const dbValues = [
      'sim',
      toNum(packet.temperature),
      toNum(packet.pressure),
      toNum(packet.altitude),
      toNum(packet.humidity),
      toNum(packet.battery_voltage ?? packet.voltage),
      toNum(packet.battery_current),
      toNum(packet.power),
      toNum(packet.gas_resistance),
      toNum(packet.battery),
      toNum(packet.latitude),
      toNum(packet.longitude),
      toNum(packet.gnss_altitude),
      toNum(packet.packet_count),
      packet.primary_parachute ?? null,
      packet.secondary_parachute ?? null,
      toNum(packet.accel_x),
      toNum(packet.accel_y),
      toNum(packet.accel_z),
      toNum(packet.gyro_x),
      toNum(packet.gyro_y),
      toNum(packet.gyro_z),
      toNum(packet.mag_x),
      toNum(packet.mag_y),
      toNum(packet.mag_z),
      toNum(packet.signal),
      toNum(packet.data_rate),
    ];

    pool.query(insertTelemetrySql, dbValues).catch((err) => {
      console.error('SIM DB insert error:', err.message);
    });
  }
}, 1000);
