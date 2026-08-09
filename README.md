# Investigación 1, Sistema de Gestión Académica XUNA

![LaTeX](https://img.shields.io/badge/LaTeX-informe-008080?logo=latex&logoColor=white)
![C](https://img.shields.io/badge/C-implementación-A8B9CC?logo=c&logoColor=white)
![Mermaid](https://img.shields.io/badge/Mermaid-diagramas-FF3670?logo=mermaid&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-scripts-000000?logo=bun&logoColor=white)

Curso EIF207, Estructuras de Datos, Universidad Nacional de Costa Rica.
Este repositorio contiene el trabajo de la Investigación 1: el diseño de un Sistema de Gestión Académica para la Universidad XUNA,

## Compilar el informe

```bash
bun install
# Opcional instalar latex minimo si el sistema no lo tiene
bun run install:latex
# Generar a mano
bun run build:pdf
```
### Generar diagramas
```bash
bun run build:diagrams
```