import { readdir, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";

const SRC_DIR = "diagramas/src";
const OUT_DIR = "diagramas/output";

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const entradas = await readdir(SRC_DIR);
  const archivosMermaid = entradas.filter((archivo) => archivo.endsWith(".mmd"));

  if (archivosMermaid.length === 0) {
    console.log(`No hay archivos .mmd en ${SRC_DIR}`);
    return;
  }

  for (const archivo of archivosMermaid) {
    const nombre = basename(archivo, ".mmd");
    const entrada = join(SRC_DIR, archivo);
    const salida = join(OUT_DIR, `${nombre}.svg`);

    console.log(`Renderizando ${nombre}...`);

    const proceso = Bun.spawn(["bunx", "mmdc", "-i", entrada, "-o", salida], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const codigoSalida = await proceso.exited;
    if (codigoSalida !== 0) {
      console.error(`Fallo al renderizar ${nombre} (codigo ${codigoSalida})`);
      process.exit(codigoSalida);
    }
  }

  console.log(`Listo. Diagramas generados en ${OUT_DIR}/`);
}

main();
