import React from 'react';
import { REVENUE_LEGEND_ORDER, LOAN_LEGEND_ORDER } from '../constants/trendsConstants';

/**
 * Shared legend styles for consistent appearance
 * @type {Object}
 */
const legendStyles = {
  container: {
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'center',
    gap: '20px'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  colorBox: {
    width: '14px',
    height: '14px',
    borderRadius: '2px'
  }
};

/**
 * Custom Legend component for Revenue chart with controlled order
 * Ensures consistent display order matching tooltips and data structure
 *
 * @returns {JSX.Element}
 */
export const CustomRevenueLegend = React.memo(() => (
  <div style={legendStyles.container}>
    {REVENUE_LEGEND_ORDER.map((item) => (
      <div key={item.name} style={legendStyles.item}>
        <div style={{ ...legendStyles.colorBox, backgroundColor: item.color }} />
        <span>{item.name}</span>
      </div>
    ))}
  </div>
));

CustomRevenueLegend.displayName = 'CustomRevenueLegend';

/**
 * Custom Legend component for Loan Activity chart with controlled order
 * Ensures consistent display order matching tooltips and status badges
 *
 * @returns {JSX.Element}
 */
export const CustomLoanLegend = React.memo(() => (
  <div style={legendStyles.container}>
    {LOAN_LEGEND_ORDER.map((item) => (
      <div key={item.name} style={legendStyles.item}>
        <div style={{ ...legendStyles.colorBox, backgroundColor: item.color }} />
        <span>{item.name}</span>
      </div>
    ))}
  </div>
));

CustomLoanLegend.displayName = 'CustomLoanLegend';
