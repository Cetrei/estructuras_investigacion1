// Instala TinyTeX local unicamente en el repo
//
// Paquetes instalados (derivados de informe/formato.tex y main.tex):
//   apa7            -> \documentclass[stu]{apa7}
//   babel + spanish -> \usepackage[spanish,es-tabla]{babel}
//   biblatex        -> \usepackage[style=apa,backend=biber]{biblatex}
//   biblatex-apa    -> estilo APA para biblatex
//   biber           -> backend de bibliografia (binario, se instala aparte)
//   pgf (tikz)      -> \usepackage{tikz}, usado por apa7 internamente
//   svg             -> \usepackage{svg}, para incrustar diagramas
//   transparent     -> provee transparent.sty, requerido internamente por svg
//   (oberdiek NO trae transparent.sty en TeX Live moderno, se separo a su
//   propio paquete 'transparent'. Se deja oberdiek en la lista igual
//   porque cubre otras dependencias transitivas comunes de hyperref/svg.)
//   listings        -> \usepackage{listings}, bloques de pseudocodigo
//   xcolor          -> \usepackage{xcolor}
//   booktabs        -> \usepackage{booktabs}, tablas con lineas prolijas
//   (longtable se usa via \usepackage{longtable} pero no es un paquete
//   instalable por separado en TeX Live moderno: viene incluido en
//   collection-fontsrecommended / dependencias de apa7 y biblatex.
//   Intentar 'tlmgr install longtable' falla con "not present in
//   repository" en cualquier mirror.)
//   hyperref        -> \usepackage{hyperref}, enlaces internos
//   threeparttable  -> usado por apa7
//   caption         -> usado por apa7
//   fancyhdr        -> usado por apa7 (encabezados)
//   endfloat        -> usado por apa7 (figuras/tablas al final, modo stu)
//   scalerel        -> usado por apa7
//   etoolbox        -> usado por apa7 y varios paquetes mas
//   geometry        -> margenes
//   collection-fontsrecommended -> fuentes (latin-modern, etc.)
//   trimspaces, comment, bigfoot, totpages, ifmtarg -> dependencias
//   transitivas comunes de apa7/biblatex

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const REPO_ROOT = `${import.meta.dir}/..`;
const TEXLIVE_DIR = `${REPO_ROOT}/.texlive`;
const TINYTEX_ROOT = `${TEXLIVE_DIR}/.TinyTeX`; // TinyTeX siempre crea esta subcarpeta
const VSCODE_SETTINGS_PATH = `${REPO_ROOT}/.vscode/settings.json`;

const PAQUETES = [
  "apa7",
  "babel",
  "babel-spanish",
  "biblatex",
  "biblatex-apa",
  "biber",
  "pgf",
  "svg",
  "oberdiek",
  "transparent",
  "trimspaces",
  "listings",
  "xcolor",
  "booktabs",
  "hyperref",
  "threeparttable",
  "caption",
  "fancyhdr",
  "endfloat",
  "scalerel",
  "etoolbox",
  "geometry",
  "collection-fontsrecommended",
  "comment",
  "bigfoot",
  "totpages",
  "ifmtarg",
];

function esWindows() {
  return process.platform === "win32";
}

async function ejecutar(cmd: string[], opts?: { cwd?: string; env?: Record<string, string | undefined> }) {
  const proceso = Bun.spawn(cmd, {
    cwd: opts?.cwd,
    env: opts?.env ? { ...process.env, ...opts.env } : process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const codigo = await proceso.exited;
  if (codigo !== 0) {
    throw new Error(`Comando fallo (codigo ${codigo}): ${cmd.join(" ")}`);
  }
}

async function instalarTinyTeXLinuxMac() {
  console.log("Descargando e instalando TinyTeX (Linux/macOS)...");
  mkdirSync(TEXLIVE_DIR, { recursive: true });

  // TINYTEX_DIR es la carpeta PADRE donde el instalador crea su propia
  // subcarpeta .TinyTeX/ (TINYTEX_DIR=.texlive resulta en .texlive/.TinyTeX/,
  // que es exactamente TINYTEX_ROOT). Pasarle TINYTEX_ROOT directamente
  // anida dos veces: .texlive/.TinyTeX/.TinyTeX/.
  //
  // No se usa --no-path: ese flag causa un bug de parseo en este instalador
  // (confunde el flag con el argumento posicional de destino del .tar.xz
  // descargado y falla el 'mv'). Sin el flag, el instalador agrega symlinks
  // en ~/.local/bin apuntando a esta carpeta del repo, comportamiento
  // estandar documentado de TinyTeX.
  await ejecutar(
    ["bash", "-c", "wget -qO- https://yihui.org/tinytex/install-bin-unix.sh | sh"],
    { cwd: TEXLIVE_DIR, env: { TINYTEX_DIR: TEXLIVE_DIR } }
  );
}

async function instalarTinyTeXWindows() {
  console.log("Descargando e instalando TinyTeX (Windows)...");
  mkdirSync(TEXLIVE_DIR, { recursive: true });

  const rutaWin = TEXLIVE_DIR.replace(/\//g, "\\");
  const script = `
    $env:TINYTEX_DIR = "${rutaWin}"
    Invoke-WebRequest -Uri "https://yihui.org/tinytex/install-bin-windows.bat" -OutFile "$env:TEMP\\install-tinytex.bat"
    & "$env:TEMP\\install-tinytex.bat"
  `;
  await ejecutar(["powershell", "-NoProfile", "-Command", script]);
}

// TinyTeX instala los binarios dentro de .texlive/.TinyTeX/bin/<arch>/, donde <arch> varia segun el sistema (windows, x86_64-linux, universal-darwin).
function resolverBinDirLocal(): string | null {
  const binBase = `${TINYTEX_ROOT}/bin`;
  if (!existsSync(binBase)) return null;
  const carpetas = readdirSync(binBase);
  if (carpetas.length === 0) return null;
  return `${binBase}/${carpetas[0]}`;
}

// Actualiza latex-workshop.latex.path en .vscode/settings.json con la
// carpeta de arquitectura real detectada tras instalar TinyTeX (varia por
// SO: x86_64-linux, windows, universal-darwin), sin tocar el resto de las
// claves que ya haya en el archivo (ltex.language, rootFile.path, etc).
// Este setting es especifico de la maquina de cada quien, pero se escribe
// automaticamente asi nadie tiene que editarlo a mano.
function actualizarRutaVSCode() {
  const binDir = resolverBinDirLocal();
  if (!binDir) return;

  // Ruta relativa al workspace, con el mismo prefijo %WORKSPACE_FOLDER%
  // que ya usa latex-workshop.latex.rootFile.path en este repo.
  const rutaRelativa = binDir.slice(REPO_ROOT.length + 1); // quita "REPO_ROOT/"
  const rutaVSCode = `%WORKSPACE_FOLDER%/${rutaRelativa}`;

  let settings: Record<string, unknown> = {};
  if (existsSync(VSCODE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(VSCODE_SETTINGS_PATH, "utf-8"));
    } catch {
      console.warn("Aviso: .vscode/settings.json no es JSON valido, no se actualiza la ruta de LaTeX.");
      return;
    }
  } else {
    mkdirSync(`${REPO_ROOT}/.vscode`, { recursive: true });
  }

  settings["latex-workshop.latex.path"] = rutaVSCode;
  writeFileSync(VSCODE_SETTINGS_PATH, `${JSON.stringify(settings, null, 4)}\n`);
  console.log(`Actualizado .vscode/settings.json con latex-workshop.latex.path = ${rutaVSCode}`);
}

async function instalarPaquetes() {
  console.log("Instalando paquetes LaTeX necesarios...");
  const binDir = resolverBinDirLocal();
  if (!binDir) {
    throw new Error(
      `No se encontro la carpeta de binarios de TinyTeX en ${TINYTEX_ROOT}/bin tras la instalacion.`
    );
  }

  const tlmgr = esWindows() ? `${binDir}/tlmgr.bat` : `${binDir}/tlmgr`;

  await ejecutar([tlmgr, "update", "--self"]);

  // Se instala paquete por paquete en vez de en un solo comando: tlmgr
  // aborta el proceso completo con exit code 1 si UN SOLO paquete de la
  // lista no existe en el repositorio (ej. nombres que cambiaron o se
  // fusionaron entre versiones de TeX Live), incluso si ya instalo
  // exitosamente el resto. Instalando de a uno, un paquete no disponible
  // se reporta y se salta sin tumbar los demas.
  const fallidos: string[] = [];
  for (const paquete of PAQUETES) {
    try {
      await ejecutar([tlmgr, "install", paquete]);
    } catch (error) {
      console.warn(`  ! No se pudo instalar '${paquete}', se omite: ${(error as Error).message}`);
      fallidos.push(paquete);
    }
  }

  if (fallidos.length > 0) {
    console.warn(
      `\nPaquetes omitidos (${fallidos.length}): ${fallidos.join(", ")}. \n` +
      "Revisar si cambiaron de nombre o ya vienen incluidos en otra dependencia."
    );
  }
}

async function main() {
  if (existsSync(TINYTEX_ROOT)) {
    console.log(".texlive/.TinyTeX ya existe, saltando instalacion base.");
    console.log("Para reinstalar desde cero, borrar la carpeta .texlive/ primero.");
  } else if (esWindows()) {
    await instalarTinyTeXWindows();
  } else {
    await instalarTinyTeXLinuxMac();
  }

  await instalarPaquetes();
  actualizarRutaVSCode();

  console.log("");
  console.log("Listo. LaTeX local instalado en .texlive/.TinyTeX/");
  console.log("Correr 'bun run build:pdf' para compilar el informe.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
