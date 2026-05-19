import { describe, it, expect, vi } from 'vitest'
import { HAWebSocket } from '../utils/haConnector.js'

describe('HAWebSocket.fetchStatistics', () => {
  it('uses recorder/statistics_during_period by default', async () => {
    const ha = new HAWebSocket('http://ha.local:8123', 'token')
    const sendSpy = vi.spyOn(ha, '_send').mockResolvedValue({})
    await ha.fetchStatistics(['sensor.solar'], '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')
    expect(sendSpy.mock.calls[0][0].type).toBe('recorder/statistics_during_period')
  })

  it('falls back to history/statistics_during_period on unknown command', async () => {
    const ha = new HAWebSocket('http://ha.local:8123', 'token')
    const sendSpy = vi.spyOn(ha, '_send')
      .mockRejectedValueOnce(new Error('Unknown command.'))
      .mockResolvedValueOnce({ 'sensor.import': [] })
    const result = await ha.fetchStatistics(['sensor.import'], '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')
    expect(sendSpy).toHaveBeenCalledTimes(2)
    expect(sendSpy.mock.calls[1][0].type).toBe('history/statistics_during_period')
    expect(result).toEqual({ 'sensor.import': [] })
  })

  it('forwards all payload fields on fallback', async () => {
    const ha = new HAWebSocket('http://ha.local:8123', 'token')
    vi.spyOn(ha, '_send')
      .mockRejectedValueOnce(new Error('Unknown command.'))
      .mockResolvedValueOnce({})
    await ha.fetchStatistics(['sensor.a', 'sensor.b'], '2024-01-01T00:00:00Z', '2024-06-01T00:00:00Z')
    const fallback = ha._send.mock.calls[1][0]
    expect(fallback.type).toBe('history/statistics_during_period')
    expect(fallback.statistic_ids).toEqual(['sensor.a', 'sensor.b'])
    expect(fallback.start_time).toBe('2024-01-01T00:00:00Z')
    expect(fallback.end_time).toBe('2024-06-01T00:00:00Z')
    expect(fallback.period).toBe('hour')
  })

  it('rethrows non-unknown-command errors', async () => {
    const ha = new HAWebSocket('http://ha.local:8123', 'token')
    vi.spyOn(ha, '_send').mockRejectedValue(new Error('HA command error'))
    await expect(
      ha.fetchStatistics(['sensor.import'], '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')
    ).rejects.toThrow('HA command error')
  })
})
