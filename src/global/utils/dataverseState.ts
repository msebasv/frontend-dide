/** statecode 0 es activo. Si no viene, se trata como activo (registros antiguos). */
export const isActiveDataverseRecord = (statecode: unknown): boolean => {
  if (statecode === undefined || statecode === null || statecode === "") {
    return true;
  }
  return Number(statecode) === 0;
};
