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
  "oberdiek",
  "trimspaces",
  "listings",
  "xcolor",
  "booktabs",
  "hyperref",
  "threeparttable",
  "caption",
  "collcell",
  "seqsplit",
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

  // TINYTEX_DIR es la carpeta PADRE donde el instalador crea su propia subcarpeta .TinyTeX/
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

// Actualiza latex-workshop.latex.path en .vscode/settings.json con la carpeta de arquitectura real detectada tras instalar TinyTeX
function actualizarRutaVSCode() {
  const binDir = resolverBinDirLocal();
  if (!binDir) return;

  // Ruta relativa al workspace, con el mismo prefijo %WORKSPACE_FOLDER%  que ya usa latex-workshop.latex.rootFile.path en este repo.
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
