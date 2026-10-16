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
Las configuraciones de desarrollo personal no van al repositorio.

## Requisitos

- Node.js LTS (recomendado 22.x)
- npm
- [Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`)
- Acceso al tenant y a los ambientes QA / PRE

## Instalación

```powershell
npm install
Copy-Item .\.env.example .\.env.local
# Ajuste VITE_SHAREPOINT_SITE_URL al sitio del ambiente activo
```

## Variables de entorno (Vite)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `VITE_SHAREPOINT_SITE_URL` | Sí (archivos) | URL del sitio SharePoint del ambiente |
| `VITE_SHAREPOINT_LIBRARY` | No | Biblioteca (por defecto `Shared Documents`) |
| `VITE_SHAREPOINT_FORMATS_FOLDER` | No | Carpeta de formatos (por defecto `Formats`) |

Plantilla: `.env.example`. En local se usa `.env.local` (no se versiona).

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
Tras un `refresh-data-source` / `add-data-source`, los esquemas en `.power/schemas` reflejan el ambiente autenticado; no editarlos a mano.

## Desarrollo local

```powershell
npm run dev
```

Abrir la URL **Local Play** que imprime la consola (no solo el puerto de Vite), para autenticarse con Microsoft dentro del reproductor de Power Apps.

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
Las constantes de dominio viven en `src/global/constants/`.

## Scripts npm

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación TypeScript + empaquetado en `dist/` |
| `npm run preview` | Vista previa del build |
| `npm run lint` | ESLint |

## Notas

- No editar a mano `src/generated` ni `.power/schemas`. Para cambios de contrato, usar `npx power-apps refresh-data-source` / `add-data-source` / `add-flow` en el ambiente correcto.
