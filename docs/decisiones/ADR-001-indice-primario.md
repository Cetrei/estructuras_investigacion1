# ADR 001: Indice primario mediante arreglo ordenado con zona de desborde

## Status
Accepted

## Context
El sistema necesita busquedas rapidas por numero de carne sobre un volumen
que puede crecer de 25 000 a cientos de miles de registros.

Un arreglo simple ordenado permite busqueda binaria en O(log n), pero
mantenerlo ordenado en cada insercion cuesta O(n) porque cada estudiante
nuevo obliga a correr de lugar a todos los que quedan despues de el en el
orden.

## Decision
Se divide el indice primario en dos partes:

Zona primaria: arreglo ordenado por carne. Aqui se busca con busqueda
binaria, en O(log n).

Zona de desborde: arreglo sin ordenar, mas pequeno, donde se agregan los
carnes de los estudiantes recien registrados. Agregar un elemento al final
de este arreglo cuesta O(1), porque no hay que mover nada mas.

Cuando se busca un carne, primero se revisa la zona primaria con busqueda
binaria. Si no aparece ahi, se revisa la zona de desborde de principio a
fin, comparando carne por carne, hasta encontrarlo o terminar el arreglo.
Como la zona de desborde se mantiene pequena (ver siguiente parrafo), ese
recorrido cuesta poco en la practica aunque sea lineal.

Cuando la zona de desborde llega al 10% del tamano de la zona primaria, se
juntan las dos zonas en una sola, ya ordenada, y la zona de desborde queda
vacia otra vez vacia. Este proceso de juntar y ordenar cuesta O(n log n), y
se explica con mas detalle en el ADR 004 junto con lo que pasa al apagar el
sistema, que es un momento distinto y no dispara este mismo proceso.

Este patron replica como funcionaban los archivos ISAM (IBM) antes de que
los arboles B/B+ se volvieran el estandar en los motores de bases de
datos. La seccion de arquitectura del informe explica con mas detalle en
que consiste ISAM y por que se eligio ese patron en lugar de un arbol.

## Consequences
Registrar un estudiante nuevo cuesta O(1) la mayoria de las veces, en vez
de O(n) cada vez.

Juntar las dos zonas ocurre pocas veces (solo cuando el desborde llega al
10%), asi que aunque cada vez que ocurre cuesta O(n log n), en promedio no
sale caro porque no pasa en cada registro nuevo.

El indice completo, con sus dos zonas, se guarda en el archivo
estudiantes.idx para no tener que reconstruirlo desde cero cada vez que se
enciende el sistema.

## Alternatives Considered
Insertar siempre manteniendo el arreglo ordenado (O(n) por insercion): se
descarto porque las busquedas ocurren muchas mas veces que los registros
nuevos de estudiantes, asi que pagar O(n) en cada registro nuevo para
ahorrar en la busqueda no compensaba.

Tabla hash hecha a mano: se descarto porque no sirve para busquedas por
rango ni para generar listados ordenados (por ejemplo, mostrar estudiantes
por apellido), y ademas resolver las colisiones sin usar librerias externas
complica el codigo sin necesidad, gastando mas memoria de la que ahorra.
