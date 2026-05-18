import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { MONTHS } from '../i18n.js'

function aggregateMonthly(hourly, t) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: t(MONTHS[i]),
    solar: 0,
    consumption: 0,
    gridImport: 0,
    gridExport: 0,
    batteryDischarge: 0,
  }))
  for (const row of hourly) {
    const m = new Date(row.timestamp).getMonth()
    months[m].solar += row.solar
    months[m].consumption += row.homeConsumption
    months[m].gridImport += row.gridImport
    months[m].gridExport += row.gridExport
    months[m].batteryDischarge += row.batteryDischarge
  }
  return months.map(m => ({
    ...m,
    solar: +m.solar.toFixed(1),
    consumption: +m.consumption.toFixed(1),
    gridImport: +m.gridImport.toFixed(1),
    gridExport: +m.gridExport.toFixed(1),
    batteryDischarge: +m.batteryDischarge.toFixed(1),
  }))
}

function aggregateWeekly(hourly) {
  const weeks = {}
  for (const row of hourly) {
    const d = new Date(row.timestamp)
    const weekNum = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / (7 * 24 * 3600 * 1000))
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`
    if (!weeks[key]) weeks[key] = { label: key, solar: 0, consumption: 0, gridImport: 0, gridExport: 0, batteryDischarge: 0 }
    weeks[key].solar += row.solar
    weeks[key].consumption += row.homeConsumption
    weeks[key].gridImport += row.gridImport
    weeks[key].gridExport += row.gridExport
    weeks[key].batteryDischarge += row.batteryDischarge
  }
  return Object.values(weeks).slice(0, 52)
}

function aggregateDaily(hourly) {
  const days = {}
  for (const row of hourly) {
    const d = new Date(row.timestamp)
    const key = d.toISOString().slice(0, 10)
    if (!days[key]) days[key] = { label: key.slice(5), solar: 0, consumption: 0, gridImport: 0, gridExport: 0, batteryDischarge: 0 }
    days[key].solar += row.solar
    days[key].consumption += row.homeConsumption
    days[key].gridImport += row.gridImport
    days[key].gridExport += row.gridExport
    days[key].batteryDischarge += row.batteryDischarge
  }
  return Object.values(days).slice(0, 365)
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
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis unit=" kWh" tick={{ fontSize: 11 }} width={65} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="solar" stackId="a" name={t('solar')} fill="#fde68a" stroke="#f59e0b" fillOpacity={0.8} />
          <Area type="monotone" dataKey="batteryDischarge" stackId="a" name={t('batteryDischarge')} fill="#6ee7b7" stroke="#10b981" fillOpacity={0.8} />
          <Area type="monotone" dataKey="gridImport" name={t('gridImport')} fill="#fca5a5" stroke="#ef4444" fillOpacity={0.6} />
          <Area type="monotone" dataKey="gridExport" name={t('gridExport')} fill="#93c5fd" stroke="#3b82f6" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
