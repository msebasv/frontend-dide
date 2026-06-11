import React from "react";
import { processStatusStyles } from "../constants/processStatusStyles";
interface ProcessStatusProps {
  status: string;
}

export const ProcessStatus = ({ status }: ProcessStatusProps) => {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        processStatusStyles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
};
