import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, basename } from "node:path";
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
  resolveBuildId,
  Browser,
} from "@puppeteer/browsers";
import puppeteer from "puppeteer-core";

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

// SVGs que llegan ya renderizados (p. ej. exportados a mano desde Mermaid Live)
// y no tienen un .mmd fuente en diagramas/src/. Se convierten a PDF directamente
// via Chromium/Puppeteer, sin pasar por mmdc.
async function convertirSvgsSueltos(executablePath: string) {
  const entradasSrc = existsSync(SRC_DIR) ? readdirSync(SRC_DIR) : [];
  const nombresConMmd = new Set(
    entradasSrc.filter((a) => a.endsWith(".mmd")).map((a) => basename(a, ".mmd"))
  );

  const entradasOut = readdirSync(OUT_DIR);
  const svgsSueltos = entradasOut.filter((archivo) => {
    if (!archivo.endsWith(".svg")) return false;
    const nombre = basename(archivo, ".svg");
    return !nombresConMmd.has(nombre);
  });

  if (svgsSueltos.length === 0) return;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const archivo of svgsSueltos) {
      const nombre = basename(archivo, ".svg");
      const rutaSvg = join(OUT_DIR, archivo);
      const rutaPdf = join(OUT_DIR, `${nombre}.pdf`);

      const svgOriginal = readFileSync(rutaSvg, "utf-8");
      const match = svgOriginal.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/);
      const ancho = match ? Math.ceil(parseFloat(match[1])) : 800;
      const alto = match ? Math.ceil(parseFloat(match[2])) : 600;

      console.log(`Convirtiendo ${archivo} a PDF (${ancho}x${alto})...`);

      const page = await browser.newPage();
      await page.setViewport({ width: ancho + 2, height: alto + 2 });
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}svg{display:block;}</style></head><body>${svgOriginal}</body></html>`;
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.pdf({
        path: rutaPdf,
        width: `${ancho}px`,
        height: `${alto}px`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`Listo. ${svgsSueltos.length} SVG(s) suelto(s) convertido(s) a PDF en ${OUT_DIR}/`);
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
  } else {
    for (const archivo of archivosMermaid) {
      const nombre = basename(archivo, ".mmd");
      const entrada = join(SRC_DIR, archivo);
      const salidaSvg = join(OUT_DIR, `${nombre}.svg`);
      const salidaPdf = join(OUT_DIR, `${nombre}.pdf`);

      console.log(`Renderizando ${nombre}...`);

      for (const salida of [salidaSvg, salidaPdf]) {
        const esPdf = salida.endsWith(".pdf");
        const codigoSalida = await ejecutar([
          "bunx",
          "mmdc",
          "-i",
          entrada,
          "-o",
          salida,
          "--puppeteerConfigFile",
          PUPPETEER_CONFIG_PATH,
          ...(esPdf ? ["-f"] : []),
        ]);

        if (codigoSalida !== 0) {
          console.error(`Fallo al renderizar ${nombre} (${salida}) (codigo ${codigoSalida})`);
          process.exit(codigoSalida);
        }
      }
    }

    console.log(`Listo. Diagramas .mmd generados en ${OUT_DIR}/`);
  }

  await convertirSvgsSueltos(executablePath);

  console.log(`Listo. Diagramas generados en ${OUT_DIR}/`);
}

main();
