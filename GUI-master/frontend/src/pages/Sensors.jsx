import { Activity } from 'lucide-react'
import RealtimeChart from '../components/RealtimeChart'
import { useTelemetry } from '../context/TelemetryContext'

const sensorCards = [
  {
    label: 'Temperature',
    metric: 'temperature',
    color: '#22D3EE',
    unit: '°C',
    valueKey: 'temperature',
    digits: 1,
  },
  {
    label: 'Pressure',
    metric: 'pressure',
    color: '#FB923C',
    unit: 'Pa',
    valueKey: 'pressure',
    digits: 2,
  },
  {
    label: 'Altitude',
    metric: 'altitude',
    color: '#7c3aed',
    unit: 'm',
    valueKey: 'altitude',
    digits: 2,
  },
  {
    label: 'Voltage',
    metric: 'voltage',
    color: '#A78BFA',
    unit: 'V',
    valueKey: 'voltage',
    digits: 2,
  },
]

function Sensors() {
  const { telemetry } = useTelemetry()
  const values = {
    temperature: telemetry.temperature,
    pressure: telemetry.pressure,
    altitude: telemetry.altitude,
    voltage: telemetry.voltage,
  }

  return (
    <section className="page sensors-page">
      <header className="route-banner">
        <Activity size={20} className="route-icon" aria-hidden="true" />
        <h2>Environmental Sensors</h2>
      </header>

      <div className="sensors-grid">
        {sensorCards.map(
          ({ label, metric, color, unit, valueKey, digits }) => (
            <article className="sensor-card" key={metric}>
              <h3>{label}</h3>
              <RealtimeChart
                color={color}
                height={180}
                label={label}
                metric={metric}
                unit={unit}
              />
              <div className="sensor-readout">
                {Number(values[valueKey] || 0).toFixed(digits)} {unit}
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  )
}

export default Sensors
