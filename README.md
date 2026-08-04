# Investigación 1, Sistema de Gestión Académica XUNA

![LaTeX](https://img.shields.io/badge/LaTeX-informe-008080?logo=latex&logoColor=white)
![C](https://img.shields.io/badge/C-implementación-A8B9CC?logo=c&logoColor=white)
![Mermaid](https://img.shields.io/badge/Mermaid-diagramas-FF3670?logo=mermaid&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-scripts-000000?logo=bun&logoColor=white)

Curso EIF207, Estructuras de Datos, Universidad Nacional de Costa Rica.
Este repositorio contiene el trabajo de la Investigación 1: el diseño de un Sistema de Gestión Académica para la Universidad XUNA,

## Contenido del repositorio

```
.
├── informe/              Informe técnico en LaTeX
│   ├── main.tex            documento principal (ensambla todas las secciones)
│   ├── formato.tex           paquetes y configuración compartida
│   ├── referencias.bib       fuentes citadas
│   └── secciones/            un archivo .tex por cada apartado del informe
│
├── diagramas/            Diagramas de las estructuras propuestas
│   ├── src/                fuentes Mermaid (.mmd)
│   └── output/               SVG renderizados, incrustados en el informe
│
├── docs/decisiones/      Registro de decisiones de arquitectura (ADRs)
│
├── include/               Cabeceras (.h)
│
├── src/                    Implementacion (.c)
│
└── data/                    Archivos .dat
```

## Compilar el informe

```bash
bun install
bun run build:pdf
```

Genera `informe/main.pdf`. Requiere una distribución de LaTeX instalada, ver [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Para el equipo

Las instrucciones de flujo de trabajo en Git, cómo editar secciones del informe, generar diagramas y la configuración recomendada del editor están en [`CONTRIBUTING.md`](./CONTRIBUTING.md).
