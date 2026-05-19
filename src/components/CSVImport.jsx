import Papa from 'papaparse'
import { useRef, useState } from 'react'
import { parseCSV, applyMapping } from '../utils/csvParser.js'

export default function CSVImport({ t, onDataReady, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [rawData, setRawData] = useState(null)
  const [mapping, setMapping] = useState({ solar: '', gridImport: '', gridExport: '' })
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
        setMapping(parsed.suggestedMapping)
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
    if (!mapping.gridImport && !mapping.solar) {
      setError(t('mappingError'))
      return
    }
    const hourlyData = applyMapping(rawData.byId, mapping)
    if (hourlyData.length === 0) {
      setError('No valid hourly data could be extracted. Check the column mapping.')
      return
    }
    onDataReady(hourlyData)
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
            <h3 className="font-semibold text-gray-800 mb-3">{t('columnMapping')}</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { key: 'solar', label: t('mapSolar'), emoji: '🌞' },
                { key: 'gridImport', label: t('mapGridImport'), emoji: '⬇️' },
                { key: 'gridExport', label: t('mapGridExport'), emoji: '⬆️' },
              ].map(({ key, label, emoji }) => (
                <div key={key}>
                  <label className="block text-sm text-gray-600 mb-1">{emoji} {label}</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={mapping[key]}
                    onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                  >
                    <option value="">{t('noSensor')}</option>
                    {rawData.sensorIds.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={disabled}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('confirmMapping')}
          </button>
        </>
      )}
    </div>
  )
}
