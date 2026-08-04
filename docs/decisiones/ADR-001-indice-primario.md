# ADR 001: Mapa de posiciones por carne mediante arreglo ordenado con lista de recien ingresados

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
Se divide el mapa de posiciones por carne en dos partes:

Zona ordenada: arreglo ordenado por carne. Aqui se busca con busqueda
binaria, en O(log n).

Lista de recien ingresados: arreglo sin ordenar, mas pequeno, donde se
agregan los carnes de los estudiantes recien registrados. Agregar un
elemento al final de este arreglo cuesta O(1), porque no hay que mover
nada mas.

Cuando se busca un carne, primero se revisa la zona ordenada con busqueda
binaria. Si no aparece ahi, se revisa la lista de recien ingresados de
principio a fin, comparando carne por carne, hasta encontrarlo o terminar
el arreglo. Como esa lista se mantiene pequena (ver siguiente parrafo),
ese recorrido cuesta poco en la practica aunque sea lineal.

Cuando la lista de recien ingresados llega al 10% del tamano de la zona
ordenada, se juntan ambas partes en una sola, ya ordenada, y la lista
queda vacia otra vez. Este proceso de juntar y ordenar cuesta O(n log n),
y se explica con mas detalle en el ADR 004 junto con lo que pasa al
apagar el sistema, que es un momento distinto y no dispara este mismo
proceso.

Este patron replica como funcionaban los archivos ISAM (Indexed
Sequential Access Method, IBM) antes de que los arboles B/B+ se volvieran
el estandar en los motores de bases de datos. La seccion de arquitectura
del informe explica con mas detalle en que consiste ISAM y por que se
eligio ese patron en lugar de un arbol. (TODO: agregar cita
bibliografica formal sobre ISAM tanto ahi como en referencias.bib.)

## Consequences
Registrar un estudiante nuevo cuesta O(1) la mayoria de las veces, en vez
de O(n) cada vez.

Juntar las dos partes ocurre pocas veces (solo cuando la lista de recien
ingresados llega al 10%), asi que aunque cada vez que ocurre cuesta
O(n log n), en promedio no sale caro porque no pasa en cada registro
nuevo.

El mapa completo, con sus dos partes, se guarda en el archivo
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
