import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Compass, Eye, RotateCcw } from 'lucide-react'
import Satellite3D from '../components/Satellite3D'
import { useTelemetry } from '../context/TelemetryContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const chartColors = ['#ef4444', '#22c55e', '#3b82f6']

function ImuChart({ title, fields }) {
  const { history } = useTelemetry()
  const points = history.length ? history : [{ timestamp: 0 }]

  const data = {
    labels: points.map((point) =>
      new Date(point.timestamp).toLocaleTimeString('en-GB'),
    ),
    datasets: fields.map((field, index) => ({
      label: field.label,
      data: points.map((point) => point[field.key] ?? 0),
      borderColor: chartColors[index],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHitRadius: 10,
      tension: 0.3,
    })),
  }

  return (
    <div className="card gyro-chart-card flex-1 min-h-0">
      <h3>{title}</h3>
      <div className="gyro-chart h-full min-h-0">
        <Line
          data={data}
          updateMode="none"
          options={{
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display: true,
                labels: { color: '#94a3b8', padding: 8, font: { size: 11 } },
              },
              tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                displayColors: true,
                backgroundColor: '#101820',
                titleColor: '#e6edf3',
                bodyColor: '#c9d1d9',
                borderColor: '#30363d',
                borderWidth: 1,
                padding: 10,
              },
            },
            scales: {
              x: {
                ticks: {
                  color: '#64748b',
                  maxTicksLimit: 5,
                  font: { size: 11 },
                },
                grid: { color: 'rgba(56, 68, 90, 0.3)', borderDash: [2, 4] },
              },
              y: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(56, 68, 90, 0.3)', borderDash: [2, 4] },
              },
            },
          }}
        />
      </div>
    </div>
  )
}

function Gyro() {
  const { gyroscope, motionState } = useTelemetry()
  const [wireframe, setWireframe] = useState(false)
  const [resetCount, setResetCount] = useState(0)

  const handleReset = () => setResetCount((count) => count + 1)

  return (
    <section className="page gyro-page h-[calc(100vh-76px)] min-h-0 overflow-hidden">
      <header className="route-banner">
        <Compass size={20} className="route-icon" aria-hidden="true" />
        <h2>Orientation &amp; IMU</h2>
      </header>

      <div className="gyro-page-layout flex-1 min-h-0 overflow-hidden">
        <section className="card gyro-satellite-card">
          <h3>3D Satellite Model</h3>
          <Satellite3D resetTrigger={resetCount} wireframe={wireframe} />
          <div className="gyro-readout">
            <span className="roll-readout">Roll: {gyroscope.roll.toFixed(2)}°</span>
            <span className="pitch-readout">Pitch: {gyroscope.pitch.toFixed(2)}°</span>
            <span className="yaw-readout">Yaw: {gyroscope.yaw.toFixed(2)}°</span>
            <strong className="motion-tumbling">Motion: {motionState}</strong>
          </div>
          <div className="gyro-actions">
            <button className="gyro-btn" type="button" onClick={handleReset}>
              <RotateCcw size={14} />
              Reset View
            </button>
            <button
              className="gyro-btn"
              type="button"
              onClick={() => setWireframe(!wireframe)}
            >
              <Eye size={14} />
              {wireframe ? 'Solid' : 'Wireframe'}
            </button>
          </div>
        </section>

        <div className="gyro-charts-grid flex flex-col flex-1 min-h-0 overflow-hidden">
          <ImuChart
            fields={[
              { key: 'accelX', label: 'Accel_X' },
              { key: 'accelY', label: 'Accel_Y' },
              { key: 'accelZ', label: 'Accel_Z' },
            ]}
            title="Accelerometer"
          />
          <ImuChart
            fields={[{ key: 'spinRate', label: 'Spin Rate' }]}
            title="Gyroscope"
          />
          <ImuChart
            fields={[
              { key: 'magX', label: 'Mag_X' },
              { key: 'magY', label: 'Mag_Y' },
              { key: 'magZ', label: 'Mag_Z' },
            ]}
            title="Magnetometer"
          />
        </div>
      </div>
    </section>
  )
}

export default Gyro
