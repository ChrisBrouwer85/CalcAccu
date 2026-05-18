import Papa from 'papaparse'
import { useRef, useState } from 'react'
import { parseCSV, applyMapping } from '../utils/csvParser.js'
import HAImport from './HAImport.jsx'

function SensorList({ sensors, sensorIds, onAdd, onRemove, onChangeSensor, onChangeTariff, t, addLabel }) {
  return (
    <div className="space-y-2">
      {sensors.map((entry, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <select
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={entry.id}
            onChange={e => onChangeSensor(idx, e.target.value)}
          >
            <option value="">{t('noSensor')}</option>
            {sensorIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-gray-500">{t('sensorTariff')}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={entry.tariff}
              onChange={e => onChangeTariff(idx, e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <button
            onClick={() => onRemove(idx)}
            className="text-gray-400 hover:text-red-500 text-lg leading-none px-1 transition-colors"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
      >
        + {addLabel}
      </button>
    </div>
  )
}

function CSVTab({ t, onDataReady, defaultBuyPrice, defaultSellPrice }) {
  const [dragging, setDragging] = useState(false)
  const [rawData, setRawData] = useState(null)
  const [mapping, setMapping] = useState({ solar: '', gridImport: [], gridExport: [] })
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setError('The CSV appears to be empty.')
          return
        }
        const parsed = parseCSV(results.data)
        setRawData(parsed)
        const sm = parsed.suggestedMapping
        setMapping({
          solar: sm.solar || '',
          gridImport: sm.gridImport ? [{ id: sm.gridImport, tariff: defaultBuyPrice }] : [],
          gridExport: sm.gridExport ? [{ id: sm.gridExport, tariff: defaultSellPrice }] : [],
        })
      },
    })
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleConfirm() {
    const hasImport = mapping.gridImport.some(e => e.id)
    const hasSolar = mapping.solar
    if (!hasImport && !hasSolar) {
      setError(t('mappingError'))
      return
    }
    const mappingForParser = {
      solar: mapping.solar,
      gridImport: mapping.gridImport.map(e => e.id).filter(Boolean),
      gridExport: mapping.gridExport.map(e => e.id).filter(Boolean),
    }
    const hourlyData = applyMapping(rawData.byId, mappingForParser)
    if (hourlyData.length === 0) {
      setError('No valid hourly data could be extracted. Check the column mapping.')
      return
    }
    const sensorTariffs = Object.fromEntries([
      ...mapping.gridImport.filter(e => e.id).map(e => [e.id, parseFloat(e.tariff) || 0]),
      ...mapping.gridExport.filter(e => e.id).map(e => [e.id, parseFloat(e.tariff) || 0]),
    ])
    onDataReady(hourlyData, sensorTariffs)
  }

  function addSensor(category, defaultTariff) {
    setMapping(m => ({
      ...m,
      [category]: [...m[category], { id: '', tariff: defaultTariff }],
    }))
  }

  function removeSensor(category, idx) {
    setMapping(m => ({
      ...m,
      [category]: m[category].filter((_, i) => i !== idx),
    }))
  }

  function changeSensor(category, idx, newId) {
    setMapping(m => ({
      ...m,
      [category]: m[category].map((e, i) => i === idx ? { ...e, id: newId } : e),
    }))
  }

  function changeTariff(category, idx, val) {
    setMapping(m => ({
      ...m,
      [category]: m[category].map((e, i) => i === idx ? { ...e, tariff: val } : e),
    }))
  }

  const previewRows = rawData ? Object.values(rawData.byId)[0]?.slice(0, 5) ?? [] : []
  const previewHeaders = previewRows.length > 0 ? Object.keys(previewRows[0]) : []

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-white'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-gray-600 font-medium">{t('dropCSV')}</p>
        <p className="text-gray-400 text-sm mt-1">{t('orClick')}</p>
        {fileName && <p className="mt-3 text-blue-600 font-medium text-sm">📄 {fileName}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {rawData && (
        <>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">{t('csvPreview')}</h3>
            <p className="text-sm text-gray-500 mb-3">
              {Object.values(rawData.byId).reduce((s, a) => s + a.length, 0)} {t('dataLoaded')}
            </p>
            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewHeaders.slice(0, 8).map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {previewHeaders.slice(0, 8).map(h => (
                          <td key={h} className="px-3 py-1.5 text-gray-600 border-b border-gray-100 truncate max-w-32">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-4">{t('columnMapping')}</h3>
            <div className="space-y-5">
              {/* Solar — single sensor, no tariff */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🌞 {t('mapSolar')}</label>
                <select
                  className="w-full md:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={mapping.solar}
                  onChange={e => setMapping(m => ({ ...m, solar: e.target.value }))}
                >
                  <option value="">{t('noSensor')}</option>
                  {rawData.sensorIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>

              {/* Grid Import — multiple sensors with tariffs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">⬇️ {t('mapGridImport')}</label>
                <SensorList
                  sensors={mapping.gridImport}
                  sensorIds={rawData.sensorIds}
                  onAdd={() => addSensor('gridImport', defaultBuyPrice)}
                  onRemove={idx => removeSensor('gridImport', idx)}
                  onChangeSensor={(idx, id) => changeSensor('gridImport', idx, id)}
                  onChangeTariff={(idx, val) => changeTariff('gridImport', idx, val)}
                  t={t}
                  addLabel={t('addSensor')}
                />
              </div>

              {/* Grid Export — multiple sensors with tariffs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">⬆️ {t('mapGridExport')}</label>
                <SensorList
                  sensors={mapping.gridExport}
                  sensorIds={rawData.sensorIds}
                  onAdd={() => addSensor('gridExport', defaultSellPrice)}
                  onRemove={idx => removeSensor('gridExport', idx)}
                  onChangeSensor={(idx, id) => changeSensor('gridExport', idx, id)}
                  onChangeTariff={(idx, val) => changeTariff('gridExport', idx, val)}
                  t={t}
                  addLabel={t('addSensor')}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {t('confirmMapping')}
          </button>
        </>
      )}
    </div>
  )
}

export default function CSVImport({ t, onDataReady, defaultBuyPrice, defaultSellPrice }) {
  const [activeTab, setActiveTab] = useState('ha')

  const tabs = [
    { key: 'csv', label: t('csvTab'), icon: '📄' },
    { key: 'ha', label: t('haTab'), icon: '🏠' },
  ]

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'csv' && (
        <CSVTab
          t={t}
          onDataReady={onDataReady}
          defaultBuyPrice={defaultBuyPrice}
          defaultSellPrice={defaultSellPrice}
        />
      )}
      {activeTab === 'ha' && <HAImport t={t} onDataReady={onDataReady} defaultBuyPrice={defaultBuyPrice} defaultSellPrice={defaultSellPrice} />}
    </div>
  )
}
