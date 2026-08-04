import { existsSync, readdirSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";

const REPO_ROOT = `${import.meta.dir}/..`;
const INFORME_DIR = `${REPO_ROOT}/informe`;
const TEXLIVE_DIR = `${REPO_ROOT}/.texlive/.TinyTeX/bin`;
const CONFIG_PATH = `${REPO_ROOT}/config.yml`;

interface Config {
  informe: {
    nombre: string;
    outputDir: string;
  };
}

interface EntornoCompilacion {
  env: NodeJS.ProcessEnv;
  latex: string;
  binDir: string | null;
  jobname: string;
}

function esWindows(): boolean {
  return process.platform === "win32";
}

function leerConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`No se encontro config.yml en ${CONFIG_PATH}`);
  }
  const contenido = readFileSync(CONFIG_PATH, "utf-8");
  const config = parseYaml(contenido) as Config;

  if (!config?.informe?.nombre) {
    throw new Error("config.yml debe definir informe.nombre");
  }
  if (!config?.informe?.outputDir) {
    throw new Error("config.yml debe definir informe.outputDir");
  }

  return config;
}

// Se deben quitar caracteres invalidos para evitar que latexmk falle por usar el jobname directo
function sanearNombreArchivo(nombre: string): string {
  return nombre
    .trim()
    .replace(/[#/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/* TinyTeX instala los binarios dentro de .texlive/.TinyTeX/bin/<arch>/,
 * donde <arch> varia segun el sistema (windows, x86_64-linux, universal-darwin).
 * Buscamos la primera carpeta que exista ahi adentro.
 */
function resolverBinDirLocal(): string | null {
  if (!existsSync(TEXLIVE_DIR)) return null;
  const carpetas = readdirSync(TEXLIVE_DIR);
  if (carpetas.length === 0) return null;
  return `${TEXLIVE_DIR}/${carpetas[0]}`;
}

function resolverLatexmk(binDirLocal: string | null): string {
  if (binDirLocal) {
    const ejecutable = esWindows() ? "latexmk.exe" : "latexmk";
    const rutaCompleta = `${binDirLocal}/${ejecutable}`;
    if (existsSync(rutaCompleta)) {
      console.log(`Usando LaTeX local: ${binDirLocal}`);
      return rutaCompleta;
    }
  }
  console.log("No se encontro LaTeX local en .texlive/, usando latexmk del PATH del sistema.");
  return "latexmk";
}

function construirEnv(binDir: string | null): NodeJS.ProcessEnv {
  if (!binDir) return process.env;
  const separador = esWindows() ? ";" : ":";
  return { ...process.env, PATH: `${binDir}${separador}${process.env.PATH ?? ""}` };
}

function armarEntorno(config: Config): EntornoCompilacion {
  const binDir = resolverBinDirLocal();
  return {
    binDir,
    latex: resolverLatexmk(binDir),
    env: construirEnv(binDir),
    jobname: sanearNombreArchivo(config.informe.nombre),
  };
}

async function limpiarBuild(entorno: EntornoCompilacion) {
  const limpieza = Bun.spawnSync([entorno.latex, "-C", `-jobname=${entorno.jobname}`, "main.tex"], {
    cwd: INFORME_DIR,
    stdout: "ignore",
    stderr: "ignore",
    env: entorno.env,
  });
  if (!limpieza.success) {
    console.warn("Aviso: no se pudo limpiar el estado previo de latexmk, se continua igual.");
  }
}

function lanzarLatexmk(entorno: EntornoCompilacion) {
  try {
    return Bun.spawn([entorno.latex, "-pdf", `-jobname=${entorno.jobname}`, "main.tex"], {
      cwd: INFORME_DIR,
      stdout: "inherit",
      stderr: "inherit",
      env: entorno.env,
    });
  } catch {
    console.error("No se encontro latexmk (ni local ni en el PATH del sistema).");
    console.error("");
    console.error("Opcion recomendada: instalar LaTeX local al repo:");
    console.error("  bun run install:latex");
    console.error("");
    console.error("Ver CONTRIBUTING.md para el detalle completo.");
    process.exit(1);
  }
}

function copiarPdfAOutput(config: Config, jobname: string) {
  const pdfGenerado = `${INFORME_DIR}/${jobname}.pdf`;
  const outputDir = `${REPO_ROOT}/${config.informe.outputDir}`;
  const pdfDestino = `${outputDir}/${jobname}.pdf`;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  copyFileSync(pdfGenerado, pdfDestino);

  console.log("");
  console.log(`Listo. PDF generado en informe/${jobname}.pdf`);
  console.log(`Copia de entrega en ${config.informe.outputDir}/${jobname}.pdf`);
}

async function main() {
  const config = leerConfig();
  const entorno = armarEntorno(config);

  console.log(`Compilando informe/main.tex como '${entorno.jobname}.pdf'...`);

  // Si un build previo fallo a mitad de camino, latexmk puede quedar convencido de que el PDF ya esta al dia
  await limpiarBuild(entorno);

  const proceso = lanzarLatexmk(entorno);
  const codigoSalida = await proceso.exited;

  if (codigoSalida !== 0) {
    console.error(`latexmk termino con codigo ${codigoSalida}`);
    process.exit(codigoSalida);
  }

  copiarPdfAOutput(config, entorno.jobname);
}

main();