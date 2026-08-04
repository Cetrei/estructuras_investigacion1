# Guía para colaboradores

## Cómo trabajar en el informe

Cada apartado del informe vive en su propio archivo dentro de
`informe/secciones/`.

### Compilar el PDF

El proyecto usa LaTeX instalado local al repo (TinyTeX, en `.texlive/`), no una instalación del sistema.

#### 1. Instalar LaTeX local

```bash
bun install
bun run install:latex
```

Descarga TinyTeX en `.texlive/.TinyTeX/` e instala los paquetes necesarios (`apa7`, `babel` + español, `biblatex` + `biblatex-apa`, `biber`, `tikz`, `svg`, `listings`, `hyperref`, etc. Lista completa en `scripts/installLatex.ts`).

En Linux requiere `wget` (`which wget` para confirmar).

#### 2. Compilar

```bash
bun run build:pdf
```

Detecta el LaTeX local en `.texlive/.TinyTeX/` y lo usa. Si no existe, cae a `latexmk` del PATH del sistema.

#### Con extension de VSCode
Con **LaTeX Workshop**, abrir `informe/main.tex` y compilar con `Ctrl+Alt+B` (mejor hacerlo desde main para descartar errores).

La extensión no usa el LaTeX local automáticamente, busca en el PATH del sistema. Para que lo use, apuntar `latex-workshop.latex.path` en `.vscode/settings.json` a `.texlive/.TinyTeX/bin/<arch>/`.

Si la extensión se cuelga después de un error de compilación, reiniciar VSCode.

#### Desinstalar LaTeX del sistema (si se tenia instaladao)

- **Arch/CachyOS**: `sudo pacman -Rns $(pacman -Qq | grep '^texlive')`
- **Windows**: desinstalar TeX Live o MiKTeX desde "Agregar o quitar programas"

## Cómo trabajar en los diagramas

Los diagramas se escriben en Mermaid dentro de `diagramas/src/*.mmd` y se renderizan a SVG en `diagramas/output/` para incrustarlos en el informe.

```bash
bun install
bun run build:diagrams
```

Esto recorre todos los `.mmd` de `diagramas/src/` y genera su SVG correspondiente en `diagramas/output/` con el mismo nombre de archivo.

## Flujo de trabajo en Git

- `main` es la rama estable. Solo se integran ahí secciones o diagramas ya terminados.
- Cada persona trabaja en una rama con el patrón `informe/<seccion>` o
  `diagramas/<nombre>`, por ejemplo:
    - `informe/05-diseno-registro`
    - `diagramas/arreglo-estudiantes`
- Al terminar, se hace merge a `main`.
- Evitar editar `main.tex` salvo que se agregue o reordene una sección completa y mejor avisar

## Extensiones de editor recomendadas

- **LaTeX Workshop**: compilación y previsualización de LaTeX.
- **LTeX**: corrector gramatical y ortográfico. El repositorio ya trae `.vscode/settings.json` configurado en español (`ltex.language: es`)
- **Markdown Preview Mermaid Support**: previsualización de los diagramas `.mmd` mientras se editan.

## Flujo de commits (Conventional Commits + commitlint)

El repo usa [Conventional Commits](https://www.conventionalcommits.org/) para el mensaje de cada commit, forzado con `commitlint` via un git hook. Esto da un historial legible y permite generar un changelog automatico mas adelante si hace falta.

### Formato del mensaje

```
<tipo>(<alcance opcional>): <descripcion corta en minuscula, sin punto final>

<cuerpo opcional, explica el que y el porque, no el como>

<footer opcional, ej. BREAKING CHANGE: ... o Refs: #12>
```

Tipos permitidos:

| Tipo       | Uso |
|------------|-----|
| `feat`     | contenido o funcionalidad nueva (una seccion nueva del informe, un diagrama nuevo, un script nuevo) |
| `fix`      | corrige algo que estaba mal (paquete faltante, referencia rota, bug en un script) |
| `docs`     | cambios solo de documentacion (README, CONTRIBUTING, ADRs) |
| `chore`    | scaffolding, config, dependencias, tareas que no tocan contenido del informe ni logica |
| `refactor` | reordena o reescribe sin cambiar el resultado (mover secciones, renombrar archivos) |
| `style`    | formato, espacios, sin cambio de contenido |
| `build`    | cambios al proceso de build (`buildPDF.ts`, `installLatex.ts`, `package.json`) |

El alcance (`scope`) es libre pero conviene mantenerlo corto y consistente con las carpetas del repo: `scripts`, `latex`, `diagramas`, `informe`, `docs`, `deps`.

Ejemplos:

```
feat(scripts): agregar script de instalacion de TinyTeX local
fix(scripts): agregar oberdiek a installLatex, requerido por svg.sty
feat(informe): agregar seccion 05-diseno-registro
feat(diagramas): agregar diagrama de arreglo de estudiantes
chore(deps): agregar bun.lock y package.json inicial
docs: documentar flujo de git y convencion de commits en CONTRIBUTING
```

### Instalar commitlint

```bash
bun add -d @commitlint/cli @commitlint/config-conventional husky
```

Crear `commitlint.config.js` en la raiz:

```js
export default {
  extends: ["@commitlint/config-conventional"],
};
```

Activar el hook de `commit-msg` con husky:

```bash
bunx husky init
echo 'bunx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

Con esto, cualquier `git commit` con un mensaje que no siga el formato se rechaza antes de crear el commit, en vez de descubrirlo despues.

### Trabajar en rama y hacer merge

```bash
git checkout -b informe/05-diseno-registro
# ... trabajar en informe/secciones/05-diseno-registro.tex ...
git add informe/secciones/05-diseno-registro.tex
git commit -m "feat(informe): agregar seccion 05-diseno-registro"
git push -u origin informe/05-diseno-registro
# abrir PR o hacer merge directo a main segun lo acordado
```

## Decisiones de diseño

El razonamiento detrás de las decisiones de arquitectura más importantes estan documentado como ADRs en [`docs/decisiones/`](./docs/decisiones/).
