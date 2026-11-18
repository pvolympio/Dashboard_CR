import { useEffect, useMemo, useRef, useState } from 'react'
import { NetworkView, type CameraCtrl } from './NetworkView'
import { SimuladorPanel } from './components/SimuladorPanel'
import { calculaPesos, detalhesNo, filtraRede, type ModeloPeso, type ModoCor, type ModoTamanho, type Rede } from './lib/rede'
import { AREA_CORES, CATEGORIA_CORES, CATEGORIA_NOMES, PALETA, TIPO_NOMES } from './lib/rotulos'
import type { ReferenciaAleatoria } from './lib/simulacao'
import { useLouvain } from './lib/useLouvain'
import { useStore } from './store'

const NOMES_PESO = { P: 'Publicação', F: 'Formação', J: 'Projeto' } as const
const fmtInt = (n: number) => n.toLocaleString('pt-BR')
const fmtDec = (n: number, d = 2) => n.toFixed(d).replace('.', ',')

export default function App() {
  const [rede, setRede] = useState<Rede | null>(null)
  const [refAleat, setRefAleat] = useState<ReferenciaAleatoria | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaErro, setBuscaErro] = useState('')
  const buscaRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<CameraCtrl | null>(null)

  const {
    modelo, pesos, resolucao, modoCor, modoTamanho, filtros, sel, grupoRealcado, afastados, simAberto,
    setModelo, setPeso, setResolucao, setModoCor, setModoTamanho, setFiltro, seleciona, realcaGrupo,
    afastaDocente, toggleSim, reinicia,
  } = useStore()

  useEffect(() => {
    const ac = new AbortController()
    fetch(`${import.meta.env.BASE_URL}rede.json`, { signal: ac.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setRede)
      .catch(e => { if (e.name !== 'AbortError') setErro(String(e)) })
    fetch(`${import.meta.env.BASE_URL}referencia_aleatoria.json`, { signal: ac.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setRefAleat(d) })
      .catch(() => {})
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === '/' && !emInput) {
        e.preventDefault()
        buscaRef.current?.focus()
      } else if (e.key === 'Escape') {
        seleciona(null)
        if (emInput) (e.target as HTMLElement).blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seleciona])

  const w = useMemo(() => (rede ? calculaPesos(rede, modelo, pesos) : new Float64Array()), [rede, modelo, pesos])
  const afastadosSet = useMemo(() => new Set(afastados), [afastados])
  const filtrada = useMemo(() => (rede ? filtraRede(rede, w, filtros, afastadosSet) : null), [rede, w, filtros, afastadosSet])
  const { com } = useLouvain(rede, w, resolucao)

  const membrosPorGrupo = useMemo(() => {
    if (!rede || !com) return [] as string[][]
    const grupos: string[][] = com.tamanhos.map(() => [])
    com.particao.forEach((g, idx) => { grupos[g]?.push(rede.nos[idx][0]) })
    grupos.forEach(lista => lista.sort())
    return grupos
  }, [rede, com])

  const det = useMemo(
    () => (rede && filtrada && sel !== null ? detalhesNo(rede, w, filtrada.arestasVisiveis, com, sel) : null),
    [rede, filtrada, w, com, sel],
  )

  if (erro) return <p className="err">Não foi possível carregar os dados: {erro}</p>
  if (!rede || !filtrada || !com) return <p className="err">Carregando…</p>

  const gruposCount = com.tamanhos.filter(n => n > 1).length
  const maxVinculo = det?.vinculos[0]?.peso || 1

  const onBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    const q = busca.trim().toUpperCase()
    if (!q) return
    const idx = rede.nos.findIndex(n => n[0].toUpperCase() === q)
    if (idx === -1) {
      setBuscaErro(`Código "${q}" não encontrado`)
      return
    }
    setBuscaErro('')
    seleciona(idx)
    camRef.current?.focusNode(idx)
  }

  return (
    <div id="app">
      <NetworkView rede={rede} w={w} filtrada={filtrada} com={com} onCameraReady={c => { camRef.current = c }} />

      <header className="ttl">
        <div className="kick">UNIFEI · Instituto de Matemática e Computação</div>
        <h1>Rede de cooperação <em>científica</em></h1>
        <div className="counts" aria-live="polite">
          <span><b>{fmtInt(filtrada.contagens.nos)}</b> nós</span>
          <span><b>{fmtInt(filtrada.contagens.docentes)}</b> docentes</span>
          <span><b>{fmtInt(filtrada.contagens.arestas)}</b> arestas</span>
        </div>
      </header>

      <aside className="card ctl" aria-label="Controles de exploração">
        <form onSubmit={onBuscar} className="search">
          <label htmlFor="busca-no" className="kick">Buscar nó (/)</label>
          <div className="search-row">
            <input
              id="busca-no"
              ref={buscaRef}
              type="text"
              placeholder="Ex.: D18 ou X00001"
              value={busca}
              onChange={e => { setBusca(e.target.value); if (buscaErro) setBuscaErro('') }}
            />
            <button type="submit" className="btn-sm">Ir</button>
          </div>
          {buscaErro && <div className="search-err" role="status">{buscaErro}</div>}
        </form>

        <h2>Modelo de peso</h2>
        <div className="seg" role="group" aria-label="Modelo de peso das arestas">
          {(['M1', 'M2', 'M3'] as ModeloPeso[]).map(m => (
            <button key={m} type="button" className={modelo === m ? 'on' : ''} aria-pressed={modelo === m} onClick={() => setModelo(m)}>{m}</button>
          ))}
        </div>

        <h2>Pesos do M2 {modelo !== 'M2' && <span className="muted-tag">fixo em {modelo}</span>}</h2>
        {(Object.keys(NOMES_PESO) as (keyof typeof NOMES_PESO)[]).map(k => (
          <label key={k} className={`sl ${modelo !== 'M2' ? 'dis' : ''}`}>
            <span>{NOMES_PESO[k]}</span>
            <b>{fmtDec(pesos[k])}</b>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={modelo !== 'M2'}
              value={pesos[k]}
              onChange={e => setPeso(k, +e.target.value)}
            />
          </label>
        ))}

        <label className="sl">
          <span className="kick-lbl">Resolução do Louvain</span>
          <b className="mono">{fmtDec(resolucao, 1)}</b>
          <input type="range" min={0.4} max={2} step={0.1} value={resolucao} onChange={e => setResolucao(+e.target.value)} />
        </label>

        <h2>Cor dos nós</h2>
        <div className="seg" role="group" aria-label="Critério de cor dos nós">
          {([['comunidade', 'Comunidade'], ['area', 'Área'], ['categoria', 'Categoria']] as [ModoCor, string][]).map(([m, lbl]) => (
            <button key={m} type="button" className={modoCor === m ? 'on' : ''} aria-pressed={modoCor === m} onClick={() => setModoCor(m)}>{lbl}</button>
          ))}
        </div>

        <h2>Tamanho dos nós</h2>
        <div className="seg" role="group" aria-label="Critério de tamanho dos nós">
          {([['grau', 'Grau'], ['forca', 'Força'], ['fixo', 'Fixo']] as [ModoTamanho, string][]).map(([m, lbl]) => (
            <button key={m} type="button" className={modoTamanho === m ? 'on' : ''} aria-pressed={modoTamanho === m} onClick={() => setModoTamanho(m)}>{lbl}</button>
          ))}
        </div>

        <h2>Filtros</h2>
        <div className="checks">
          <label><input type="checkbox" checked={filtros.mat} onChange={e => setFiltro('mat', e.target.checked)} /> Matemática</label>
          <label><input type="checkbox" checked={filtros.comp} onChange={e => setFiltro('comp', e.target.checked)} /> Computação</label>
          <label><input type="checkbox" checked={filtros.ext} onChange={e => setFiltro('ext', e.target.checked)} /> Externos</label>
        </div>
        <label className="sl">
          <span>Peso mínimo (percentil)</span>
          <b>{filtros.percentil}%</b>
          <input type="range" min={0} max={95} step={5} value={filtros.percentil} onChange={e => setFiltro('percentil', +e.target.value)} />
        </label>

        <button type="button" className="btn" onClick={reinicia}>Restaurar padrão</button>
      </aside>

      <section className="card res" aria-label="Comunidades entre docentes">
        <div className="kick">Comunidades entre docentes</div>
        <div className="kp" aria-live="polite">
          <div><b>{fmtDec(com.Q, 3)}</b><small>modularidade Q</small></div>
          <div><b>{gruposCount}</b><small>grupos (≥ 2 docentes)</small></div>
        </div>
        <div className="groups">
          {com.tamanhos.map((n, i) => n > 1 && (
            <div key={i} className={`grp ${grupoRealcado === i ? 'on' : ''}`}>
              <button
                type="button"
                className="row-btn"
                aria-pressed={grupoRealcado === i}
                onClick={() => realcaGrupo(i)}
              >
                <i style={{ background: PALETA[i % PALETA.length] }} />
                <span>Grupo {i + 1}</span>
                <b>{n}</b>
              </button>
              <div className="grp-membros">
                {membrosPorGrupo[i].map(cod => (
                  <button
                    key={cod}
                    type="button"
                    className="chip-doc"
                    onClick={() => {
                      const idx = rede.nos.findIndex(no => no[0] === cod)
                      if (idx !== -1) { seleciona(idx); camRef.current?.focusNode(idx) }
                    }}
                  >{cod}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {det && (
        <section className="card insp" aria-label={`Detalhes de ${det.codigo}`}>
          <div className="insp-head">
            <div>
              <div className="kick">{det.ehDoc ? `Docente · ${det.camada}` : CATEGORIA_NOMES[det.categoria] ?? det.categoria}</div>
              <div className="code">{det.codigo}</div>
            </div>
            <button type="button" className="btn-icon" aria-label="Limpar seleção" onClick={() => seleciona(null)}>×</button>
          </div>
          <div className="insp-meta" aria-live="polite">
            <div><small>Grau</small><b>{det.grau}</b></div>
            <div><small>Força</small><b>{fmtDec(det.forca, 2)}</b></div>
            {det.comunidade !== null && <div><small>Comunidade</small><b>Grupo {det.comunidade + 1}</b></div>}
          </div>
          {det.ehDoc && (
            <button
              type="button"
              className="btn-af"
              onClick={() => { afastaDocente(det.idx); toggleSim(true) }}
            >
              Afastar na simulação
            </button>
          )}
          {det.porTipo.some(t => t.total > 0) && (
            <div className="insp-sec">
              <div className="kick">Cooperações por tipo</div>
              <ul className="tipo-list">
                {det.porTipo.filter(t => t.total > 0).map(t => (
                  <li key={t.tipo}><span>{TIPO_NOMES[t.tipo] ?? t.tipo}</span><b>{fmtInt(Math.round(t.total))}</b></li>
                ))}
              </ul>
            </div>
          )}
          {det.vinculos.length > 0 && (
            <div className="insp-sec">
              <div className="kick">Vínculos mais fortes</div>
              <ul className="vinc-list">
                {det.vinculos.map(v => (
                  <li key={v.idx}>
                    <button type="button" onClick={() => { seleciona(v.idx); camRef.current?.focusNode(v.idx) }}>
                      <span className="v-cod">{v.codigo}</span>
                      <span className="v-bar"><i style={{ width: `${Math.max(4, (v.peso / maxVinculo) * 100)}%` }} /></span>
                      <b className="v-val">{fmtDec(v.peso, 3)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className={`hud-bot ${simAberto ? 'sim-up' : ''}`}>
        <div className="card legend" aria-label="Legenda de cores">
          {modoCor === 'area' && (
            <>
              <span><i style={{ background: AREA_CORES['Matemática'] }} />Matemática</span>
              <span><i style={{ background: AREA_CORES['Computação'] }} />Computação</span>
              <span><i style={{ background: AREA_CORES.Externo }} />Externo</span>
            </>
          )}
          {modoCor === 'categoria' && Object.entries(CATEGORIA_NOMES).map(([k, nome]) => (
            <span key={k}><i style={{ background: CATEGORIA_CORES[k] }} />{nome}</span>
          ))}
          {modoCor === 'comunidade' && (
            <>
              <span><i style={{ background: PALETA[0] }} />Docentes por grupo</span>
              <span><i style={{ background: AREA_CORES.Externo }} />Externo</span>
            </>
          )}
        </div>
        <div className="card zoom-bar" role="group" aria-label="Controles de zoom">
          <button type="button" aria-label="Aumentar zoom" onClick={() => camRef.current?.zoomIn()}>+</button>
          <button type="button" aria-label="Diminuir zoom" onClick={() => camRef.current?.zoomOut()}>−</button>
          <button type="button" aria-label="Reiniciar enquadramento" onClick={() => camRef.current?.reset()}>↺</button>
        </div>
      </div>

      <SimuladorPanel rede={rede} w={w} refAleat={refAleat} />

      <p className="note">Evidência relacional; não mede mérito nem desempenho.</p>
    </div>
  )
}
