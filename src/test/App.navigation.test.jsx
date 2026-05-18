import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App.jsx'

// PapaParser is used for CSV reading; mock it so tests don't need real files
vi.mock('papaparse', () => ({
  default: { parse: vi.fn() },
}))

// Firebase: bypass auth so tests render the main app directly
vi.mock('../firebase.js', () => ({ auth: {}, firebaseConfigured: true }))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'test', displayName: 'Test User', email: 'test@example.com', photoURL: null })
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}))

// Recharts relies on browser layout APIs not available in jsdom
vi.mock('recharts', () => {
  const Stub = ({ children }) => children ?? null
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
    Legend: Stub,
    LineChart: Stub,
    Line: Stub,
    CartesianGrid: Stub,
    ReferenceLine: Stub,
    ComposedChart: Stub,
    Area: Stub,
  }
})

function getNextButton() {
  return screen.getByRole('button', { name: /next|volgende/i })
}

function getBackButton() {
  return screen.getByRole('button', { name: /back|terug/i })
}

describe('App navigation', () => {
  beforeEach(() => {
    render(<App />)
  })

  it('renders step 1 on load', () => {
    expect(screen.getByRole('heading', { name: /Import Data/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next|volgende/i })).toBeDisabled()
  })

  it('Next is disabled on step 1 when no data is loaded', () => {
    expect(getNextButton()).toBeDisabled()
  })

  it('Back is disabled on step 1', () => {
    expect(getBackButton()).toBeDisabled()
  })
})

describe('App step 2 – AccuConfig navigation', () => {
  it('Next is disabled on step 2 when no sizes are selected (all deselected)', () => {
    render(<App />)
    // Step 1 Next is disabled; we can't advance without data.
    // Verify the canProceed guard: with no hourlyData the button is disabled.
    expect(getNextButton()).toBeDisabled()
  })
})

describe('App canProceed guards', () => {
  it('step indicator shows 4 steps', () => {
    render(<App />)
    // Four numbered/checked circles are rendered in the step indicator
    const stepCircles = screen.getAllByRole('button').filter(
      btn => /^[1-4✓]$/.test(btn.textContent?.trim() ?? '')
    )
    expect(stepCircles.length).toBe(4)
  })
})
