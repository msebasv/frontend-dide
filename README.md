# AcademicPlus — Frontend (Code App)

Aplicación web de virtualización de asignaturas de la **Universidad El Bosque** (DIDE).  
Es una **Power Apps Code App** construida con React, TypeScript y Vite.

Cuenta operativa de plataforma: `serviciosdide@unbosque.edu.co`.

## Ambientes

| Ambiente | Aplicación | Archivo de configuración |
| --- | --- | --- |
| **QA** | AcademicPlusQA | `power.config.json` (activo por defecto) y `power.config.qa-academicplus-dide.json` |
| **PRE** | AcademicPlusPre | `power.config.pre-academic-plus-dide.json` |

`power.config.json` es el archivo que leen Vite y la CLI al desarrollar o publicar. Los demás son respaldos para cambiar de ambiente.

## Requisitos

- Node.js LTS (recomendado 22.x)
- npm
- [Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`)
- Acceso al tenant y a los ambientes QA / PRE

## Instalación

```powershell
npm install
```

## Autenticación

Hay dos sesiones distintas:

```powershell
# Ambiente Dataverse
pac auth create
pac auth list
pac org who

# CLI de Code Apps (publicación / orígenes)
npx power-apps logout
```

Usar siempre `serviciosdide@unbosque.edu.co`.

## Cambiar de ambiente

**QA**

```powershell
Copy-Item .\power.config.qa-academicplus-dide.json .\power.config.json -Force
pac org select --environment 0c519c7e-6118-e58b-8859-5f8447eb0aec
pac org who
```

**PRE**

```powershell
Copy-Item .\power.config.pre-academic-plus-dide.json .\power.config.json -Force
pac org select --environment bdbaee81-c705-e431-9cc7-e8bd7151e7e0
pac org who
```

Antes de agregar tablas, refrescar orígenes o publicar, el `environmentId` de `pac org who` debe coincidir con el de `power.config.json`.

## Desarrollo local

```powershell
npm run dev
```

Abrir la URL **Local Play** que imprime la consola (no solo `http://localhost:5173/`), para autenticarse con Microsoft dentro del reproductor de Power Apps.

## Publicación

Con flujos conectados (`workflowDetails` en la configuración), el procedimiento es:

```powershell
pac org who
npm run build
npx power-apps push
```

No utilizar `pac code push` en este proyecto.

Tras publicar, si `power.config.json` cambió, guardar de nuevo el respaldo del ambiente correspondiente (`power.config.qa-…` o `power.config.pre-…`).

## Estructura del código

| Carpeta | Contenido |
| --- | --- |
| `src/courses` | Mis cursos, detalle, cargue y validación |
| `src/processVirtualization` | Gestión de procesos |
| `src/tracking` | Seguimiento |
| `src/statistics` | Estadísticas |
| `src/admin` | Programas, personas, entregables, líderes |
| `src/home` | Inicio según rol |
| `src/global` | Layout, autenticación, componentes compartidos |
| `src/generated` | Cliente Dataverse / flujos (generado por la CLI; no editar) |

Las pantallas no llaman Dataverse ni flujos directamente: lo hacen los servicios en `src/**/services`.

## Scripts npm

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación TypeScript + empaquetado en `dist/` |
| `npm run preview` | Vista previa del build |
| `npm run lint` | ESLint |

## Notas

- La documentación técnica ampliada puede vivir en `docs/` de forma local; esa carpeta no forma parte del repositorio remoto.
- No editar a mano `src/generated` ni `.power/schemas`. Para cambios de contrato, usar `npx power-apps refresh-data-source` / `add-data-source` / `add-flow` en el ambiente correcto.
