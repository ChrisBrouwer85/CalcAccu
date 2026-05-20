import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { MONTHS } from '../i18n.js'

function emptyBucket() {
  return {
    solar: 0,
    batteryToHome: 0,
    gridImportHome: 0,
    gridImportCharge: 0,
    gridExportSolar: 0,
    gridExportBattery: 0,
  }
}

function addRow(bucket, row) {
  const charge = row.gridImportCharge ?? 0
  const expBattery = row.gridExportBattery ?? 0
  bucket.solar += row.solar
  bucket.batteryToHome += row.batteryToHome ?? 0
  bucket.gridImportHome += row.gridImport - charge
  bucket.gridImportCharge += charge
  bucket.gridExportSolar += row.gridExport - expBattery
  bucket.gridExportBattery += expBattery
}

function round1(bucket) {
  return Object.fromEntries(
    Object.entries(bucket).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(1) : v])
  )
}

function aggregateMonthly(hourly, t) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: t(MONTHS[i]),
    ...emptyBucket(),
  }))
  for (const row of hourly) addRow(months[new Date(row.timestamp).getMonth()], row)
  return months.map(round1)
}

function aggregateWeekly(hourly) {
  const weeks = {}
  for (const row of hourly) {
    const d = new Date(row.timestamp)
    const weekNum = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / (7 * 24 * 3600 * 1000))
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`
    if (!weeks[key]) weeks[key] = { label: key, ...emptyBucket() }
    addRow(weeks[key], row)
  }
  return Object.values(weeks).slice(0, 52).map(round1)
}

function aggregateDaily(hourly) {
  const days = {}
  for (const row of hourly) {
    const key = new Date(row.timestamp).toISOString().slice(0, 10)
    if (!days[key]) days[key] = { label: key.slice(5), ...emptyBucket() }
    addRow(days[key], row)
  }
  return Object.values(days).slice(0, 365).map(round1)
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{p.value.toFixed(1)} kWh</span>
        </div>
      ))}
    </div>
  )
}

export default function EnergyFlowChart({ t, hourly }) {
  const [resolution, setResolution] = useState('monthly')

  const data = useMemo(() => {
    if (!hourly?.length) return []
    if (resolution === 'monthly') return aggregateMonthly(hourly, t)
    if (resolution === 'weekly') return aggregateWeekly(hourly)
    return aggregateDaily(hourly)
  }, [hourly, resolution, t])

  if (!hourly?.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">
        {t('flowChartUnavailable')}
      </p>
    )
  }

  const resolutions = [
    { value: 'monthly', label: t('resMonthly') },
    { value: 'weekly', label: t('resWeekly') },
    { value: 'daily', label: t('resDaily') },
  ]

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        {resolutions.map(r => (
          <button
            key={r.value}
            onClick={() => setResolution(r.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              resolution === r.value
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis unit=" kWh" tick={{ fontSize: 11 }} width={65} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* Local supply: solar production */}
          <Area type="monotone" dataKey="solar" stackId="supply"
            name={t('solar')} fill="#fde68a" stroke="#f59e0b" fillOpacity={0.8} />
          {/* Battery discharged to cover home demand */}
          <Area type="monotone" dataKey="batteryToHome" stackId="supply"
            name={t('batteryToHome')} fill="#6ee7b7" stroke="#10b981" fillOpacity={0.8} />
          {/* Grid drawn for home use */}
          <Area type="monotone" dataKey="gridImportHome" stackId="import"
            name={t('gridImportHome')} fill="#fca5a5" stroke="#ef4444" fillOpacity={0.7} />
          {/* Grid drawn specifically to charge the battery */}
          <Area type="monotone" dataKey="gridImportCharge" stackId="import"
            name={t('gridImportCharge')} fill="#fed7aa" stroke="#f97316" fillOpacity={0.8} />
          {/* Solar surplus exported directly to grid */}
          <Area type="monotone" dataKey="gridExportSolar" stackId="export"
            name={t('gridExportSolar')} fill="#bfdbfe" stroke="#3b82f6" fillOpacity={0.7} />
          {/* Battery energy sold to grid during high-price hours */}
          <Area type="monotone" dataKey="gridExportBattery" stackId="export"
            name={t('gridExportBattery')} fill="#a5b4fc" stroke="#6366f1" fillOpacity={0.8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
