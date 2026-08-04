import { existsSync, readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "js-yaml";

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

function esWindows() {
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

// latexmk usa el jobname como nombre de archivo directamente, asi que
// caracteres invalidos en filesystems (# / \ : * ? " < > |) y espacios
// se sanean a guiones para evitar problemas entre distintos sistemas.
// El nombre "bonito" en config.yml (ej. "Investigacion #1") queda intacto,
// solo se sanea la version usada como nombre de archivo.
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

function resolverLatexmk(): string {
  const binDirLocal = resolverBinDirLocal();
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

async function main() {
  const config = leerConfig();
  const jobname = sanearNombreArchivo(config.informe.nombre);

  console.log(`Compilando informe/main.tex como '${jobname}.pdf'...`);

  const latexmk = resolverLatexmk();
  const binDirLocal = resolverBinDirLocal();

  const env = binDirLocal
    ? {
        ...process.env,
        PATH: `${binDirLocal}${esWindows() ? ";" : ":"}${process.env.PATH ?? ""}`,
      }
    : process.env;

  // Si un build previo fallo a mitad de camino, latexmk puede quedar
  // convencido de que el PDF ya esta al dia (revisa el .fdb_latexmk, no si
  // el PDF realmente compilo bien) y no vuelve a correr pdflatex, aunque el
  // error de fondo siga sin resolverse. Se limpia el estado de latexmk
  // antes de cada build para forzar una recompilacion completa.
  const limpieza = Bun.spawnSync([latexmk, "-C", `-jobname=${jobname}`, "main.tex"], {
    cwd: INFORME_DIR,
    stdout: "ignore",
    stderr: "ignore",
    env,
  });
  if (!limpieza.success) {
    console.warn("Aviso: no se pudo limpiar el estado previo de latexmk, se continua igual.");
  }

  let proceso;
  try {
    proceso = Bun.spawn([latexmk, "-pdf", `-jobname=${jobname}`, "main.tex"], {
      cwd: INFORME_DIR,
      stdout: "inherit",
      stderr: "inherit",
      env,
    });
  } catch (error) {
    console.error("No se encontro latexmk (ni local ni en el PATH del sistema).");
    console.error("");
    console.error("Opcion recomendada: instalar LaTeX local al repo:");
    console.error("  bun run install:latex");
    console.error("");
    console.error("Ver CONTRIBUTING.md para el detalle completo.");
    process.exit(1);
  }

  const codigoSalida = await proceso.exited;

  if (codigoSalida !== 0) {
    console.error(`latexmk termino con codigo ${codigoSalida}`);
    process.exit(codigoSalida);
  }

  // Copiar el PDF resultante al outputDir configurado (por defecto la raiz
  // del repo). El PDF real de trabajo queda en informe/ igual, esto es
  // ademas una copia "de entrega" facil de encontrar.
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

main();
