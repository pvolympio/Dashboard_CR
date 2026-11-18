import { criaHandlerLouvain, type WorkerRequest } from './louvainHandler'

const handle = criaHandlerLouvain()

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const res = handle(e.data)
  if (res) self.postMessage(res)
})
