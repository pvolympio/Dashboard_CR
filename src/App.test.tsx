// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useStore } from './store'

vi.mock('./NetworkView', () => ({
  NetworkView: () => <div data-testid="mock-canvas" />,
}))

const redeJson = JSON.parse(readFileSync('public/rede.json', 'utf-8'))
const refJson = JSON.parse(readFileSync('public/referencia_aleatoria.json', 'utf-8'))

beforeEach(() => {
  useStore.setState({
    modelo: 'M2',
    resolucao: 1,
    modoCor: 'comunidade',
    modoTamanho: 'grau',
    visao: 'completa',
    apresentacao: false,
    filtros: { mat: true, comp: true, ext: true, percentil: 0 },
    sel: null,
    grupoRealcado: null,
    simAberto: false,
    afastados: [],
    cenarioAtivo: null,
    animando: false,
  })
  window.location.hash = ''
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(url).includes('referencia') ? refJson : redeJson),
      }),
    ),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App (React Testing Library)', () => {
  it('desabilita os sliders do M2 quando M1 é selecionado', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('2.113')).toBeInTheDocument())

    const sliderPub = screen.getByLabelText(/Publicação/i) as HTMLInputElement
    expect(sliderPub).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'M1' }))
    expect(sliderPub).toBeDisabled()
  })

  it('busca D18, exibe detalhes do nó e permite afastar na simulação com alcance 0,9554', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByLabelText(/Buscar nó/i)).toBeInTheDocument())

    const input = screen.getByLabelText(/Buscar nó/i)
    fireEvent.change(input, { target: { value: 'D18' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(screen.getByRole('region', { name: 'Detalhes de D18' })).toBeInTheDocument())
    expect(screen.getByText('Vínculos mais fortes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Afastar na simulação' }))
    await waitFor(() => expect(screen.getByText('0,9554')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Reintegrar D18' })).toBeInTheDocument()
  })
})
