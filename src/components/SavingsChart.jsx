import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">€{p.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  )
}

export default function SavingsChart({ t, results, costPerKwh }) {
  if (!results?.length) return null

  const data = results.map(({ sizeKwh, result }) => {
    const totalCost = sizeKwh * costPerKwh
    const annualSavings = result.financial.annualSavings
    const annualized = totalCost / 15 // 15-year amortization
    return {
      name: `${sizeKwh} kWh`,
      [t('annualSavings')]: +annualSavings.toFixed(0),
      'Cost / 15yr': +annualized.toFixed(0),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis unit=" €" tick={{ fontSize: 11 }} width={65} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={t('annualSavings')} fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Cost / 15yr" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <ReferenceLine y={0} stroke="#374151" />
      </BarChart>
    </ResponsiveContainer>
  )
}
