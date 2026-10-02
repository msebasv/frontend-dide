# Plan de pruebas del frontend — AcademicPlus

**Proyecto:** AcademicPlus — Universidad El Bosque, División de Innovación Digital en Educación (DiDE)  
**Tipo de documento:** Plan de pruebas funcionales del frontend  
**Versión:** 1.0  
**Fecha:** 29 de septiembre de 2026  
**Estado:** Borrador para revisión del equipo  

Este documento describe cómo probar las pantallas de AcademicPlus. Está pensado para que el equipo lo revise, lo ejecute y deje evidencia para el proyecto de grado.

---

## 1. Objetivo

Comprobar que cada rol ve solo sus pantallas, que los formularios rechazan datos inválidos y que un proceso puede recorrerse en la interfaz desde su creación hasta el cierre, con los archivos y el estado visibles en cada paso.

## 2. Alcance

| Incluido | Fuera de este plan |
|---|---|
| Menú, dashboards y cambio de rol | Lógica interna de los flujos de Power Automate |
| Crear, editar y consultar procesos | Roles de seguridad de Dataverse |
| Cargue, aprobación, devolución y cierre | Permisos de SharePoint del sitio |
| Archivos del entregable, Formatos y Videotutoriales | Que el correo exista en el directorio del tenant |
| Seguimiento, estadísticas y administración | Pruebas de carga o de seguridad ofensiva |

El correo se valida por formato: debe ser `@unbosque.edu.co`. El autocompletado sugiere usuarios del directorio, pero una dirección bien escrita se puede guardar aunque esa cuenta no exista.

## 3. Ambiente y datos

Usar un ambiente de prueba (Pre o development-dide), con la sesión del rol que se va a probar. En cada evidencia anotar ambiente, fecha, cuenta y versión publicada.

Preparar antes de ejecutar:

- Al menos una facultad, un programa y un curso.
- Plantillas de entregable, una de ellas con la palabra “syllabus” en el nombre.
- Una cuenta por rol: autor, líder de virtualización, validador disciplinar, asesor pedagógico, coordinador DIDE, coordinador diseñador, diseñador DIDE y administrador.
- Un proceso ya creado en “Cargue Syllabus”, y otro más avanzado si se quieren probar seguimiento y estadísticas sin recorrer todo el flujo en la misma sesión.
- Archivos de prueba: un PDF válido (menor de 25 MB) y uno rechazable (por ejemplo `.exe` o un archivo de más de 25 MB).

Tipos aceptados en cargue general: pdf, doc, docx, ppt, pptx, xls, xlsx, png, jpg, jpeg, gif, webp, txt. El guión instruccional acepta Word o PDF. Máximo 10 archivos por cargue y 25 MB por archivo.

## 4. Cómo registrar cada caso

Para la ejecución y para el anexo del proyecto de grado, llenar una tabla con estas columnas:

| Columna | Qué anotar |
|---|---|
| ID | Identificador del caso (por ejemplo NAV-01) |
| Prioridad | Alta, media o baja |
| Precondición | Rol, ambiente y datos necesarios |
| Pasos | Acciones concretas en la pantalla |
| Resultado esperado | Lo que debe ocurrir |
| Resultado obtenido | Lo que ocurrió |
| Evidencia | Captura, cuenta, fecha y ambiente |
| Estado | Aprobado, Fallido o Bloqueado |

**Prioridad alta:** el usuario no puede completar su trabajo o ve datos de otro rol.  
**Prioridad media:** validaciones, estados vacíos y navegación.  
**Prioridad baja:** textos, botones de ayuda y detalle visual.

**Aprobado:** el resultado coincide con lo esperado.  
**Fallido:** la pantalla se comporta distinto; adjuntar captura y pasos para reproducirlo.  
**Bloqueado:** no se pudo ejecutar porque faltó un dato, una cuenta o un permiso del ambiente.

## 5. Acceso y navegación

| ID | Prioridad | Qué probar | Resultado esperado |
|---|---|---|---|
| NAV-01 | Alta | Ingresar con una cuenta que tiene un solo rol | Abre el inicio de ese rol, con su título de panel |
| NAV-02 | Alta | Ingresar con una cuenta que tiene varios roles | Aparece el selector de rol; al cambiar, el menú y el panel cambian |
| NAV-03 | Alta | Recorrer el menú de cada rol (tabla de abajo) | Solo aparecen las opciones de ese rol, con el texto que le corresponde |
| NAV-04 | Media | Abrir una ruta que no existe, por ejemplo `/no-existe` | Vuelve a Inicio |
| NAV-05 | Alta | Con rol autor, abrir a mano `/virtualization-processes/create` | No deja crear; regresa o no muestra el formulario de gestión |
| NAV-06 | Baja | En móvil, abrir y cerrar el menú; en escritorio, colapsarlo | El menú se abre, se cierra y los logos se ajustan sin tapar el contenido |
| NAV-07 | Media | En autor, líder y validador, pulsar Ver formatos y Videotutoriales | Cada botón abre su carpeta de SharePoint en una pestaña nueva |

### Menú esperado por rol

| Rol | Opciones del menú |
|---|---|
| Autor de asignatura | Inicio, Mis Cursos |
| Validador disciplinar | Inicio, Cursos por validar |
| Asesor pedagógico | Inicio, Cursos pendientes, Seguimiento de mis procesos, Estadísticas de mis procesos |
| Diseñador DIDE | Inicio, Cursos por cargar |
| Líder de virtualización | Inicio, Procesos de Virtualización, Seguimiento, Estadísticas |
| Coordinador DIDE | Inicio, Seguimiento, Entregables, Estadísticas |
| Coordinador Diseñador | Inicio, Seguimiento, Estadísticas |
| Administrador | Inicio, Procesos, Seguimiento, Programas y facultades, Personas, Entregables, Usuarios líderes, Estadísticas |

El líder ve el listado de procesos. Crear proceso y crear curso corresponden al coordinador DIDE y al administrador.

### Títulos de inicio

| Rol | Título del panel |
|---|---|
| Autor de asignatura | Dashboard de cursos |
| Líder de virtualización | Panel de procesos |
| Coordinador DIDE | Panel de procesos |
| Coordinador Diseñador | Panel de diseño |
| Administrador | Panel de administración |
| Validador disciplinar | Panel de validación |
| Asesor pedagógico | Panel de asesoría |
| Diseñador DIDE | Panel de diseño DIDE |

## 6. Formularios de proceso

| ID | Prioridad | Qué probar | Resultado esperado |
|---|---|---|---|
| FRM-01 | Alta | Crear proceso con curso, créditos, líder, autor y asesor válidos | Mensaje de éxito. El proceso queda en Cargue Syllabus. El nombre visible incluye semestre y código |
| FRM-02 | Alta | Dejar un correo vacío | No envía. Indica que el correo es obligatorio |
| FRM-03 | Alta | Correo de otro dominio, por ejemplo `@gmail.com` | No envía. Pide un correo `@unbosque.edu.co` |
| FRM-04 | Media | Escribir dos letras de un nombre institucional | Aparecen sugerencias de usuarios `@unbosque.edu.co`. Al elegir una, el campo se llena |
| FRM-05 | Alta | Nombre con símbolos, guiones o barras | No envía. Solo letras, números y espacios |
| FRM-06 | Media | Nombre de más de 200 caracteres, contando el nombre oficial con semestre y código | No envía por longitud |
| FRM-07 | Alta | Créditos 0, 21, decimal o texto | No envía. Solo enteros del 1 al 20 |
| FRM-08 | Alta | Editar un proceso ya creado: cambiar correos de líder, autor y asesor | Guarda y, al volver a abrir, muestra los correos nuevos |
| FRM-09 | Alta | Como líder, intentar crear un proceso | No tiene la acción de alta |
| FRM-10 | Alta | Como coordinador DIDE o administrador, crear curso y luego proceso sobre ese curso | El curso queda disponible en el selector del proceso |

Repetir la idea de FRM-02 a FRM-04 en asignar validador y asignar diseñador DIDE: esos campos usan el mismo autocompletado de correo institucional.

## 7. Recorrido principal

Ejecutarlo con un proceso nuevo, un entregable de syllabus y al menos un entregable de crédito. Una persona opera y otra cambia de cuenta, o la misma persona cierra sesión entre roles.

| ID | Prioridad | Rol y momento | Acción | Resultado esperado |
|---|---|---|---|---|
| E2E-01 | Alta | Coordinador DIDE o administrador | Crear el proceso | Estado Cargue Syllabus. Autor, líder y asesor asignados |
| E2E-02 | Alta | Líder, sin validador | Intentar cargar el syllabus | El cargue no está disponible. La interfaz pide asignar validador |
| E2E-03 | Alta | Líder | Asignar validador disciplinar con correo `@unbosque.edu.co` | El validador queda asociado al proceso |
| E2E-04 | Alta | Líder | Cargar el PDF del syllabus en el entregable cuyo nombre contiene “syllabus” | El archivo queda en Archivos del entregable y la fase avanza a cargue del autor |
| E2E-05 | Alta | Autor | Abrir el mismo proceso | Ve el proceso en Mis Cursos. No puede cargar el syllabus |
| E2E-06 | Alta | Autor | Cargar el material del entregable que le corresponde | El archivo aparece y la actividad queda Por aprobar |
| E2E-07 | Alta | Validador | Aprobar ese material | La actividad pasa a revisión del asesor pedagógico |
| E2E-08 | Alta | Validador, en una copia o tras una devolución previa | Devolver con comentario | El autor vuelve a ver el entregable para corregir. El comentario queda visible |
| E2E-09 | Alta | Asesor | Aprobar la revisión pedagógica | Se habilita la carga del guión instruccional |
| E2E-10 | Alta | Asesor | Cargar el guión en Word o PDF | El archivo queda registrado y la fase pasa a enlaces audiovisuales |
| E2E-11 | Alta | Coordinador diseñador, coordinador DIDE o administrador | Asignar diseñador DIDE | El diseñador ve el proceso en Cursos por cargar |
| E2E-12 | Alta | Diseñador DIDE | Registrar los enlaces audiovisuales | La fase pasa a aprobación del material audiovisual |
| E2E-13 | Alta | Asesor | Aprobar el material audiovisual | Cuando los entregables obligatorios están listos, el líder puede confirmar el aula |
| E2E-14 | Alta | Líder | Confirmar el cargue en el aula | El proceso queda finalizado |
| E2E-15 | Alta | Cualquier rol asignado | Abrir el proceso cerrado | Se consulta el historial y los archivos. Ya no hay acciones de la fase activa |

En E2E-07, E2E-09, E2E-13 y E2E-14 esperar el mensaje de éxito y comprobar que la vista muestra el estado nuevo. Si la operación tarda, la aplicación puede avisar que sigue en curso. Al recargar dentro de unas dos horas debe retomar ese pendiente en lugar de duplicar la acción.

### Orden de fases que debe verse en pantalla

1. Cargue Syllabus
2. Cargue de documentos por el autor
3. Revisión y aprobación validador disciplinar
4. Revisión y aprobación asesor pedagógico
5. Cargar Guión instruccional
6. Registrar Enlaces Audiovisuales
7. Aprobar material audiovisual DIDE
8. Validación Cargue en el Aula
9. Proceso finalizado

## 8. Restricciones de cargue

| ID | Prioridad | Situación | Resultado esperado |
|---|---|---|---|
| UPL-01 | Alta | Autor en fase de syllabus | No carga syllabus |
| UPL-02 | Alta | Líder carga un entregable que no es syllabus | No se ofrece ese cargue al líder |
| UPL-03 | Alta | Asesor intenta cargar el material del autor | Solo carga el guión instruccional en su fase |
| UPL-04 | Alta | Guión en PDF o DOCX | Se acepta |
| UPL-05 | Media | Guión en PPT o imagen | Se rechaza |
| UPL-06 | Alta | Archivo de más de 25 MB, más de 10 archivos, o extensión no permitida | El formulario lo indica y no envía |
| UPL-07 | Alta | Proceso ya finalizado | Ningún rol muestra botón de cargue o de aprobación |

## 9. Archivos, seguimiento y estadísticas

| ID | Prioridad | Qué probar | Resultado esperado |
|---|---|---|---|
| ARC-01 | Alta | Tras un cargue, abrir Archivos del entregable y filtrar por actividad | Se ve el archivo de esa actividad. Si el filtro de actividad no acota, se ven los archivos de ese entregable |
| ARC-02 | Media | Proceso sin archivos en ese entregable | El panel muestra vacío, sin error de carga |
| ARC-03 | Baja | Exportar el historial del entregable, si el botón está visible | Descarga un PDF con el nombre del proceso y las actividades |
| SEG-01 | Alta | Asesor en Seguimiento | Solo procesos en los que está asignado |
| SEG-02 | Alta | Coordinador DIDE, coordinador diseñador o administrador en Seguimiento | Ven el conjunto de procesos de su alcance, con la fase actual |
| EST-01 | Alta | Líder o asesor en Estadísticas | Métricas de sus procesos: totales, por aprobar y distribución por fase |
| EST-02 | Media | Administrador o coordinador en Estadísticas | Puede filtrar por facultad o programa y abrir el detalle de procesos |
| EST-03 | Baja | Exportar estadísticas | El PDF refleja los números que se ven en pantalla |
| NOT-01 | Media | Con una actividad Por aprobar del rol activo | La campana muestra el aviso y al abrirlo lleva al proceso |

## 10. Administración

Ejecutar esta sección con administrador. La pantalla de Entregables también la puede abrir el coordinador DIDE.

| ID | Prioridad | Pantalla | Qué comprobar |
|---|---|---|---|
| ADM-01 | Alta | Programas y facultades | Crear y editar una facultad y un programa. El programa queda ligado a su facultad y luego aparece al crear un curso |
| ADM-02 | Media | Personas y roles | Consultar personas y la asignación de rol que usa la aplicación |
| ADM-03 | Alta | Usuarios líderes | Registrar un líder. Ese correo puede usarse al crear un proceso |
| ADM-04 | Media | Entregables | Ver la plantilla, su nombre y si aplica por crédito o general |
| ADM-05 | Alta | Entregables, con un proceso ya creado | Cambiar el nombre visible de una plantilla. El proceso viejo sigue mostrando el nombre y la carpeta que tenía al crearse. El syllabus sigue permitiendo cargue mientras ese nombre guardado contenga “syllabus” |
| ADM-06 | Alta | Otro rol, por ejemplo autor | Esas rutas de administración no aparecen en el menú |

## 11. Casos de borde

| ID | Prioridad | Caso | Resultado esperado |
|---|---|---|---|
| BOR-01 | Alta | Crear el proceso y recargar mientras dice que está creando | Al volver, no queda un segundo proceso duplicado por ese reintento; se informa el pendiente o el resultado |
| BOR-02 | Alta | Aprobar y recargar antes de que cierre el mensaje | La actividad no se aprueba dos veces |
| BOR-03 | Media | Usuario asignado como autor y como líder | Al cambiar de rol, Inicio y el menú corresponden al rol activo |
| BOR-04 | Media | Lista de procesos o de cursos sin registros para ese usuario | Estado vacío legible, sin tabla rota |
| BOR-05 | Media | Créditos en el límite: 1 y 20 | Ambos se aceptan. Con varios créditos, cada entregable por crédito se distingue (crédito 1, crédito 2) |

## 12. Criterio para cerrar las pruebas

El plan se considera ejecutado cuando:

- Los ocho roles tienen su menú verificado.
- El recorrido E2E-01 a E2E-15 queda aprobado en un mismo proceso, o documentado como bloqueado con la causa.
- Los casos de formulario FRM-01 a FRM-08 y los de archivo UPL-04 a UPL-06 están ejecutados.
- Cada fallo tiene captura, cuenta, ambiente y pasos para reproducirlo.

Para el documento de grado, un anexo con la tabla llena y de 8 a 12 capturas del recorrido principal suele ser suficiente: inicio de cada rol, validación de formulario, syllabus cargado, archivo en el entregable, aprobación y proceso finalizado.

## 13. Comentarios del equipo

Usar esta sección al revisar el plan, antes de ejecutarlo.

| Revisor | Fecha | Comentario | ¿Se incorpora? |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
