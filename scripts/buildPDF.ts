import { existsSync, readdirSync } from "node:fs";

const REPO_ROOT = `${import.meta.dir}/..`;
const INFORME_DIR = `${REPO_ROOT}/informe`;
const TEXLIVE_DIR = `${REPO_ROOT}/.texlive/.TinyTeX/bin`;

function esWindows() {
  return process.platform === "win32";
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
  console.log("Compilando informe/main.tex...");

  const latexmk = resolverLatexmk();
  const binDirLocal = resolverBinDirLocal();

  const env = binDirLocal
    ? {
        ...process.env,
        PATH: `${binDirLocal}${esWindows() ? ";" : ":"}${process.env.PATH ?? ""}`,
      }
    : process.env;

  // Si un build previo fallo a mitad de camino, latexmk puede quedar
  // convencido de que 'main.pdf' ya esta al dia (revisa el .fdb_latexmk,
  // no si el PDF realmente compilo bien) y no vuelve a correr pdflatex,
  // aunque el error de fondo siga sin resolverse. Se limpia el estado de
  // latexmk antes de cada build para forzar una recompilacion completa.
  const limpieza = Bun.spawnSync([latexmk, "-C", "main.tex"], {
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
    proceso = Bun.spawn([latexmk, "-pdf", "main.tex"], {
      cwd: INFORME_DIR,
      stdout: "inherit",
      stderr: "inherit",
      env,
    });
  } catch (error) {
    console.error("No se encontro latexmk (ni local ni en el PATH del sistema).");
    console.error("");
    console.error("Opcion recomendada: instalar LaTeX local al repo:");
    console.error("  bun run latex:install");
    console.error("");
    console.error("Ver CONTRIBUTING.md para el detalle completo.");
    process.exit(1);
  }

  const codigoSalida = await proceso.exited;

  if (codigoSalida !== 0) {
    console.error(`latexmk termino con codigo ${codigoSalida}`);
    process.exit(codigoSalida);
  }

  console.log("Listo. PDF generado en informe/main.pdf");
}

main();
