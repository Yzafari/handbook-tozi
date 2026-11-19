export type VoltageDropPhase = 'single' | 'three';

export type VoltageDropMaterial = 'copper' | 'aluminum';

export type VoltageDropMethod = 'cable' | 'overhead';

export type VoltageDropInputs = {
  current: number;
  length: number;
  voltage: number;
  powerFactor: number;
  phase: VoltageDropPhase;
  material: VoltageDropMaterial;
  /**
   * Accepted for future correction factors (cable vs. overhead).
   * The current approved formula does not depend on the installation method.
   */
  method: VoltageDropMethod;
};

export type VoltageDropStatus = 'مجاز' | 'غیرمجاز';

export type VoltageDropResult = {
  deltaV: number;
  percent: number;
  status: VoltageDropStatus;
};

/** Approximate resistance values (ohm) used by the reference formula. */
const RESISTANCE_COPPER = 0.0175;
const RESISTANCE_ALUMINUM = 0.028;

/** Approximate reactance value (ohm) used by the reference formula. */
const REACTANCE = 0.08;

/** Maximum allowed voltage drop percentage. */
const MAX_ALLOWED_PERCENT = 5;

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateVoltageDrop(inputs: VoltageDropInputs): VoltageDropResult {
  const { current, length, voltage, powerFactor, phase, material } = inputs;

  if (!Number.isFinite(current) || current <= 0) {
    throw new Error('جریان عبوری باید عددی بزرگ‌تر از صفر باشد.');
  }

  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('طول مسیر باید عددی بزرگ‌تر از صفر باشد.');
  }

  if (!Number.isFinite(voltage) || voltage <= 0) {
    throw new Error('ولتاژ باید عددی بزرگ‌تر از صفر باشد.');
  }

  if (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1) {
    throw new Error('ضریب توان باید عددی بین ۰ و ۱ باشد.');
  }

  const resistance = material === 'copper' ? RESISTANCE_COPPER : RESISTANCE_ALUMINUM;
  const reactance = REACTANCE;

  const cosPhi = powerFactor;
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));

  const alpha = phase === 'single' ? 2 : Math.sqrt(3);

  const deltaV = alpha * current * length * (resistance * cosPhi + reactance * sinPhi);
  const percent = (deltaV / voltage) * 100;

  return {
    deltaV: roundTo(deltaV, 2),
    percent: roundTo(percent, 2),
    status: percent <= MAX_ALLOWED_PERCENT ? 'مجاز' : 'غیرمجاز',
  };
}
