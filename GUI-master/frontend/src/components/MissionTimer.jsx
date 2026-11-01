import { Download, Satellite } from 'lucide-react'
import { useTelemetry } from '../context/TelemetryContext'
import UplinkControl from './UplinkControl'

const formatElapsedTime = (timestampSeconds) => {
  const parsedSeconds = Number(timestampSeconds)
  const totalSeconds = Number.isFinite(parsedSeconds) && parsedSeconds >= 0
    ? Math.floor(parsedSeconds)
    : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

function MissionTimer({ onDownloadLog }) {
  const {
    communication,
    rssi,
    snr,
    flightState,
    teamName,
    teamId,
    missionTimestamp,
    gnssTime,
  } = useTelemetry()

  return (
    <div className="mission-topbar" aria-label="Mission status">
      <div className="mission-identity">
        <Satellite size={17} aria-hidden="true" />
        <strong>{teamName}</strong>
        <span>{teamId}</span>
      </div>
      <div className="mission-link-status">
        <span className={`status-dot${communication.connected ? ' is-connected' : ''}`} />
        <span>
          {communication.connected ? 'LIVE' : 'OFFLINE'} · STATE {flightState} · RSSI {rssi} dBm · SNR {snr} dB
        </span>
        <strong className={communication.connected ? 'is-connected' : 'is-disconnected'}>
          {communication.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </strong>
      </div>
      <div className="flex w-fit max-w-full flex-row flex-wrap items-center gap-2">
        <UplinkControl />
        <button
          className="flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          onClick={onDownloadLog}
          type="button"
        >
          <Download aria-hidden="true" size={16} />
          Download Flight Log
        </button>
      </div>
      <div className="mission-readouts">
        <span>T+ {formatElapsedTime(missionTimestamp)}</span>
        <span>GNSS {gnssTime}</span>
      </div>
    </div>
  )
}

export default MissionTimer
