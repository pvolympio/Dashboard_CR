import { describe, expect, it } from 'vitest'
import { PESOS_PADRAO } from './rede'
import { parseHash, serializaHash } from './urlState'

describe('Estado na URL (hash)', () => {
  it('serializa e restaura estado completo sem dados sensíveis', () => {
    const hash = serializaHash({
      modelo: 'M3',
      pesos: PESOS_PADRAO,
      resolucao: 1.4,
      modoCor: 'area',
      modoTamanho: 'forca',
      visao: 'ego',
      selCodigo: 'D18',
    })
    const parsed = parseHash(hash)
    expect(parsed.modelo).toBe('M3')
    expect(parsed.resolucao).toBe(1.4)
    expect(parsed.modoCor).toBe('area')
    expect(parsed.modoTamanho).toBe('forca')
    expect(parsed.visao).toBe('ego')
    expect(parsed.selCodigo).toBe('D18')
    expect(parsed.pesos?.P).toBeCloseTo(0.5, 2)
  })

  it('ignora códigos inválidos e valores fora de faixa', () => {
    const parsed = parseHash('#m=INVALIDO&r=99&s=1234567890123456')
    expect(parsed.modelo).toBeUndefined()
    expect(parsed.resolucao).toBeUndefined()
    expect(parsed.selCodigo).toBeUndefined()
  })
})
