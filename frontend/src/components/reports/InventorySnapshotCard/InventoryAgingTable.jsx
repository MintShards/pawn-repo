/**
 * Storage aging analysis table component
 */

import React from "react";
import { formatCurrency } from "./utils/inventoryFormatters";

/**
 * Aging table row component
 *
 * @param {Object} props - Component props
 * @param {Object} props.ageData - Age range data object
 */
const AgingRow = ({ ageData }) => {
  return (
    <tr
      className={`border-b border-slate-100 dark:border-slate-800 ${
        ageData.alert ? "bg-orange-50/50 dark:bg-orange-900/20" : ""
      }`}
    >
      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
        {ageData.alert && "⚠️ "}
        {ageData.age_range}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {ageData.item_count}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {formatCurrency(ageData.loan_value)}
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
        {ageData.percentage.toFixed(1)}%
      </td>
    </tr>
  );
};

/**
 * Storage aging analysis table component
 *
 * @param {Object} props - Component props
 * @param {Array} props.by_age - Array of age range objects
 */
const InventoryAgingTable = ({ by_age }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        Storage Aging Analysis
      </h3>
      <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Days
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Items
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                Value
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {by_age.map((age) => (
              <AgingRow key={age.age_range} ageData={age} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryAgingTable;
