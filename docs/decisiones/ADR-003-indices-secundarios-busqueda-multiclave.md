# ADR 003: Indices secundarios para busqueda por identificacion y apellido

## Status
Accepted

## Context
El enunciado pide que se pueda buscar un estudiante por numero de carne,
por numero de identificacion y por apellido. El indice primario (ADR 001)
solo resuelve la busqueda por carne. Buscar por identificacion o por
apellido recorriendo todo el archivo desde el principio hasta encontrar
coincidencias seria O(n), lo cual contradice el requisito del curso de que
las funciones sean O(n) o mejores cuando sea posible, y ademas se vuelve
lento a medida que crece la cantidad de estudiantes.

## Decision
Se agregan dos indices mas, cada uno con la misma forma liviana que el
indice primario (guardan solo la llave de busqueda, la posicion en disco y
el estado), pero cada uno ordenado por su propia llave en vez de por
carne:

indiceIdentificacion: ordenado por numero de identificacion, con la misma
zona primaria y zona de desborde que el indice de carne (ADR 001), porque
buscar por identificacion pasa tan seguido como buscar por carne, por
ejemplo durante matricula o para verificar la identidad de un estudiante.

indiceApellido: ordenado por apellido, pero no se actualiza en cada
registro nuevo como los otros dos. En vez de eso, se reconstruye por
completo la primera vez que alguien pide una busqueda o un reporte por
apellido despues de que hubo altas, bajas o cambios desde la ultima vez
que se reconstruyo, y tambien se reconstruye durante el proceso de apagado
(ADR 004). Se hace de esta forma porque buscar por apellido es tipicamente
para generar un reporte, algo que ocurre de vez en cuando, no una
operacion que se repite constantemente como registrar o consultar un
estudiante. Reconstruir este indice en cada registro nuevo pagaria un
costo de O(n log n) cada vez por un beneficio que casi nunca se usa de
inmediato.

Los tres indices (carne, identificacion y apellido) apuntan a la misma
posicion fisica dentro de identidad.dat. Ninguno de los tres guarda una
copia de los datos del estudiante, solo la posicion donde encontrarlos.

## Consequences
Buscar por identificacion cuesta lo mismo que buscar por carne: busqueda
binaria en la zona primaria, y si no aparece ahi, un recorrido corto por
la zona de desborde.

Buscar por apellido cuesta una busqueda binaria sobre el indice ya
reconstruido, pero ese indice puede estar desactualizado entre una
reconstruccion y otra si hubo registros nuevos en el medio. Esto se
documenta como una limitacion aceptada, coherente con que esa busqueda es
para reportes y no para operaciones del dia a dia.

Tener tres indices en RAM sigue siendo mucho mas liviano que cargar los
registros completos de todos los estudiantes, porque cada entrada de cada
indice ocupa solo la llave, la posicion y el estado, no el registro
entero.

## Alternatives Considered
Un solo indice (el de carne) y recorrer todo el archivo para buscar por
identificacion o apellido: es mas simple de programar, pero va en contra
del requisito del curso de mantener las funciones en O(n) o mejor, y
desperdicia el hecho de que ya existe informacion organizada que se podria
aprovechar.
