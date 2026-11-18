#!/usr/bin/env python3
"""Exporta a rede pseudonimizada do IMC para o dashboard (public/rede.json). Só sai o rótulo (D01-D48 / X0xxxx), nunca o id Lattes."""
import json, numpy as np, pandas as pd, networkx as nx
n = pd.read_csv("dados/rede/nos.csv", encoding="utf-8-sig"); e = pd.read_csv("dados/rede/arestas.csv", encoding="utf-8-sig")
idx = {v: i for i, v in enumerate(n.id)}
G = nx.Graph(); G.add_nodes_from(range(len(n))); G.add_edges_from((idx[s], idx[t], {"w": float(w)}) for s, t, w in zip(e.source, e.target, e.M2))
pos = nx.spring_layout(G, k=0.06, iterations=250, seed=7, weight=None)
P = np.array([pos[i] for i in range(len(n))]); P = (P - P.mean(0)) / np.abs(P - P.mean(0)).max()
T = [c for c in e.columns if c.startswith("n_") and c != "n_eventos"]
cam = sorted(n.camada.unique()); cat = sorted(n.categoria.astype(str).unique())
out = dict(
    camadas=cam, categorias=cat,
    nos=[[r.rotulo, cam.index(r.camada), cat.index(str(r.categoria)), round(float(P[i, 0]), 4), round(float(P[i, 1]), 4)] for i, r in enumerate(n.itertuples())],
    tipos=T, arestas=[[idx[r.source], idx[r.target], round(r.M1, 3), round(r.M2, 4), round(r.M3, 4)] + [round(float(x), 3) for x in e.loc[i, T]] for i, r in enumerate(e.itertuples())])
assert not any(str(r[0]).isdigit() and len(str(r[0])) > 8 for r in out["nos"]), "id Lattes vazou"
json.dump(out, open("public/rede.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(n), len(e), cam, cat, round(len(json.dumps(out)) / 1024), "KB")
