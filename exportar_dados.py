#!/usr/bin/env python3
"""Exporta a rede pseudonimizada de um instituto para o dashboard (public/rede.json).
Só sai o rótulo (D01-D48 / X0xxxx), nunca o id Lattes."""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
import networkx as nx


def exportar(instituto: str, entrada: Path, saida: Path) -> None:
    n = pd.read_csv(entrada / "nos.csv", encoding="utf-8-sig")
    e = pd.read_csv(entrada / "arestas.csv", encoding="utf-8-sig")
    idx = {v: i for i, v in enumerate(n.id)}
    G = nx.Graph()
    G.add_nodes_from(range(len(n)))
    G.add_edges_from((idx[s], idx[t], {"w": float(w)}) for s, t, w in zip(e.source, e.target, e.M2))
    pos = nx.spring_layout(G, k=0.06, iterations=250, seed=7, weight=None)
    P = np.array([pos[i] for i in range(len(n))])
    P = (P - P.mean(0)) / np.abs(P - P.mean(0)).max()
    T = [c for c in e.columns if c.startswith("n_") and c != "n_eventos"]
    cam = sorted(n.camada.unique())
    cat = sorted(n.categoria.astype(str).unique())
    inst_col = n["instituto"].fillna(instituto) if "instituto" in n.columns else [instituto if c != "Externo" else "Externo" for c in n.camada]
    insts = sorted({str(x) for x in inst_col})

    out = dict(
        instituto=instituto,
        institutos=insts,
        camadas=cam,
        categorias=cat,
        nos=[
            [
                r.rotulo,
                cam.index(r.camada),
                cat.index(str(r.categoria)),
                round(float(P[i, 0]), 4),
                round(float(P[i, 1]), 4),
                insts.index(str(inst_col[i] if isinstance(inst_col, list) else inst_col.iloc[i])),
            ]
            for i, r in enumerate(n.itertuples())
        ],
        tipos=T,
        arestas=[
            [idx[r.source], idx[r.target], round(r.M1, 3), round(r.M2, 4), round(r.M3, 4)]
            + [round(float(x), 3) for x in e.loc[i, T]]
            for i, r in enumerate(e.itertuples())
        ],
    )
    assert not any(str(r[0]).isdigit() and len(str(r[0])) > 8 for r in out["nos"]), "id Lattes vazou"
    saida.parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(saida, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(instituto, len(n), len(e), cam, cat, round(len(json.dumps(out)) / 1024), "KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Exporta rede pseudonimizada por instituto.")
    ap.add_argument("--instituto", default="IMC", help="Sigla do instituto (padrão: IMC)")
    ap.add_argument("--entrada", type=Path, default=Path("dados/rede"), help="Diretório com nos.csv e arestas.csv")
    ap.add_argument("--saida", type=Path, default=Path("public/rede.json"), help="Arquivo JSON de saída")
    args = ap.parse_args()
    exportar(args.instituto, args.entrada, args.saida)
