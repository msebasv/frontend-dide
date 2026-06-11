import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";

import type { VirtualizationProcess } from "../types/process.types";

interface MapperParams {
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
}

export const mapVirtualizationProcesses = ({
  processes,
  courses,
  programs,
  faculties,
  phases,
}: MapperParams): VirtualizationProcess[] => {
  const coursesMap = new Map(
    courses.map((course) => [course.dev_tablecourseinstanceid, course]),
  );

  const programsMap = new Map(
    programs.map((program) => [program.dev_table_programid, program]),
  );

  const facultiesMap = new Map(
    faculties.map((faculty) => [faculty.dev_table_facultyid, faculty]),
  );

  const phasesByProcess = new Map<string, Dev_tablephases[]>();

  for (const phase of phases) {
    const processId = phase._dev_tablevirtualizationprocess_value;

    if (!processId) continue;

    const current = phasesByProcess.get(processId) ?? [];

    current.push(phase);

    phasesByProcess.set(processId, current);
  }

  return processes.map((process) => {
    const course = coursesMap.get(process._dev_tablecourse_value ?? "");

    const program = programsMap.get(course?._dev_tableprogram_value ?? "");

    const faculty = facultiesMap.get(program?._dev_table_faculty_value ?? "");

    const processPhases =
      phasesByProcess.get(process.dev_tablevirtualizationprocessid) ?? [];

    const lastPhase = [...processPhases].sort(
      (a, b) =>
        new Date(b.createdon ?? "").getTime() -
        new Date(a.createdon ?? "").getTime(),
    )[0];

    console.log(lastPhase.dev_expectedactivitytemplatename);

    return {
      processId: process.dev_tablevirtualizationprocessid,
      processName: process.dev_nameprocess ?? "",
      courseName: course?.dev_namecourse ?? "",
      programName: program?.dev_nameprogram ?? "",
      facultyName: faculty?.dev_namefaculty ?? "",
      status: lastPhase?.dev_expectedactivitytemplatename ?? "",
    };
  });
};
