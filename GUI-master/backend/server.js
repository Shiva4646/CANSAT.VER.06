const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*" },
  transports: ['websocket'],
});
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const logsDirectory = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

const flightLogColumns = [
  'esp_ms',
  'packet_length',
  'team_id',
  'time_s',
  'packet_count',
  'altitude_m',
  'pressure_pa',
  'temp_c',
  'volt_v',
  'gnss_time',
  'latitude',
  'longitude',
  'gnss_alt_m',
  'sats',
  'ax',
  'ay',
  'az',
  'roll',
  'pitch',
  'spin_rate',
  'flight_state',
  'mx',
  'my',
  'mz',
  'rssi_dbm',
  'snr_db',
];
const flightLogFilename = path.join(logsDirectory, `flight_log_${Date.now()}.csv`);
const flightLogStream = fs.createWriteStream(flightLogFilename, { flags: 'a' });
flightLogStream.write(`${flightLogColumns.join(',')}\r\n`);
flightLogStream.on('error', (error) => {
  console.error('Telemetry log stream error:', error.message);
});

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const frontendDir = path.join(__dirname, '..', 'frontend');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.static(frontendDir));
app.use('/node_modules', express.static(path.join(frontendDir, 'node_modules')));
app.use('/Backend', express.static(__dirname));

app.get('/api/download-log', (req, res) => {
  res.download(flightLogFilename, (error) => {
    if (error && !res.headersSent) {
      res.status(500).send('Unable to download the flight log.');
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

server.listen(3000, () => {
  console.log('CanSat Ground Station Server Started on port 3000...');
  console.log(`Writing telemetry to ${flightLogFilename}`);
  console.log('Waiting for telemetry data...');
});

const defaultSerialPath = process.platform === 'win32' ? 'COM8' : '/dev/ttyUSB0';
const serialPath = process.env.SERIAL_PORT || defaultSerialPath;
const serialBaudRate = 115200;
const validUplinkCommands = new Set([
  'BOOT',
  'HC',
  'CALC',
  'TX_ON',
  'TX_OFF',
  'STATUS',
  'RESET',
  'RW',
]);
const flightStateNames = [
  'BOOT',
  'TEST',
  'LAUNCH_PAD',
  'ASCENT',
  'DEPLOY',
  'DESCENT',
  'AEROBREAK_RELEASE',
  'IMPACT',
];

let port = null;
let parser = null;
let simulatorRunning = false;

// Simulator data generation (fallback when serial port unavailable)
let currentTime = 0;
const flightDuration = 600;
const maxAltitude = 700;
const launchPadAltitude = 100;
let packetCount = 0;

function simulateGNSSAltitude() {
  currentTime++;
  if (currentTime >= flightDuration) {
    currentTime = 0;
  }
  if (currentTime < 120) {
    return launchPadAltitude + (maxAltitude - launchPadAltitude) * (currentTime / 120) + (Math.random() * 5 - 2.5);
  } else if (currentTime < 240) {
    return maxAltitude + (Math.random() * 10 - 5);
  } else if (currentTime < 540) {
    const timeInDescent = currentTime - 240;
    const descentProgress = timeInDescent / 300;
    return maxAltitude - (maxAltitude - launchPadAltitude) * (descentProgress * descentProgress) + (Math.random() * 5 - 2.5);
  } else {
    return launchPadAltitude + (Math.random() * 2 - 1);
  }
}

function startSimulator() {
  if (simulatorRunning) return;
  simulatorRunning = true;
  console.log('Starting simulator mode...');
  
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

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  setInterval(() => {
    packetCount++;
    const signal = (Math.random() * 110 - 120).toFixed(0);
    const data_rate = (Math.random() * 1.5 + 0.5).toFixed(2);
    const voltage = pick(batteryVoltageValues);
    const current = pick(batteryCurrentValues);
    const power = (voltage * current / 1000).toFixed(2);
    const gnssAltitude = simulateGNSSAltitude().toFixed(1);
    
    const packet = {
      team_id: "2024ASI-052",
      timestamp: packetCount,
      temperature: pick(temperatureValues).toFixed(2),
      pressure: pick(pressureValues).toFixed(2),
      altitude: pick(altitudeValues).toFixed(2),
      humidity: pick(humidityValues).toFixed(2),
      battery_voltage: voltage.toFixed(2),
      battery_current: current.toFixed(0),
      power: power,
      gas_resistance: pick(gasResistanceValues).toFixed(0),
      battery: pick(batteryValues).toFixed(0),
      latitude: pick(latitudeValues).toFixed(6),
      longitude: pick(longitudeValues).toFixed(6),
      gnss_altitude: gnssAltitude,
      packet_count: packetCount,
      primary_parachute: "DEPLOYED",
      secondary_parachute: "NOT DEPLOYED",
      accel_x: (Math.random() * 2 - 1).toFixed(3),
      accel_y: (Math.random() * 2 - 1).toFixed(3),
      accel_z: (9.8 + Math.random() * 0.4 - 0.2).toFixed(3),
      gyro_x: (Math.random() * 20 - 10).toFixed(3),
      gyro_y: (Math.random() * 20 - 10).toFixed(3),
      gyro_z: (Math.random() * 20 - 10).toFixed(3),
      mag_x: (Math.random() * 100 - 50).toFixed(3),
      mag_y: (Math.random() * 100 - 50).toFixed(3),
      mag_z: (Math.random() * 100 - 50).toFixed(3),
      signal,
      data_rate
    };

    io.emit("new_data", packet);
  }, 1000);
}

function handleSerialData(data) {
  const line = data.toString().replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!line) return;

  if (line.startsWith('ACK,046,')) {
    console.log('<<< ACK RECEIVED FROM ESP32:', line);
  }

  const ackMatch = line.match(
    /^ACK,046,(BOOT|HC|CALC|TX_ON|TX_OFF|STATUS|RESET|RW),(OK|ACCEPTED|REJECTED)$/,
  );
  if (ackMatch) {
    const [, command, status] = ackMatch;
    io.emit('command_ack', { status, command });
    io.emit('uplink_status', {
      success: status === 'OK' || status === 'ACCEPTED',
      status,
      command,
    });
    return;
  }

  const rxMatch = line.match(/(?:^|\s)RX,/);
  if (rxMatch) {
    const rxStart = line.indexOf('RX,', rxMatch.index);
    const values = line.slice(rxStart).split(',').map((value) => value.trim());

    if (values.some((value) => /^(ACK|NAK|CMD)$/i.test(value))) {
      console.log('<<< SYSTEM MESSAGE FROM ESP32:', line);
      io.emit('command_response', { response: line });
      return;
    }

    if (values.length !== 21 || values[3] !== '046') {
      console.warn('Ignoring malformed RX telemetry packet:', line);
      return;
    }

    const stateNumber = Number(values[17]);
    const parseOptionalVector = (value, length) => {
      if (!value) return Array(length).fill(0);

      const components = value.split(/[;|]/).map((component) => component.trim());
      if (components.length > length) return null;

      const parsed = components.map((component) => component ? Number(component) : 0);
      if (!parsed.every(Number.isFinite)) return null;

      return [...parsed, ...Array(length - parsed.length).fill(0)];
    };
    const acceleration = parseOptionalVector(values[15], 5);
    const magnetometer = parseOptionalVector(values[18], 3);
    const spinRate = Number(values[16]);
    const rssi = Number(values[19]);
    const snr = Number(values[20]);
    const missionTimeSeconds = Number(values[4]);
    const packetCountValue = Number(values[5]);
    const altitude = Number(values[6]);
    const pressure = Number(values[7]);
    const temperature = Number(values[8]);
    const voltage = Number(values[9]);
    const gnssTime = values[10];
    const latitude = Number(values[11]);
    const longitude = Number(values[12]);
    const gnssAltitude = Number(values[13]);
    const gnssSats = Number(values[14]);

    if (
      !Number.isInteger(stateNumber) ||
      stateNumber < 0 ||
      stateNumber >= flightStateNames.length ||
      !Number.isFinite(Number(values[1])) ||
      !Number.isFinite(Number(values[2])) ||
      !Number.isInteger(packetCountValue) ||
      !Number.isInteger(gnssSats) ||
      !acceleration ||
      !magnetometer ||
      ![
        ...acceleration,
        ...magnetometer,
        spinRate,
        rssi,
        snr,
        missionTimeSeconds,
        altitude,
        pressure,
        temperature,
        voltage,
        latitude,
        longitude,
        gnssAltitude,
      ].every(Number.isFinite)
    ) {
      console.warn('Ignoring invalid RX telemetry values:', line);
      return;
    }

    const [accel_x, accel_y, accel_z, roll, pitch] = acceleration;
    const [mag_x, mag_y, mag_z] = magnetometer;
    const timestampMs = Number(values[1]);
    const parsedTelemetry = {
      team_id: values[3],
      mission_time: missionTimeSeconds,
      packet_count: packetCountValue,
      altitude,
      pressure,
      temperature,
      voltage,
      gnss_time: gnssTime,
      latitude,
      longitude,
      gnss_altitude: gnssAltitude,
      gnss_sats: gnssSats,
      timestamp: missionTimeSeconds,
      packet_timestamp_ms: timestampMs,
      packet_length: Number(values[2]),
      acceleration,
      accel_x,
      accel_y,
      accel_z,
      roll,
      pitch,
      spin_rate: spinRate,
      gyro_spin_rate: spinRate,
      flight_state: flightStateNames[stateNumber],
      flight_state_id: stateNumber,
      magnetometer,
      mag_x,
      mag_y,
      mag_z,
      rssi,
      signal: rssi,
      snr,
    };

    if (process.env.DEBUG_TELEMETRY === 'true') {
      console.log('Parsed RX telemetry:', parsedTelemetry);
    }
    const csvRow = [
      values[1],
      values[2],
      values[3],
      ...values.slice(4, 15),
      ...acceleration,
      values[16],
      values[17],
      ...magnetometer,
      values[19],
      values[20],
    ];
    flightLogStream.write(`${csvRow.map(escapeCsvValue).join(',')}\r\n`);
    io.emit('new_data', parsedTelemetry);
    io.emit('raw_data', line);
    return;
  }

  const commandResponsePrefixes = [
    'BOOT,',
    'HC,',
    'CALC,',
    'TX,',
    'STATUS,',
    'RESET,',
  ];
  if (commandResponsePrefixes.some((prefix) => line.startsWith(prefix))) {
    console.log('<<< COMMAND RESPONSE FROM ESP32:', line);
    io.emit('command_response', { response: line });
    return;
  }

  if (line.includes('team_id')) {
    return;
  }

  if (line.startsWith('#')) {
    return;
  }

  if (line.split(',').length < 15) {
    return;
  }

  try {
    const rawData = line.trim();
    console.log('Raw data received:', rawData);

    // Support multiple known CSV orders. Primary (piFieldsA) is the expected
    // order; fallback (piFieldsB) covers older simulator format (temperature-first).
    const piFieldsA = [
      "team_id",
      "timestamp",
      "packet_count",
      "altitude",
      "pressure",
      "temperature",
      "voltage",
      "gnss_time",
      "latitude",
      "longitude",
      "gnss_altitude",
      "acceleration",
      "gyroscope",
      "magnetometer",
      "flight_state",
    ];

    const piFieldsB = [
      // older simulator order where telemetry begins with temperature
      "team_id",
      "timestamp",
      "temperature",
      "pressure",
      "altitude",
      "humidity",
      "battery_voltage",
      "battery_current",
      "power",
      "gas_resistance",
      "battery",
      "latitude",
      "longitude",
      "gnss_altitude",
      "packet_count",
      // extras: parachutes, accel/gyro/mag, signal, data_rate
      "primary_parachute",
      "secondary_parachute",
      "accel_x",
      "accel_y",
      "accel_z",
      "gyro_x",
      "gyro_y",
      "gyro_z",
      "mag_x",
      "mag_y",
      "mag_z",
      "signal",
      "data_rate",
    ];

    const values = rawData.split(",");

    function mapFields(values, fields) {
      const out = {};
      fields.forEach((k, i) => {
        if (i < values.length && values[i] !== undefined) out[k] = values[i];
      });
      return out;
    }

    // Try primary mapping first, then fallback mapping if temperature or altitude missing
    let telemetryData = mapFields(values, piFieldsA);
    const looksValidA = telemetryData.temperature !== undefined || telemetryData.altitude !== undefined;
    if (!looksValidA) {
      const tryB = mapFields(values, piFieldsB);
      const looksValidB = tryB.temperature !== undefined || tryB.altitude !== undefined;
      if (looksValidB) telemetryData = tryB;
    }
      if (!telemetryData.humidity) {
        telemetryData.humidity = (34.0 + Math.random() * 0.2 - 0.1).toFixed(1); // 33.9-34.1
      }
      if (!telemetryData.battery_current) {
        telemetryData.battery_current = (915 + Math.random() * 4 - 2).toFixed(0); // 913-917 mA
      }
      if (!telemetryData.gas_resistance) {
        telemetryData.gas_resistance = (7460 + Math.random() * 4 - 2).toFixed(0); // 7458-7462 Ω
      }
      if (!telemetryData.primary_parachute) {
        telemetryData.primary_parachute = "DEPLOYED";
      }
      if (!telemetryData.secondary_parachute) {
        telemetryData.secondary_parachute = "NOT DEPLOYED";
      }
      if (!telemetryData.signal) {
        telemetryData.signal = (Math.random() * 110 - 120).toFixed(0); // -120 to -10 dBm
      }
      if (!telemetryData.data_rate) {
        telemetryData.data_rate = (Math.random() * 1.5 + 0.5).toFixed(2); // 0.5-2.0 kB/s
      }

      if (!telemetryData.magnetometer) {
        const mag_x = (Math.random() * 100 - 50).toFixed(3);
        const mag_y = (Math.random() * 100 - 50).toFixed(3);
        const mag_z = (Math.random() * 100 - 50).toFixed(3);
        telemetryData.magnetometer = `${mag_x}|${mag_y}|${mag_z}`;
      }     
 
      if (telemetryData.acceleration) {
        const [accel_x, accel_y, accel_z] = telemetryData.acceleration.split('|').map(parseFloat);
        telemetryData.accel_x = accel_x;
        telemetryData.accel_y = accel_y;
        telemetryData.accel_z = accel_z;
      }
      if (telemetryData.gyroscope) {
        const [gyro_x, gyro_y, gyro_z] = telemetryData.gyroscope.split('|').map(parseFloat);
        telemetryData.gyro_x = gyro_x;
        telemetryData.gyro_y = gyro_y;
        telemetryData.gyro_z = gyro_z;
      }
      if (telemetryData.magnetometer) {
        const [mag_x, mag_y, mag_z] = telemetryData.magnetometer.split('|').map(parseFloat);
        telemetryData.mag_x = mag_x;
        telemetryData.mag_y = mag_y;
        telemetryData.mag_z = mag_z;
      }

      if (telemetryData.battery_voltage && telemetryData.battery_current) {
        telemetryData.power = (parseFloat(telemetryData.battery_voltage) * parseFloat(telemetryData.battery_current) / 1000).toFixed(2); // Power in Watts
      }

      telemetryData.primary_parachute = "DEPLOYED"; 
      telemetryData.secondary_parachute = "NOT DEPLOYED"; 
      
      if (!telemetryData.signal) {
        telemetryData.signal = "-120"; 
      }
      if (!telemetryData.data_rate) {
        telemetryData.data_rate = "0.0";
      }

      if (process.env.DEBUG_TELEMETRY === 'true') {
        console.log('Parsed telemetry:', telemetryData);
      }
      io.emit("new_data", telemetryData);
      io.emit("raw_data", rawData);
  } catch (error) {
    console.error('Data parse error:', error);
    io.emit("data_warning", { message: "Data parse error", error: error.toString(), raw: data, timestamp: Date.now() });
    io.emit("raw_data", data);
    
  }
}

function startSerialBridge() {
  try {
    port = new SerialPort({
      path: serialPath,
      baudRate: serialBaudRate,
      autoOpen: false
    });

    port.on('error', (err) => {
      console.error('Serial port error:', err.message);
      io.emit('data_warning', {
        message: 'Serial port error',
        error: err.message,
        timestamp: Date.now()
      });
    });

    port.open((err) => {
      if (err) {
        console.error(`Failed to open serial port ${serialPath}:`, err.message);
        console.error('Set SERIAL_PORT env var if your device path is different.');
        console.log('Falling back to simulator mode...');
        startSimulator();
        return;
      }

      parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      parser.on('error', (parseErr) => {
        console.error('Serial parser error:', parseErr.message);
      });

      parser.on('data', handleSerialData);

      console.log(`Serial port connected: ${serialPath} @ ${serialBaudRate}`);
    });
  } catch (err) {
    console.error('Serial initialization failed:', err.message);
  }
}

startSerialBridge();

io.on('connection', (socket) => {
  console.log('GUI client connected');
  socket.emit('serial_config', {
    port: port?.path || serialPath,
    baudRate: port?.baudRate || serialBaudRate
  });

  socket.on('uplink_command', (payload) => {
    const textString = payload?.text_string;
    console.log(`Received from React: ${textString}`);

    if (typeof textString !== 'string' || !port || !port.isOpen || !parser) {
      console.error('Cannot send uplink: serial port is not ready or payload is invalid.');
      socket.emit('uplink_status', { success: false });
      return;
    }

    const command = textString.trim().toUpperCase();
    if (!validUplinkCommands.has(command)) {
      console.error(`Rejected invalid uplink command: ${command}`);
      socket.emit('uplink_status', { success: false, error: 'Invalid command' });
      return;
    }

    const formattedCommand = `CMD,046,${command}\n`;
    console.log('>>> RECEIVED FROM UI & SENDING TO ESP32:', formattedCommand);
    port.write(formattedCommand, (err) => {
      if (err) {
        console.error('Error sending uplink over serial:', err.message);
        socket.emit('uplink_status', { success: false, command });
        return;
      }
    });
  });

  socket.on('send_command', (commandData) => {
    try {
      console.log('Received command from GUI:', commandData);

      if (!port || !port.isOpen) {
        socket.emit('command_error', { error: 'Serial port is not open' });
        return;
      }
      
      const commandString = `CMD:${commandData.type}:${commandData.value}\n`;
      
      port.write(commandString, (err) => {
        if (err) {
          console.error('Error sending command to Pi:', err);
          socket.emit('command_error', { error: err.message });
        } else {
          console.log('Command sent to Pi:', commandString.trim());
          socket.emit('command_sent', { command: commandString.trim(), timestamp: Date.now() });
        }
      });
    } catch (error) {
      console.error('Error processing command:', error);
      socket.emit('command_error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('GUI client disconnected');
  });
});
 
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);

  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
  });