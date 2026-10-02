'use client';

/**
 * FLUENT SELECT WRAPPER
 * ------------------------------------------------------------------
 * Fluent v9's Dropdown takes <Option> children rather than an `options`
 * array. This wrapper keeps call sites terse and typed, and mirrors the
 * Fluent look exactly because it *is* a Fluent Dropdown.
 */

import React from 'react';
import { Dropdown, Option, type OptionOnSelectData } from '@fluentui/react-components';

export interface SelectOption {
  key: string;
  text: string;
  disabled?: boolean;
}

export function Select({
  value,
  options,
  onChange,
  disabled,
  style,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <Dropdown
      value={value}
      selectedOptions={[value]}
      disabled={disabled}
      aria-label={ariaLabel}
      onOptionSelect={(_e, d: OptionOnSelectData) => onChange(d.optionValue as string)}
      style={style}
    >
      {options.map((o) => (
        <Option key={o.key} value={o.key} disabled={o.disabled}>
          {o.text}
        </Option>
      ))}
    </Dropdown>
  );
}
