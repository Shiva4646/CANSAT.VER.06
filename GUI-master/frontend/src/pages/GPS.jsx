import { MapPin, Navigation } from 'lucide-react'
import GPSMap from '../components/GPSMap'
import { useTelemetry } from '../context/TelemetryContext'

function GPS() {
  const { gps, gnssAlt, gnssTime } = useTelemetry()
  return (
    <section className="page">
      <header className="route-banner">
        <Navigation size={20} className="route-icon" aria-hidden="true" />
        <h2>GPS Navigation</h2>
      </header>
      <div className="gps-page-grid">
        <GPSMap />
        <div className="card">
          <h3>
            <MapPin size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
            GNSS Metrics
          </h3>
          <div className="metric-list">
            <div className="metric-row">
              <span className="metric-label">Latitude</span>
              <strong className="metric-value">{gps.latitude.toFixed(6)}°</strong>
            </div>
            <div className="metric-row">
              <span className="metric-label">Longitude</span>
              <strong className="metric-value">{gps.longitude.toFixed(6)}°</strong>
            </div>
            <div className="metric-row">
              <span className="metric-label">Altitude</span>
              <strong className="metric-value">{gnssAlt.toFixed(2)} m</strong>
            </div>
            <div className="metric-row">
              <span className="metric-label">Satellites</span>
              <strong className="metric-value">{gps.satellites}</strong>
            </div>
            <div className="metric-row">
              <span className="metric-label">GNSS Time</span>
              <strong className="metric-value">{gnssTime}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GPS
