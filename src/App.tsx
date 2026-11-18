import { useEffect, useMemo, useState } from 'react'
import { NetworkView, PALETA } from './NetworkView'
import { calculaM2, type Rede } from './lib/rede'
import { useLouvain } from './lib/useLouvain'
import { useStore } from './store'

const NOMES = { P: 'Publicação', F: 'Formação', J: 'Projeto' } as const
export default function App() {
  const [rede, setRede] = useState<Rede | null>(null), [erro, setErro] = useState('')
  const { pesos, resolucao, modo, sel, setPeso, setResolucao, setModo, reinicia } = useStore()
  useEffect(() => {
    const ac = new AbortController()
    fetch(`${import.meta.env.BASE_URL}rede.json`, { signal: ac.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setRede)
      .catch(e => { if (e.name !== 'AbortError') setErro(String(e)) })
    return () => ac.abort()
  }, [])
  const w = useMemo(() => (rede ? calculaM2(rede, pesos) : new Float64Array()), [rede, pesos])
  const { com } = useLouvain(rede, w, resolucao)
  if (erro) return <p className="err">Não foi possível carregar os dados: {erro}</p>
  if (!rede || !com) return <p className="err">Carregando…</p>
  const grupos = com.tamanhos.filter(n => n > 1).length
  return (
    <div id="app">
      <NetworkView rede={rede} w={w} com={com} />
      <header className="ttl"><div className="kick">UNIFEI · Instituto de Matemática e Computação</div><h1>Rede de cooperação <em>científica</em></h1></header>
      <section className="card ctl">
        <h2>Pesos do M2</h2>
        {(Object.keys(NOMES) as (keyof typeof NOMES)[]).map(k => (
          <label key={k} className="sl"><span>{NOMES[k]}</span><b>{pesos[k].toFixed(2).replace('.', ',')}</b>
            <input type="range" min={0} max={1} step={0.05} value={pesos[k]} onChange={e => setPeso(k, +e.target.value)} /></label>))}
        <h2>Resolução do Louvain <b className="mono">{resolucao.toFixed(1).replace('.', ',')}</b></h2>
        <input type="range" min={0.4} max={2} step={0.1} value={resolucao} onChange={e => setResolucao(+e.target.value)} />
        <h2>Cor dos docentes</h2>
        <div className="seg">{(['comunidade', 'area'] as const).map(m => <button key={m} className={modo === m ? 'on' : ''} onClick={() => setModo(m)}>{m === 'area' ? 'Área' : 'Comunidade'}</button>)}</div>
        <button className="btn" onClick={reinicia}>Restaurar pesos do artigo</button>
      </section>
      <section className="card res">
        <div className="kick">Comunidades entre docentes</div>
        <div className="kp"><div><b>{com.Q.toFixed(3).replace('.', ',')}</b><small>modularidade Q</small></div><div><b>{grupos}</b><small>grupos (≥ 2 docentes)</small></div></div>
        {com.tamanhos.map((n, i) => n > 1 && <div key={i} className="row"><i style={{ background: PALETA[i % PALETA.length] }} /><span>Grupo {i + 1}</span><b>{n}</b></div>)}
      </section>
      {sel !== null && <section className="card insp"><div className="kick">{rede.nos[sel][0].startsWith('D') ? 'Docente' : 'Colaborador externo'}</div><div className="code">{rede.nos[sel][0]}</div></section>}
      <p className="note">Louvain sobre a rede entre docentes ponderada pelo M2 (melhor de 20 execuções). Evidência relacional, não mede mérito.</p>
    </div>)
}
