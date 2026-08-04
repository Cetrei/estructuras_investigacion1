# ADR 004: Purga y reconstruccion completa de los mapas al apagar el sistema

## Status
Accepted

## Context
El ADR 001 menciona que las dos partes del mapa se juntan "cuando la
lista de recien ingresados llega al 10% o al apagar el sistema", como si
fuera el mismo proceso disparado en dos momentos distintos. Al pensarlo
con mas cuidado, no son el mismo proceso.

Hay dos problemas separados conviviendo en el sistema:

El mapa, que vive en RAM, acumula estudiantes nuevos en su lista de
recien ingresados, y necesita reorganizarse cada cierto tiempo para que
revisar esa lista siga siendo rapido.

Los archivos de datos en disco (identidad.dat, academico.dat,
contacto.dat) acumulan registros marcados con estado en cero (borrado
logico) que siguen ocupando espacio hasta que algo los elimine de verdad,
que es lo que hace purgarInactivos().

La pregunta es: al apagar el sistema, se purga primero y despues se
reorganiza el mapa, o al reves? El orden importa porque los dos procesos
tocan la misma informacion (en que posicion fisica esta cada registro) y
uno rompe al otro sin importar cual se haga primero.

## Decision
Si primero se purga, compactar los tres archivos (borrar de verdad los
registros con estado en cero) hace que todos los registros que estaban
despues de uno eliminado se corran de posicion. Cualquier mapa que ya
existia antes de purgar, sin importar si estaba reorganizado o no, queda
apuntando a posiciones que ya no le pertenecen a esos estudiantes.

Si primero se reorganiza el mapa y despues se purga, pasa exactamente lo
mismo pero al reves: la purga que viene despues vuelve a mover las
posiciones que el mapa recien reorganizado acababa de calcular.

En cualquiera de los dos ordenes, un proceso deja invalido el trabajo del
otro. Por eso se define un solo evento al apagar el sistema, no dos pasos
seguidos:

Primero, purgarInactivos() compacta los tres archivos de datos,
eliminando de verdad los registros marcados con estado en cero (los tres
archivos se purgan juntos porque comparten la misma posicion por
estudiante, segun el ADR 002).

Despues, los tres mapas (carne, identificacion y apellido) se arman de
nuevo desde cero, leyendo el archivo ya compactado de principio a fin. No
se reaprovecha la lista de recien ingresados que existia antes de purgar,
porque las posiciones que guardaba ya no significan nada despues de
compactar.

Esto es distinto de la reorganizacion que ocurre cuando la lista de
recien ingresados llega al 10% (ADR 001): esa pasa con el sistema
encendido, no toca el disco, y solo reordena la informacion que ya tiene
el mapa. La reorganizacion al apagar si toca el disco y arma el mapa
completo de nuevo a partir de lo que quedo despues de purgar.

## Consequences
Apagar el sistema cuesta mas que una reorganizacion normal: recorrer todo
el archivo para purgar, mas armar de nuevo los tres mapas leyendo el
archivo completo. Pero esto pasa una sola vez por sesion, no cada vez que
se hace una operacion.

Se evita el caso de juntar una lista de recien ingresados cuyas
posiciones estan a punto de cambiar de todas formas, que seria trabajo
hecho para nada.

El mapa que queda despues de este proceso no tiene lista de recien
ingresados pendiente (se armo recien), y se guarda completo en
estudiantes.idx, para que la proxima vez que se encienda el sistema no
haga falta repetir todo este proceso: alcanza con cargar el archivo de
mapa ya armado.

Si el sistema se apaga de golpe (corte de luz, falla) sin pasar por este
proceso, la siguiente vez que se encienda debe darse cuenta de que
estudiantes.idx no quedo actualizado y reconstruirlo desde los archivos de
datos en vez de confiar en un mapa que podria estar mal. Este caso queda
fuera del alcance de esta investigacion, pero se deja anotado para cuando
se implemente el sistema.

## Alternatives Considered
Purgar y reorganizar el mapa como dos pasos separados, en cualquier
orden: se descarto porque, sin importar cual se haga primero, un paso deja
invalido lo que hizo el otro, como se explica arriba.

No purgar nunca, dejar los registros marcados con estado en cero para
siempre: mantiene el mapa estable entre una sesion y otra sin necesidad
de reconstruirlo, pero va en contra de lo que pide purgarInactivos() como
mantenimiento, y deja que el archivo crezca para siempre con registros que
ya nadie usa.
