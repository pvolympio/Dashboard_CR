import { comunidadesSubgrafo, type Comunidades, type SubgrafoDocentes } from '../lib/rede'

export type WorkerRequest =
  | { type: 'init'; sub: SubgrafoDocentes }
  | { type: 'run'; id: number; w: Float64Array; resolucao: number }

export type WorkerResponse = { id: number; com: Comunidades }

let subgrafo: SubgrafoDocentes | null = null

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'init') {
    subgrafo = msg.sub
    return
  }
  if (msg.type === 'run' && subgrafo) {
    const com = comunidadesSubgrafo(subgrafo, msg.w, msg.resolucao)
    const res: WorkerResponse = { id: msg.id, com }
    self.postMessage(res)
  }
})
