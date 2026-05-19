import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { loadPricesForRange } from '../services/marketPrices.js'

const PriceContext = createContext(null)

export function PriceProvider({ children }) {
  const [priceConfig, setPriceConfig] = useState({
    country: 'NL',
    sellPrice: 0.10,
    fromDate: '',
    toDate: '',
    hourlyPriceMap: null,
  })
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [priceError, setPriceError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const loadKeyRef = useRef(null)

  const { country, fromDate, toDate, hourlyPriceMap } = priceConfig

  useEffect(() => {
    if (!fromDate || !toDate || hourlyPriceMap) return
    const key = `${country}|${fromDate}|${toDate}|${retryKey}`
    if (loadKeyRef.current === key) return
    loadKeyRef.current = key
    setLoadingPrices(true)
    setPriceError(null)
    loadPricesForRange(country || 'NL', fromDate, toDate)
      .then(map => setPriceConfig(prev => ({ ...prev, hourlyPriceMap: map })))
      .catch(err => {
        loadKeyRef.current = null
        setPriceError(err?.message ?? 'Load failed')
      })
      .finally(() => setLoadingPrices(false))
  }, [country, fromDate, toDate, hourlyPriceMap, retryKey])

  function retryLoadPrices() {
    loadKeyRef.current = null
    setPriceError(null)
    setRetryKey(k => k + 1)
  }

  return (
    <PriceContext.Provider value={{ priceConfig, setPriceConfig, loadingPrices, priceError, retryLoadPrices }}>
      {children}
    </PriceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePriceConfig() {
  return useContext(PriceContext)
}
