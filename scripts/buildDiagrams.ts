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

function escribirConfigPuppeteer(executablePath: string) {
  mkdirSync(`${REPO_ROOT}/.cache`, { recursive: true });

  const esCI = process.env.CI === "true" || process.env.CI === "1";

  writeFileSync(
    PUPPETEER_CONFIG_PATH,
    JSON.stringify(
      {
        executablePath,
        ...(esCI ? { args: ["--no-sandbox", "--disable-setuid-sandbox"] } : {}),
      },
      null,
      2
    )
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
