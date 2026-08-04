# ADR 002: Particionamiento vertical del registro Estudiante

## Status
Accepted

## Context
El enunciado de la investigacion pide administrar catorce datos por
estudiante (numero de carne, identificacion, nombre, apellidos, fecha de
nacimiento, sexo, carrera, nivel academico, correo, telefono, direccion,
creditos aprobados, promedio y estado), pero no propone ninguna forma de
organizarlos: solo los enumera como una lista de requisitos que el sistema
debe guardar.

El primer intento del equipo fue juntar los catorce campos en un solo
registro. Al revisarlo aparecio un problema: esos catorce campos no cambian
con la misma frecuencia ni se usan juntos en las mismas operaciones. El
nombre y la fecha de nacimiento de un estudiante practicamente nunca
cambian una vez matriculado. El promedio y los creditos aprobados se
actualizan en cada periodo lectivo, es decir, varias veces por estudiante
durante su carrera. El correo, el telefono y la direccion se usan juntos
normalmente solo cuando se necesita contactar al estudiante, y casi nunca
al mismo tiempo que se actualiza el promedio.

Juntar estos tres grupos en un solo registro significa que actualizar el
promedio de un estudiante (algo que pasa constantemente) obliga a leer y
reescribir tambien su nombre, su fecha de nacimiento, su correo y su
direccion, aunque ninguno de esos datos cambio.

## Decision
Se separan los trece campos en tres grupos, cada uno guardado en su propio
archivo binario:

IdentidadEstudiante (identidad.dat): carne, identificacion, nombre,
apellidos, fecha de nacimiento y sexo. Son los datos que casi no cambian
una vez matriculado el estudiante.

AcademicoEstudiante (academico.dat): carrera, nivel academico, creditos
aprobados, promedio y estado. Son los datos que se actualizan en cada
periodo lectivo.

ContactoEstudiante (contacto.dat): correo, telefono y direccion. Son los
datos que se consultan juntos cuando hace falta comunicarse con el
estudiante.

Los tres archivos se mantienen alineados por posicion: el registro que
esta en la posicion numero cinco de identidad.dat pertenece al mismo
estudiante que el registro en la posicion numero cinco de academico.dat y
de contacto.dat. Gracias a esto, un solo indice (que guarda carne y
posicion) alcanza para encontrar al estudiante en cualquiera de los tres
archivos: no hace falta un indice por archivo.

## Consequences
Consultar el expediente completo de un estudiante pasa de una lectura a
tres lecturas (una por archivo), pero sigue siendo O(1) en cada una,
porque las tres se hacen con acceso directo, no recorriendo el archivo.

Las operaciones que solo tocan un grupo de datos, como actualizar el
promedio, leen y escriben unicamente academico.dat, sin tocar identidad ni
contacto.

Un solo indice alcanza para las tres particiones, asi que no se triplica
el uso de memoria RAM por tener tres archivos en vez de uno.

## Alternatives Considered
Un solo struct con los trece campos juntos: es lo primero que el equipo
probo. Es mas simple de escribir al principio, pero mezcla datos que casi
nunca cambian con datos que cambian todo el tiempo dentro del mismo
registro fisico, obligando a reescribir todo el registro cada vez que se
actualiza un solo campo academico.
