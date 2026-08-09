// Renderiza los diagramas .mmd (Mermaid) a .svg y .pdf
//
// mmdc (mermaid-cli) usa Puppeteer por debajo, que a su vez necesita un
// binario de Chromium para poder renderizar. Ese binario NO viene incluido
// en el paquete npm de puppeteer-core (el que trae @mermaid-js/mermaid-cli
// como dependencia): hay que descargarlo aparte.
//
// En vez de depender de que cada integrante tenga Chromium instalado en el
// sistema (distinto en Windows/Mac/Linux), este script descarga un Chromium
// propio dentro del repo, en .cache/puppeteer/ (mismo patron que
// scripts/installLatex.ts usa para TinyTeX en .texlive/), usando
// @puppeteer/browsers (el instalador oficial standalone, sin depender del
// paquete 'puppeteer' completo).
//
// El auto-deteccion de rutas de puppeteer-core (buscar una revision fija
// como 1108766 dentro de PUPPETEER_CACHE_DIR) no es confiable: la version
// que en verdad se descarga con "chrome@stable" puede traer otra revision.
// Por eso NO se confia en el auto-detect: se pide a @puppeteer/browsers la
// ruta exacta del ejecutable ya instalado, y se la pasa a mmdc de forma
// explicita mediante un archivo de configuracion de Puppeteer
// (--puppeteerConfigFile), que es el mecanismo soportado por mermaid-cli
// para esto.
//
// Se genera un .pdf por cada diagrama ademas del .svg: el informe lo
// incluye via \includegraphics (informe/formato.tex), NO via \includesvg
// del paquete svg, porque ese paquete necesita invocar el binario de
// Inkscape instalado en el sistema para convertir el svg a pdf en tiempo
// de compilacion -- justo lo que este proyecto evita usando el Chromium
// local via Puppeteer, igual que ya se usa para renderizar el .mmd a .svg.
// El .svg se sigue generando igual (se versiona, es diffable y sirve para
// previsualizar el diagrama en el editor).

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, basename } from "node:path";
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
  resolveBuildId,
  Browser,
} from "@puppeteer/browsers";

const REPO_ROOT = `${import.meta.dir}/..`;
const SRC_DIR = `${REPO_ROOT}/diagramas/src`;
const OUT_DIR = `${REPO_ROOT}/diagramas/output`;
const CACHE_DIR = `${REPO_ROOT}/.cache/puppeteer`;
const PUPPETEER_CONFIG_PATH = `${REPO_ROOT}/.cache/puppeteer-config.json`;

async function ejecutar(cmd: string[]) {
  const proceso = Bun.spawn(cmd, {
    cwd: REPO_ROOT,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  return proceso.exited;
}

// Resuelve la ruta del ejecutable de Chrome ya instalado en CACHE_DIR para
// la plataforma y build actuales. Si no esta instalado, lo descarga primero.
// Esta es la unica fuente de verdad para la ruta: nunca se adivina ni se
// hardcodea un numero de revision.
async function asegurarChromiumLocal(): Promise<string> {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error("No se pudo detectar la plataforma actual para descargar Chromium.");
  }

  const buildId = await resolveBuildId(Browser.CHROME, platform, "stable");

  const rutaEsperada = computeExecutablePath({
    cacheDir: CACHE_DIR,
    browser: Browser.CHROME,
    buildId,
  });

  if (existsSync(rutaEsperada)) {
    return rutaEsperada;
  }

  console.log("No se encontro Chromium local, descargando (una sola vez)...");
  mkdirSync(CACHE_DIR, { recursive: true });

  const instalado = await install({
    cacheDir: CACHE_DIR,
    browser: Browser.CHROME,
    buildId,
    downloadProgressCallback: (descargado, total) => {
      if (total > 0 && descargado === total) {
        console.log("Descarga de Chromium completa, extrayendo...");
      }
    },
  });

  console.log(`Chromium local instalado en ${instalado.executablePath}`);
  return instalado.executablePath;
}

// mermaid-cli (mmdc) acepta un archivo de configuracion de Puppeteer via
// --puppeteerConfigFile. Ahi es donde se le indica el executablePath exacto,
// en vez de dejar que puppeteer-core intente adivinarlo.
function escribirConfigPuppeteer(executablePath: string) {
  mkdirSync(`${REPO_ROOT}/.cache`, { recursive: true });
  writeFileSync(
    PUPPETEER_CONFIG_PATH,
    JSON.stringify({ executablePath }, null, 2)
  );
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.log(`No existe ${SRC_DIR}`);
    return;
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const executablePath = await asegurarChromiumLocal();
  escribirConfigPuppeteer(executablePath);

  const entradas: string[] = readdirSync(SRC_DIR);
  const archivosMermaid = entradas.filter((archivo) => archivo.endsWith(".mmd"));

  if (archivosMermaid.length === 0) {
    console.log(`No hay archivos .mmd en ${SRC_DIR}`);
    return;
  }

  for (const archivo of archivosMermaid) {
    const nombre = basename(archivo, ".mmd");
    const entrada = join(SRC_DIR, archivo);
    const salidaSvg = join(OUT_DIR, `${nombre}.svg`);
    const salidaPdf = join(OUT_DIR, `${nombre}.pdf`);

    console.log(`Renderizando ${nombre}...`);

    for (const salida of [salidaSvg, salidaPdf]) {
      const codigoSalida = await ejecutar([
        "bunx",
        "mmdc",
        "-i",
        entrada,
        "-o",
        salida,
        "--puppeteerConfigFile",
        PUPPETEER_CONFIG_PATH,
      ]);

      if (codigoSalida !== 0) {
        console.error(`Fallo al renderizar ${nombre} (${salida}) (codigo ${codigoSalida})`);
        process.exit(codigoSalida);
      }
    }
  }

  console.log(`Listo. Diagramas generados en ${OUT_DIR}/`);
}

main();
