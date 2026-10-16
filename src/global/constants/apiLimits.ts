/**
 * Límites de paginación y listados hacia Dataverse / SharePoint.
 * Centralizados para no repetir topes mágicos en cada servicio.
 */

/** Filas por página en consultas Dataverse con skipToken. */
export const DATAVERSE_PAGE_SIZE = 500;

/** Máximo de páginas seguidas al recorrer una tabla completa. */
export const MAX_DATAVERSE_PAGES = 40;

/** Tope de ítems al listar bibliotecas SharePoint (Documentos). */
export const SHAREPOINT_LIST_MAX_TOP = 5000;

/** Tope al buscar un archivo concreto dentro de una carpeta. */
export const SHAREPOINT_FOLDER_ITEMS_TOP = 500;
