import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { MapPin, Radio } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import GPSMap from '../components/GPSMap'
import RealtimeChart from '../components/RealtimeChart'
import Satellite3D from '../components/Satellite3D'
import { useTelemetry } from '../context/TelemetryContext'


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
)

const formatNumber = (value, digits = 2) => Number(value ?? 0).toFixed(digits)
const imuColors = ['#ef4444', '#22c55e', '#3b82f6']

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="dashboard-metric telemetry-tile">
      <div className="telemetry-tile-label">
        <Icon size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  )
}

function StatusBadge({ label, value }) {
  const deployed = String(value).toUpperCase() === 'DEPLOYED'

  return (
    <div className={`recovery-status ${deployed ? 'is-deployed' : ''}`}>
      <span className="recovery-status-dot" />
      <span>{label}</span>
      <strong className={deployed ? 'text-green-400' : ''}>{value}</strong>
    </div>
  )
}

function ImuChart({ title, fields }) {
  const { history } = useTelemetry()
  const points = history.length ? history : [{ timestamp: 0 }]

  return (
    <div className="dashboard-imu-card">
      <h3>{title}</h3>
      <div className="dashboard-imu-chart">
        <Line
          updateMode="none"
          data={{
            labels: points.map((point) =>
              new Date(point.timestamp).toLocaleTimeString('en-GB'),
            ),
            datasets: fields.map((field, index) => ({
              label: field.label,
              data: points.map((point) => point[field.key] ?? 0),
              borderColor: imuColors[index],
              borderWidth: 1.5,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHitRadius: 10,
              tension: 0.3,
            })),
          }}
          options={{
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true },
              tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                backgroundColor: '#24170e',
                titleColor: '#f6eee7',
                bodyColor: '#d8c6b6',
                borderColor: '#654127',
                borderWidth: 1,
                displayColors: true,
                padding: 10,
              },
            },
            scales: {
              x: {
                ticks: { color: '#64748b', maxTicksLimit: 4, font: { size: 9 } },
                grid: { color: 'rgba(56, 68, 90, 0.3)' },
              },
              y: {
                ticks: { color: '#64748b', font: { size: 9 } },
                grid: { color: 'rgba(56, 68, 90, 0.3)' },
              },
            },
          }}
        />
      </div>
    </div>
  )
}

function Dashboard() {
  const telemetry = useTelemetry()

  const { telemetry: values, gyroscope } = telemetry
  const flightStateId = telemetry.flightStateId
  const primaryParachute = Number.isInteger(flightStateId)
    ? flightStateId >= 4 ? 'DEPLOYED' : 'STOWED'
    : '--'
  const secondaryParachute = Number.isInteger(flightStateId)
    ? flightStateId >= 6 ? 'DEPLOYED' : 'STOWED'
    : '--'

  return (
    <section className="dashboard-page reference-dashboard">
      <div className="dashboard-main-grid">
        <section className="dashboard-panel dashboard-sensor-panel">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header pl-3">
              <h3>Pressure</h3>
              <span>{formatNumber(values.pressure)} Pa</span>
            </div>
            <RealtimeChart
              chartOptions={{
                scales: {
                  x: { ticks: { maxTicksLimit: 5, maxRotation: 25, minRotation: 25 } },
                },
              }}
              color="#22D3EE"
              label="Pressure"
              metric="pressure"
              unit="Pa"
            />
          </div>
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header pl-3">
              <h3>Temperature</h3>
              <span>{formatNumber(values.temperature, 2)} °C</span>
            </div>
            <RealtimeChart
              chartOptions={{
                scales: {
                  x: { ticks: { maxTicksLimit: 5, maxRotation: 25, minRotation: 25 } },
                },
              }}
              color="#FB923C"
              label="Temperature"
              metric="temperature"
              unit="°C"
            />
          </div>
        </section>

        <section className="dashboard-panel dashboard-satellite-panel">
          <h3 className="panel-eyebrow">3D Orientation</h3>
          <Satellite3D />
          <div className="dashboard-orientation">
            <span className="orientation-readout">ROLL <strong>{formatNumber(gyroscope.roll)}°</strong></span>
            <span className="orientation-readout">PITCH <strong>{formatNumber(gyroscope.pitch)}°</strong></span>
            <span className="orientation-readout">YAW <strong>{formatNumber(gyroscope.yaw)}°</strong></span>
            <strong
              className={`motion-status ${
                String(telemetry.motionState).toUpperCase() === 'TUMBLING'
                  ? 'is-warning'
                  : 'is-stable'
              }`}
            >
              {telemetry.motionState}
            </strong>
          </div>
        </section>

        <section className="dashboard-panel dashboard-altitude-panel">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header pl-3">
              <h3>Altitude</h3>
            </div>
            <RealtimeChart
              chartOptions={{
                maintainAspectRatio: false,
                layout: { padding: { right: 16 } },
                scales: {
                  x: { ticks: { maxTicksLimit: 5, maxRotation: 0, minRotation: 0 } },
                  y: { beginAtZero: false, grace: '10%' },
                },
              }}
              color="#34D399"
              height="100%"
              label="Altitude"
              metric="altitude"
              unit="m"
            />
            <div className="dashboard-chart-readout">
              {formatNumber(values.altitude, 1)} m
            </div>
          </div>
          <div className="dashboard-recovery-box">
            <h3>Recovery System</h3>
            <StatusBadge
              label="Primary"
              value={primaryParachute}
            />
            <StatusBadge
              label="Secondary"
              value={secondaryParachute}
            />
          </div>
        </section>

        <section className="dashboard-panel dashboard-power-panel">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-header pl-3">
              <h3>VOLTAGE</h3>
              <span>{formatNumber(telemetry.batteryVoltage)} V</span>
            </div>
            <RealtimeChart
              chartOptions={{
                maintainAspectRatio: false,
                layout: { padding: { right: 16 } },
                scales: {
                  x: { ticks: { maxTicksLimit: 5, maxRotation: 0, minRotation: 0 } },
                  y: { beginAtZero: false, grace: '10%' },
                },
              }}
              color="#A78BFA"
              height="100%"
              label="Voltage"
              metric="voltage"
              unit="V"
            />
            <div className="dashboard-chart-readout">
              {formatNumber(telemetry.batteryVoltage)} V
            </div>
          </div>
        </section>

        <section className="dashboard-panel dashboard-gnss-panel">
          <h3>Status &amp; Telemetry</h3>
          <div className="dashboard-status-grid">
            <div>
              <Metric icon={MapPin} label="LATITUDE:" value={formatNumber(telemetry.gnssLat, 6)} />
              <Metric icon={MapPin} label="LONGITUDE:" value={formatNumber(telemetry.gnssLon, 6)} />
              <Metric icon={MapPin} label="GNSS ALT:" value={`${formatNumber(telemetry.gnssAlt)} m`} />
            </div>
            <div>
              <Metric icon={Radio} label="PORT:" value={telemetry.port} />
              <Metric icon={Radio} label="BAUD RATE:" value={telemetry.baudRate} />
              <Metric icon={Radio} label="PACKETS:" value={telemetry.packetCount} />
            </div>
          </div>
        </section>

        <section className="dashboard-panel dashboard-map-panel">
          <h3>GPS Tracking</h3>
          <div className="dashboard-map-widget">
            <GPSMap />
          </div>
        </section>
      </div>

      <section className="dashboard-imu-row">
        <ImuChart
          fields={[
            { key: 'accelX', label: 'X' },
            { key: 'accelY', label: 'Y' },
            { key: 'accelZ', label: 'Z' },
          ]}
          title="Accelerometer"
        />
        <ImuChart
          fields={[{ key: 'spinRate', label: 'Spin Rate' }]}
          title="Gyroscope"
        />
        <ImuChart
          fields={[
            { key: 'magX', label: 'X' },
            { key: 'magY', label: 'Y' },
            { key: 'magZ', label: 'Z' },
          ]}
          title="Magnetometer"
        />
      </section>
    </section>
  )
}

export default Dashboard
