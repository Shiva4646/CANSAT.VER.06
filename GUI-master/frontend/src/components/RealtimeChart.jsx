import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useTelemetry } from '../context/TelemetryContext'

const EMPTY_POINT = { timestamp: 0, altitude: 0, pressure: 0, temperature: 0 }

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

function RealtimeChart({
  metric,
  label,
  color,
  unit = '',
  height = 220,
  chartOptions = {},
}) {
  const { history } = useTelemetry()
  const points = history.length ? history : [EMPTY_POINT]

  const data = {
    labels: points.map((point) =>
      new Date(point.timestamp).toLocaleTimeString('en-GB'),
    ),
    datasets: [
      {
        label: `${label}${unit ? ` (${unit})` : ''}`,
        data: points.map((point) => point[metric] ?? 0),
        borderColor: color,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        borderWidth: 2,
      },
    ],
  }

  return (
    <div className="realtime-chart" style={{ height }}>
      <Line
        data={data}
        updateMode="none"
        options={{
          responsive: true,
          maintainAspectRatio: false,
          ...chartOptions,
          animation: false,
          interaction: {
            mode: 'index',
            intersect: false,
            ...chartOptions.interaction,
          },
          plugins: {
            ...chartOptions.plugins,
            legend: { display: false, ...chartOptions.plugins?.legend },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: '#17131f',
              titleColor: '#f4f1f8',
              bodyColor: '#c4b5fd',
              borderColor: '#6d28d9',
              borderWidth: 1,
              displayColors: true,
              padding: 10,
              ...chartOptions.plugins?.tooltip,
            },
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(167, 139, 250, 0.12)',
                borderDash: [2, 4],
              },
              ...chartOptions.scales?.x,
              ticks: {
                maxTicksLimit: 6,
                color: '#817b8b',
                font: { size: 10 },
                ...chartOptions.scales?.x?.ticks,
              },
            },
            y: {
              grid: {
                color: 'rgba(167, 139, 250, 0.12)',
                borderDash: [2, 4],
              },
              ...chartOptions.scales?.y,
              ticks: {
                color: '#817b8b',
                font: { size: 10 },
                ...chartOptions.scales?.y?.ticks,
              },
            },
          },
        }}
      />
    </div>
  )
}

export default RealtimeChart
