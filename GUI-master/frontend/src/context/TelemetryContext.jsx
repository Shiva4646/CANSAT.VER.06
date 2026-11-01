import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'

const TelemetryContext = createContext(null)

const initialTelemetryState = {
  teamName: 'SAIRAM STRATOS',
  teamId: '046',
  rssi: -50,
  snr: 0,
  flightState: '--',
  flightStateId: null,
  spinRate: 0,
  motionState: 'TUMBLING',
  batteryVoltage: 0,
  gasResistance: 0,
  humidity: 0,
  gnssLat: 0,
  gnssLon: 0,
  gnssAlt: 0,
  gnssTime: '--',
  primaryParachute: '--',
  secondaryParachute: '--',
  port: 'COM 8',
  baudRate: 115200,
  packetCount: 0,
  telemetry: {
    altitude: 0,
    pressure: 0,
    temperature: 0,
    voltage: 0,
  },
  gyroscope: { pitch: 0, roll: 0, yaw: 0 },
  gps: { latitude: 0, longitude: 0, satellites: 0 },
  accelerometer: { x: 0, y: 0, z: 0 },
  magnetometer: { x: 0, y: 0, z: 0 },
  missionTimestamp: null,
  missionTime: '00:00:00',
  history: [],
  communication: {
    packetCount: 0,
    signal: -50,
    dataRate: 0,
    rawData: '',
    connected: false,
    serialConfig: { port: 'COM 8', baudRate: 115200 },
  },
}

const toNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const firstDefined = (...values) => values.find((value) => value !== undefined)

const formatMissionTime = (value) => {
  if (typeof value === 'string' && value.trim()) return value
  const seconds = toNumber(value, 0)
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), Math.floor(seconds % 60)]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

const updateTelemetryState = (previous, data) => {
  const altitude = toNumber(firstDefined(data.altitude, data.alt), previous.telemetry.altitude)
  const pressure = toNumber(data.pressure, previous.telemetry.pressure)
  const temperature = toNumber(firstDefined(data.temperature, data.temp), previous.telemetry.temperature)
  const voltage = toNumber(firstDefined(data.battery_voltage, data.voltage), previous.batteryVoltage)
  const latitude = toNumber(firstDefined(data.latitude, data.lat, data.gnss_lat), previous.gnssLat)
  const longitude = toNumber(firstDefined(data.longitude, data.lon, data.gnss_lon), previous.gnssLon)
  const gnssAlt = toNumber(firstDefined(data.gnss_altitude, data.gnssAlt), previous.gnssAlt)
  const packetCount = toNumber(
    firstDefined(data.packet_count, data.packetCount),
    previous.packetCount + 1,
  )
  const next = {
    ...previous,
    teamName: data.team_name ?? data.teamName ?? previous.teamName,
    teamId: data.team_id ?? data.teamId ?? previous.teamId,
    rssi: toNumber(firstDefined(data.rssi, data.signal), previous.rssi),
    snr: toNumber(data.snr, previous.snr),
    flightState: data.flight_state ?? data.flightState ?? previous.flightState,
    flightStateId: toNumber(
      firstDefined(data.flight_state_id, data.flightStateId),
      previous.flightStateId,
    ),
    spinRate: toNumber(
      firstDefined(data.spin_rate, data.gyro_spin_rate, data.spinRate),
      previous.spinRate,
    ),
    motionState:
      data.motion_state ??
      data.motionState ??
      data.flight_state ??
      data.flightState ??
      previous.motionState,
    batteryVoltage: voltage,
    gasResistance: toNumber(
      firstDefined(data.gas_resistance, data.gasResistance),
      previous.gasResistance,
    ),
    humidity: toNumber(data.humidity, previous.humidity),
    gnssLat: latitude,
    gnssLon: longitude,
    gnssAlt,
    primaryParachute: data.primary_parachute ?? data.primaryParachute ?? previous.primaryParachute,
    secondaryParachute: data.secondary_parachute ?? data.secondaryParachute ?? previous.secondaryParachute,
    port: data.port ?? data.serial_port ?? previous.port,
    baudRate: toNumber(data.baudRate ?? data.baud_rate, previous.baudRate),
    packetCount,
    missionTimestamp: toNumber(
      firstDefined(data.mission_time, data.timestamp),
      previous.missionTimestamp ?? 0,
    ),
    telemetry: { altitude, pressure, temperature, voltage },
    gyroscope: {
      pitch: toNumber(firstDefined(data.pitch, data.gyro_y), previous.gyroscope.pitch),
      roll: toNumber(firstDefined(data.roll, data.gyro_x), previous.gyroscope.roll),
      yaw: toNumber(firstDefined(data.yaw, data.gyro_z), previous.gyroscope.yaw),
    },
    gps: {
      latitude,
      longitude,
      satellites: toNumber(
        firstDefined(data.gnss_sats, data.satellites),
        previous.gps.satellites,
      ),
    },
    gnssTime:
      typeof data.gnss_time === 'string'
        ? data.gnss_time
        : previous.gnssTime,
    accelerometer: {
      x: toNumber(firstDefined(data.accel_x, data.accelX), previous.accelerometer.x),
      y: toNumber(firstDefined(data.accel_y, data.accelY), previous.accelerometer.y),
      z: toNumber(firstDefined(data.accel_z, data.accelZ), previous.accelerometer.z),
    },
    magnetometer: {
      x: toNumber(firstDefined(data.mag_x, data.magX), previous.magnetometer.x),
      y: toNumber(firstDefined(data.mag_y, data.magY), previous.magnetometer.y),
      z: toNumber(firstDefined(data.mag_z, data.magZ), previous.magnetometer.z),
    },
    missionTime: formatMissionTime(
      data.mission_time ?? data.missionTime,
    ),
    history: [
      ...previous.history,
      {
        timestamp: Date.now(),
        altitude,
        gnssAltitude: gnssAlt,
        pressure,
        temperature,
        humidity: toNumber(data.humidity, previous.humidity),
        voltage,
        gasResistance: toNumber(
          firstDefined(data.gas_resistance, data.gasResistance),
          previous.gasResistance,
        ),
        latitude,
        longitude,
        accelX: toNumber(firstDefined(data.accel_x, data.accelX), previous.accelerometer.x),
        accelY: toNumber(firstDefined(data.accel_y, data.accelY), previous.accelerometer.y),
        accelZ: toNumber(firstDefined(data.accel_z, data.accelZ), previous.accelerometer.z),
        gyroX: toNumber(firstDefined(data.gyro_x, data.gyroX), previous.gyroscope.roll),
        gyroY: toNumber(firstDefined(data.gyro_y, data.gyroY), previous.gyroscope.pitch),
        gyroZ: toNumber(firstDefined(data.gyro_z, data.gyroZ), previous.gyroscope.yaw),
        spinRate: toNumber(
          firstDefined(data.spin_rate, data.gyro_spin_rate, data.spinRate),
          previous.spinRate,
        ),
        magX: toNumber(firstDefined(data.mag_x, data.magX), previous.magnetometer.x),
        magY: toNumber(firstDefined(data.mag_y, data.magY), previous.magnetometer.y),
        magZ: toNumber(firstDefined(data.mag_z, data.magZ), previous.magnetometer.z),
      },
    ].slice(-30),
    communication: {
      ...previous.communication,
      packetCount,
      signal: toNumber(firstDefined(data.signal, data.rssi), previous.communication.signal),
      dataRate: toNumber(data.data_rate, previous.communication.dataRate),
    },
  }
  return next
}

export function TelemetryProvider({ children }) {
  const [state, setState] = useState(initialTelemetryState)
  const [uplinkStatus, setUplinkStatus] = useState('idle')
  const [cmdResponse, setCmdResponse] = useState('')
  const socketRef = useRef(null)
  const pendingUplinkCommand = useRef(null)
  const telemetryWatchdog = useRef(null)

  const sendUplinkCommand = useCallback((commandString) => {
    const socket = socketRef.current
    if (!socket?.connected) return false

    pendingUplinkCommand.current = commandString
    setUplinkStatus('sending')
    setCmdResponse('')
    socket.emit('uplink_command', { text_string: commandString })
    return true
  }, [])

  const resetUplinkStatus = useCallback((status = 'idle') => {
    pendingUplinkCommand.current = null
    setUplinkStatus(status)
  }, [])

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
    })
    socketRef.current = socket
    const handleUplinkStatus = (payload) => {
      if (!pendingUplinkCommand.current) return
      if (
        payload.command &&
        payload.command !== pendingUplinkCommand.current
      ) {
        return
      }
      pendingUplinkCommand.current = null
      setUplinkStatus(payload.success ? 'success' : 'error')
    }
    const handleCommandAck = (payload) => {
      if (!pendingUplinkCommand.current) return
      if (payload.command !== pendingUplinkCommand.current) return

      pendingUplinkCommand.current = null
      setUplinkStatus(
        payload.status === 'OK' || payload.status === 'ACCEPTED'
          ? 'success'
          : 'error',
      )
    }
    const handleTelemetryUpdate = (data) => {
      if (data && typeof data === 'object') {
        window.clearTimeout(telemetryWatchdog.current)
        setState((previous) => {
          const next = updateTelemetryState(previous, data)
          return {
            ...next,
            communication: { ...next.communication, connected: true },
          }
        })
        telemetryWatchdog.current = window.setTimeout(() => {
          setState((previous) => {
            if (!previous.communication.connected) return previous
            return {
              ...previous,
              communication: { ...previous.communication, connected: false },
            }
          })
        }, 5000)
      }
    }
    const handleCommandResponse = (payload) => {
      if (typeof payload?.response === 'string') {
        setCmdResponse(payload.response)
      } else if (typeof payload?.data === 'string') {
        setCmdResponse(payload.data)
      } else if (typeof payload?.message === 'string') {
        setCmdResponse(payload.message)
      }
    }
    socket.on('uplink_status', handleUplinkStatus)
    socket.on('command_ack', handleCommandAck)
    socket.on('command_response', handleCommandResponse)
    socket.on('new_data', handleTelemetryUpdate)
    socket.on('telemetry_update', handleTelemetryUpdate)
    socket.on('raw_data', (rawData) => {
      setState((previous) => ({
        ...previous,
        communication: { ...previous.communication, rawData: String(rawData) },
      }))
    })
    socket.on('serial_config', (config) => {
      setState((previous) => ({
        ...previous,
        port: config.port ?? previous.port,
        baudRate: config.baudRate ?? previous.baudRate,
        communication: {
          ...previous.communication,
          serialConfig: {
            port: config.port ?? previous.port,
            baudRate: config.baudRate ?? previous.baudRate,
          },
        },
      }))
    })
    socket.on('disconnect', () => {
      window.clearTimeout(telemetryWatchdog.current)
      if (pendingUplinkCommand.current) {
        pendingUplinkCommand.current = null
        setUplinkStatus('error')
      }
      setState((previous) => ({
        ...previous,
        communication: { ...previous.communication, connected: false },
      }))
    })
    return () => {
      socket.off('uplink_status', handleUplinkStatus)
      socket.off('command_ack', handleCommandAck)
      socket.off('command_response', handleCommandResponse)
      socket.off('new_data', handleTelemetryUpdate)
      socket.off('telemetry_update', handleTelemetryUpdate)
      window.clearTimeout(telemetryWatchdog.current)
      socketRef.current = null
      socket.disconnect()
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      ...state,
      uplinkStatus,
      cmdResponse,
      sendUplinkCommand,
      resetUplinkStatus,
    }),
    [state, uplinkStatus, cmdResponse, sendUplinkCommand, resetUplinkStatus],
  )

  return (
    <TelemetryContext.Provider value={contextValue}>
      {children}
    </TelemetryContext.Provider>
  )
}

export function useTelemetry() {
  const context = useContext(TelemetryContext)
  if (!context) throw new Error('useTelemetry must be used within a TelemetryProvider')
  return context
}
