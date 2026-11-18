import React from 'react';
import SignatureApprovalControl from './SignatureApprovalControl';
import fmeProcedureLogo from '@/assets/logos/fme-procedure-logo.png';

export const ANNEXURE_2_DATA = [
  { sNo: 1, name: 'Deep Freezer/Cold Freezer', instSrNo: 'As per Master list', type: 'Temperature testing', range: '0-(-)40°C', criteria: '± 0.8°C' },
  { sNo: 2, name: 'Durometer ( Shore -A- Hardness Tester)', instSrNo: 'As per Master list', type: 'Hardness', range: '0-100 Shore', criteria: '±2' },
  { sNo: 3, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-20 Kg/cm²', criteria: '±0.4 Kg/cm2' },
  { sNo: 4, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-7 Kg/cm²', criteria: '±0.14 Kg/cm2' },
  { sNo: 5, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-14 Kg/cm²', criteria: '±0.28 Kg/cm2' },
  { sNo: 6, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-21 Kg/cm²', criteria: '±0.42 Kg/cm2' },
  { sNo: 7, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-10kg/cm', criteria: '0.2 Kg/cm2' },
  { sNo: 8, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-10.6kg/cm2', criteria: '0.21kg/cm2' },
  { sNo: 9, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-28 kg/cm2', criteria: '0.2 kg/cm2' },
  { sNo: 10, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-4 Kg/cm2', criteria: '±0.2Kg/cm2' },
  { sNo: 11, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-4.2Kg/cm2', criteria: '±0.2Kg/cm2' },
  { sNo: 12, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-1.06 Kg/cm2', criteria: '±0.02Kg/cm2' },
  { sNo: 13, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-2 Kg/cm2', criteria: '±0.2Kg/cm2' },
  { sNo: 14, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-400 MBAR', criteria: '±0.10 Mbar' },
  { sNo: 15, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0 - 12 bar', criteria: '±0.24 bar' },
  { sNo: 16, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0 - 10 bar', criteria: '±0.2 bar' },
  { sNo: 17, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0 - 16 bar', criteria: '±0.32 bar' },
  { sNo: 18, name: 'Digital Pressure Gauge/Digital Pressure Gauge kit', instSrNo: 'As per Master list', type: 'Pressure', range: '0-250 Bar', criteria: '±0.10 bar' },
  { sNo: 19, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-0.4 mpa', criteria: '±0.1mPa' },
  { sNo: 20, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-1mPa', criteria: '±0.1mPa' },
  { sNo: 21, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0 - 0.7 mpa', criteria: '±0.1mPa' },
  { sNo: 22, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0 - 1.6 mpa', criteria: '±0.1mPa' },
  { sNo: 23, name: 'Pressure Gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-0.2Mpa', criteria: '±0.02mPa' },
  { sNo: 24, name: 'Digital pressure gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-0.5Mpa', criteria: '±0.005mPa' },
  { sNo: 25, name: 'Digital pressure gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-0.85Mpa', criteria: '±0.02mPa' },
  { sNo: 26, name: 'Digital pressure gauge', instSrNo: 'As per Master list', type: 'Pressure', range: '0-1mPa', criteria: '±0.1mPa' },
  { sNo: 27, name: 'Infrared Thermometer', instSrNo: 'As per Master list', type: 'Temperature', range: '-30°C to 550°C', criteria: '±11.6°c' },
  { sNo: 28, name: 'Sound Level Meter', instSrNo: 'As per Master list', type: 'Sound', range: '30-130db', criteria: '± 2 DB' },
  { sNo: 29, name: 'Radius gauge', instSrNo: 'As per Master list', type: 'Radius', range: '0.4-6 mm', criteria: '± 10 micron' },
  { sNo: 30, name: 'Slip gauge set', instSrNo: 'As per Master list', type: 'Dimensional', range: '100mm', criteria: '± 0.0008 mm' },
  { sNo: 31, name: 'Surface plate', instSrNo: 'As per Master list', type: 'Dimensional', range: '1600x1000mm', criteria: '± 10 micron' },
  { sNo: 32, name: 'Thermohygro meter', instSrNo: 'As per Master list', type: 'Temp./Humidity', range: 'T:-20-70°C ,H: 20-99%RH', criteria: 'Temp. ±1°c, Humidity. 5%' },
  { sNo: 33, name: 'Thermal Shock Test Cabinet', instSrNo: 'As per Master list', type: 'Temperature', range: '`-80°C to 220°C', criteria: '±3°C' },
  { sNo: 34, name: 'Climatic Test Chamber', instSrNo: 'As per Master list', type: 'Humidity', range: '`-70°C to `+180°C/ 10 to 98 %RH', criteria: '±3°C,±5% RH' },
  { sNo: 35, name: 'Temp. rise curve /Derating curve test', instSrNo: 'As per Master list', type: 'Temp.', range: '150A ,500°C', criteria: '±3 A,±10°C' },
  { sNo: 36, name: 'AC/DC High voltage tester', instSrNo: 'As per Master list', type: 'Voltage', range: '5.0 KV (AC) 6.0 KV (DC)', criteria: '±0.06' },
  { sNo: 37, name: 'Digital Vernier caliper', instSrNo: 'As per Master list', type: 'Linear', range: '0-300mm', criteria: '± 30 micron' },
  { sNo: 38, name: 'Digital Height gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-600mm', criteria: '± 0.020' },
  { sNo: 39, name: 'Digital Push Pull Gauge( Digital Force Gauge)', instSrNo: 'As per Master list', type: 'Force', range: '0-500N', criteria: '±6 N' },
  { sNo: 40, name: 'Digital Vernier caliper', instSrNo: 'As per Master list', type: 'Linear', range: '0-150mm', criteria: '± 30 micron' },
  { sNo: 41, name: 'Digital Vernier caliper', instSrNo: 'As per Master list', type: 'Linear', range: '0-200mm', criteria: '± 30 micron' },
  { sNo: 42, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '420g', criteria: '±0.03g' },
  { sNo: 43, name: 'Flat Micrometer', instSrNo: 'As per Master list', type: 'Linear', range: '0-25 mm', criteria: '±0.004mm' },
  { sNo: 44, name: 'Insulation resistance Tester', instSrNo: 'As per Master list', type: 'Resistance', range: '0-2000Mohm(1000V)', criteria: '±2Mohm' },
  { sNo: 45, name: 'Digital Insulation Resistance Tester', instSrNo: 'As per Master list', type: 'Resistance', range: '0 - 500MΩ/1000V', criteria: '±4' },
  { sNo: 46, name: 'Digital Insulation Resistance Tester', instSrNo: 'As per Master list', type: 'Resistance', range: '0 - 5000MΩ/1000V', criteria: '±4' },
  { sNo: 47, name: 'DC Power Supply', instSrNo: 'As per Master list', type: 'Current', range: '0-30Volt 0-6A', criteria: 'V:±0.50 A:±0.15' },
  { sNo: 48, name: 'DC Power Supply', instSrNo: 'As per Master list', type: 'Current', range: '0-250 Volt 0-3A', criteria: 'V:±4.0 A:±0.1' },
  { sNo: 49, name: 'DC Regulated Power Supply', instSrNo: 'As per Master list', type: 'Current', range: '0-250 Volt 0-3A', criteria: 'V:±4.0 A:±0.1' },
  { sNo: 50, name: 'Puppy dial Gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-0.8mm', criteria: '±0.05mm' },
  { sNo: 51, name: 'Torque Tester', instSrNo: 'As per Master list', type: 'Torque', range: '0-20Nm', criteria: '±0.5Nm' },
  { sNo: 52, name: 'Digital dial gauge/Dial Indicator', instSrNo: 'As per Master list', type: 'Linear', range: '0-20mm', criteria: '±0.01mm' },
  { sNo: 53, name: 'Dial Thickness Tester', instSrNo: 'As per Master list', type: 'Thickness', range: '0-15mm', criteria: '±0.04mm' },
  { sNo: 54, name: 'CMM', instSrNo: 'As per Master list', type: 'Linear', range: 'X 0-700, Y 0-700, Z 0-600', criteria: '±0.001mm' },
  { sNo: 55, name: 'Digital Point Micrometer', instSrNo: 'As per Master list', type: 'Linear', range: '0-20 mm', criteria: '±0.004 mm' },
  { sNo: 56, name: 'Digital Blade Micrometer', instSrNo: 'As per Master list', type: 'Linear', range: '0-25 mm', criteria: '±0.004 mm' },
  { sNo: 57, name: 'Double Point Micrometer', instSrNo: 'As per Master list', type: 'Linear', range: '0-25MM', criteria: '±0.004mm' },
  { sNo: 58, name: 'Digital dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-6 mm', criteria: '±0.004mm' },
  { sNo: 59, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-12.60mm', criteria: '±0.004mm' },
  { sNo: 60, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-13.60mm', criteria: '±0.004mm' },
  { sNo: 61, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-5mm', criteria: '±0.004mm' },
  { sNo: 62, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-12.7mm', criteria: '±0.004mm' },
  { sNo: 63, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-7.5mm', criteria: '±0.004mm' },
  { sNo: 64, name: 'Digital Dial gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0-12.5 mm', criteria: '±0.004mm' },
  { sNo: 65, name: 'Digital Dial gauge/ Linear Gauge', instSrNo: 'As per Master list', type: 'Linear', range: '0 - 10 mm', criteria: '±0.009mm' },
  { sNo: 66, name: 'Weight all type', instSrNo: 'As per Master list', type: 'Weight', range: '----', criteria: '±2%' },
  { sNo: 67, name: 'Thickness tester', instSrNo: 'As per Master list', type: 'Thickness', range: '0-10mm', criteria: '±0.04mm' },
  { sNo: 68, name: 'Thickness tester', instSrNo: 'As per Master list', type: 'Thickness', range: '0-25mm', criteria: '±0.04mm' },
  { sNo: 69, name: 'Clamp Meter (Digital Multimeter)', instSrNo: 'As per Master list', type: 'Resistance', range: '----', criteria: 'V. ±12, A. 30' },
  { sNo: 70, name: 'Digital Clamp Meter', instSrNo: 'As per Master list', type: 'Resistance', range: '----', criteria: 'V. ±12, A±30' },
  { sNo: 71, name: 'Digital micro ohm meter', instSrNo: 'As per Master list', type: 'Resistance', range: '1999 µΩ - 19.99 KΩ', criteria: '±10' },
  { sNo: 72, name: 'Digital micro ohm meter', instSrNo: 'As per Master list', type: 'Resistance', range: '3000 µΩ- 30 KΩ', criteria: '±10' },
  { sNo: 73, name: 'Digital micro ohm meter', instSrNo: 'As per Master list', type: 'Resistance', range: '0 to 19.99 KΩ', criteria: '±10' },
  { sNo: 74, name: 'Digital micro ohm meter', instSrNo: 'As per Master list', type: 'Resistance', range: '1 µΩ to 29.99 KΩ', criteria: '±10' },
  { sNo: 75, name: 'Vision Measuring Machine', instSrNo: 'As per Master list', type: 'Linear', range: 'X-(0-200mm), Y-(0-100mm), Z-(0-150mm).', criteria: '±0.0065mm' },
  { sNo: 76, name: 'Digital Lux meter', instSrNo: 'As per Master list', type: 'Brightness', range: '0.1Lux-200,000Lux', criteria: '±140' },
  { sNo: 77, name: 'Lux meter', instSrNo: 'As per Master list', type: 'Brightness', range: '200-2000', criteria: '±90' },
  { sNo: 78, name: 'Motorized pull tester', instSrNo: 'As per Master list', type: 'Force', range: '0-100 Kgf', criteria: '±4 Kgf' },
  { sNo: 79, name: 'Motorized pull tester', instSrNo: 'As per Master list', type: 'Force', range: '0-500 Kgf', criteria: '±4 Kgf' },
  { sNo: 80, name: 'DC Power Supply', instSrNo: 'As per Master list', type: 'Current', range: '0-32 Vdc 0-6 A', criteria: 'V.±0.50 A.±0.15' },
  { sNo: 81, name: 'Electronic soldering station', instSrNo: 'As per Master list', type: 'soldering', range: "150° to 525°", criteria: '±5°' },
  { sNo: 82, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '0-620g', criteria: '±0.03g' },
  { sNo: 83, name: 'Digital dial gauge/Dial Indicator', instSrNo: 'As per Master list', type: 'Linear', range: '0-25mm', criteria: '±0.003mm' },
  { sNo: 84, name: 'Digital Insulation Resistance Meter', instSrNo: 'As per Master list', type: 'Resistance', range: '0-500MΩ/1000V', criteria: '±15MΩ, V- ±7' },
  { sNo: 85, name: 'Digital Resistance Hi-tester', instSrNo: 'As per Master list', type: 'Resistance', range: '0-110MΩ', criteria: '±0.6' },
  { sNo: 86, name: 'Digital AC VOLT METER', instSrNo: 'As per Master list', type: 'Voltage', range: '440V', criteria: 'Voltage. ±1.9' },
  { sNo: 87, name: 'Insulation resistance meter', instSrNo: 'As per Master list', type: 'Resistance', range: '1-2000MΩ', criteria: '±2' },
  { sNo: 88, name: 'VOLT METER & AMPERE METER', instSrNo: 'As per Master list', type: 'Voltage', range: '0-1000 VOLT', criteria: '±1.5' },
  { sNo: 89, name: 'VOLT METER & AMPERE METER', instSrNo: 'As per Master list', type: 'Voltage', range: '0 to440V & 0 to 250A', criteria: 'V-±1.9, A-±5 A' },
  { sNo: 90, name: 'DIGITAL AMPERE METER', instSrNo: 'As per Master list', type: 'AMPERE', range: '0- 1000 A', criteria: ',A. ±5.00' },
  { sNo: 91, name: 'DIGITAL AMPERE METER', instSrNo: 'As per Master list', type: 'AMPERE', range: '0- 400 A', criteria: '±2' },
  { sNo: 92, name: 'Digital Dial Gauge/ Linear', instSrNo: 'As per Master list', type: 'Linear', range: '0 - 10 mm', criteria: '±0.009mm' },
  { sNo: 93, name: 'DC Regulated Power Supply', instSrNo: 'As per Master list', type: 'Current', range: '0-30 Vdc 0-37 A', criteria: 'Voltage.±3.0,A. ±0.080' },
  { sNo: 94, name: 'Thermohygrometer', instSrNo: 'As per Master list', type: 'Temperature', range: 'T:0-70OC ,H: 20-99%RH', criteria: 'Temp. ±1°c, Humidity. 5%' },
  { sNo: 95, name: 'Tensile Testing Machine', instSrNo: 'As per Master list', type: 'Force', range: '0-100kg/ 0-1000kg', criteria: '±2.0' },
  { sNo: 96, name: 'Sound Calibrator', instSrNo: 'As per Master list', type: 'Sound', range: '94.0dB', criteria: '±0.3db' },
  { sNo: 97, name: 'Sound Level Measuring Amplifier', instSrNo: 'As per Master list', type: 'Sound', range: '20-130dB', criteria: '±0.3db' },
  { sNo: 98, name: 'Digital Torque Wrench', instSrNo: 'As per Master list', type: 'Torque', range: '0-20Nm', criteria: '±0.400NM' },
  { sNo: 99, name: 'Digital dial gauge/Dial Indicator', instSrNo: 'As per Master list', type: 'Linear', range: '0-15mm', criteria: '±0.003mm' },
  { sNo: 100, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '0-6Kg', criteria: '±30g' },
  { sNo: 101, name: 'Analog MΩ HI tester', instSrNo: 'As per Master list', type: 'Resistance', range: '0-100MΩ', criteria: '±0.5%' },
  { sNo: 102, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0 - 1000 mm', criteria: '±2 mm', isScaleGroupStart: true, scaleGroupSpan: 34 },
  { sNo: 103, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-6400 mm', inScaleGroup: true },
  { sNo: 104, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-4000mm', inScaleGroup: true },
  { sNo: 105, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-300MM', inScaleGroup: true },
  { sNo: 106, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0 - 2800 mm', inScaleGroup: true },
  { sNo: 107, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-3000MM', inScaleGroup: true },
  { sNo: 108, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-1800MM', inScaleGroup: true },
  { sNo: 109, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2000MM', inScaleGroup: true },
  { sNo: 110, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-650mm', inScaleGroup: true },
  { sNo: 111, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-880mm', inScaleGroup: true },
  { sNo: 112, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-660mm', inScaleGroup: true },
  { sNo: 113, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-890MM', inScaleGroup: true },
  { sNo: 114, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-5600mm', inScaleGroup: true },
  { sNo: 115, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-800 mm', inScaleGroup: true },
  { sNo: 116, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-540 mm', inScaleGroup: true },
  { sNo: 117, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-500 mm', inScaleGroup: true },
  { sNo: 118, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-3000 mm', inScaleGroup: true },
  { sNo: 119, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-150 mm', inScaleGroup: true },
  { sNo: 120, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2600 mm', inScaleGroup: true },
  { sNo: 121, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-5000mm', inScaleGroup: true },
  { sNo: 122, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2700mm', inScaleGroup: true },
  { sNo: 123, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-3600MM', inScaleGroup: true },
  { sNo: 124, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0 - 2100 mm', inScaleGroup: true },
  { sNo: 125, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0 - 1200 mm', inScaleGroup: true },
  { sNo: 126, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2400mm', inScaleGroup: true },
  { sNo: 127, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-3300mm', inScaleGroup: true },
  { sNo: 128, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-900 mm', inScaleGroup: true },
  { sNo: 129, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2900mm', inScaleGroup: true },
  { sNo: 130, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-1700mm', inScaleGroup: true },
  { sNo: 131, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-480 mm', inScaleGroup: true },
  { sNo: 132, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-700 mm', inScaleGroup: true },
  { sNo: 133, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2450 mm', inScaleGroup: true },
  { sNo: 134, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2500 mm', inScaleGroup: true },
  { sNo: 135, name: 'Measuring Scale /tape', instSrNo: 'As per Master list', type: 'Measurement', range: '0-2700mm', inScaleGroup: true },
  { sNo: 136, name: 'Digital Push Pull Gauge( Digital Force Gauge)', instSrNo: 'As per Master list', type: 'Force', range: '0-200N', criteria: '±6 N' },
  { sNo: 137, name: 'Wire resistance meter', instSrNo: 'As per Master list', type: 'Resistance', range: '0-20Ω', criteria: '±0.020Ω' },
  { sNo: 138, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '0-200 kg', criteria: '±20g' },
  { sNo: 139, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '200g-100kg', criteria: '±20g' },
  { sNo: 140, name: 'Dig Water flow meter', instSrNo: 'As per Master list', type: 'Measurement', range: '0-181 m3/hr', criteria: '±3%' },
  { sNo: 141, name: 'DC-810 (Weight Scale 6kgs)', instSrNo: 'As per Master list', type: 'Weight', range: '0.1g - 6kg', criteria: '±30g' },
  { sNo: 142, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '0-50Kg', criteria: '±60g' },
  { sNo: 143, name: 'Double Kelvin Brize', instSrNo: 'As per Master list', type: 'Resistance', range: '0.2 micro ohm to 11 ohm', criteria: '±0.05%' },
  { sNo: 144, name: 'Weighing machine', instSrNo: 'As per Master list', type: 'Weight', range: '2000 Kg', criteria: '±30g' },
  { sNo: 145, name: 'Screwdriver', instSrNo: 'As per Master list', type: 'NEWTON', range: '1.72 TO 2.28 N', criteria: '±0.08 nm' },
  { sNo: 146, name: 'STD. RESISTANCE BOX', instSrNo: 'As per Master list', type: 'Resistance', range: '0.001Ω to 1kΩ', criteria: '±0.8' },
  { sNo: 147, name: 'SSG / TSN4 - 20M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 148, name: 'SSG /DS4-20M -B', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 149, name: 'SSG /TSN10-18M-GR', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 150, name: 'SSG/TSN8-18M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 151, name: 'SSE - SB - 6M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 152, name: 'SSG - TP - 9MA - GR', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 153, name: 'TSN - 8M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 154, name: 'TSN - 12M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 155, name: 'YSN - 8M', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: '±0.1 mm' },
  { sNo: 156, name: '(7½)Digit Digital Multimeter', instSrNo: 'As per Master list', type: 'Measurement', range: '3A, 250V', criteria: 'V:±0.05' },
  { sNo: 157, name: 'AC/DC High Voltage Tester', instSrNo: 'As per Master list', type: 'Measurement', range: '5.0 KV (AC) 6.0 KV (DC)', criteria: 'KV:±0.02' },
  { sNo: 158, name: 'Auto Crimp Tester', instSrNo: 'As per Master list', type: 'Measurement', range: '1000N', criteria: '±3 N' },
  { sNo: 159, name: 'Kalvin Double Bridge', instSrNo: 'As per Master list', type: 'Measurement', range: '0.2 micro ohm to 11 ohm', criteria: '±0.05 Micro Ohm' },
  { sNo: 160, name: 'MAG FLOW - 650', instSrNo: 'As per Master list', type: 'Measurement', range: '0.2 - 10m3/hr', criteria: '±0.15' },
  { sNo: 161, name: 'SS Laboratory Weights Set,#Class: "E2"', instSrNo: 'As per Master list', type: 'Weight', range: '0.001g to 200g', criteria: '±0.0008' },
  { sNo: 162, name: 'Vinyl Tube Gauge', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Standard' },
  { sNo: 163, name: 'NCOT Gauge', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Standard' },
  { sNo: 164, name: 'Mandrel', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per General tolerances' },
  { sNo: 165, name: 'Bend Gauge', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 166, name: 'Grommet Ins./Ret. Plate', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 167, name: 'Nir-007 Pigital Checking Jig S Ab', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 168, name: 'Nir-007 Pigital Checking Jig S N-Ab', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 169, name: 'SZH007 Alignment Jig (MP99-104-1)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 170, name: 'SZH007 Alignment Jig (101-1)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 171, name: 'NG Master Jig - Electronic Part Insertion M/C', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 172, name: 'OK Master Jig - Electronic Part Insertion M/C', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 173, name: 'NG Master Jig Receptacle Insertion M/C', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 174, name: 'OK Master Jig Receptacle Insertion M/C', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 175, name: 'Receptacle Insertion M/C Plate', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 176, name: 'Busbar Arrangement Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 177, name: 'SZR017 [FFC-2] BENDING JIG', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 178, name: 'SZR017 [FFC-1st] BENDING JIG', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 179, name: 'Bending Jig SZR -014', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 180, name: 'Bending Jig SZR -013', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 181, name: 'Bending Jig NIR -007', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 182, name: 'Szr-013/014 Pigital Assy. Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 183, name: 'Szr-013/014 Alignment Assy. Jig(Sc Side)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 184, name: 'Push Pull Gauge Fixture Plate', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 185, name: 'Szr-017 Alignment Jig(Sc Side)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 186, name: 'Szr-017 Alignment Jig(C Side)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 187, name: 'Szr-013/014 Alignment Assy. Jig(C Ab Side)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 188, name: 'Rbc/Bbg-Pvc Template', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 189, name: 'Xbb-Pvc Template', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 190, name: 'Szr-013/014 Alignment Assy. Jig(CAB Side)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 191, name: 'SZR017 [FFC-1] BENDING JIG', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 192, name: 'Ferrite Checker Jig (Nir)', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 193, name: 'Pigital Measuring Template For Xba/Xbb', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 194, name: 'Pigital Assy Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 195, name: 'Nir Dummy', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 196, name: 'Szr Dummy', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 197, name: 'Pvc Measuring Template Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 198, name: 'Xbb/Bbg Pvc Measuring Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 199, name: 'Nir.N A/B Pvc Measuring Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 200, name: 'Pvc Tape Measuring Template Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 201, name: 'Szr-020 Alignment Gauge.(C N/Ab) Pass Throw', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 202, name: 'Szr-020 Alignment Gauge.(C Ab Side) Pass Throw', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 203, name: 'JB Position Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 204, name: 'Pvc Tube Mesuring Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 205, name: 'Szr-014 Alignment Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 206, name: 'Carrier Cutting Jig SZR014/016 Column Side', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 207, name: 'Carrier Cutting Jig SZR013/015 Column Side', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 208, name: 'Carrier Cutting Jig SZR Steering Side/NIR007 Both Side', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 209, name: 'Szr-017 Alignment Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 210, name: 'Wire Stripper Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 211, name: 'Digital Weighing machine', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 212, name: 'Digital Weighing Balance', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 213, name: 'YY8 Protector Torque Jig', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 214, name: 'Insertion Gauge', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 215, name: 'Right Angle', instSrNo: 'As per Master list', type: 'Measurement', range: '------', criteria: 'As Per Drawing' },
  { sNo: 216, name: 'Stripping Gauge', instSrNo: 'As per Master list', type: 'Stripping', range: '------', criteria: 'As Per Drawing' }
];

export default function Annexure2Checksheet({
  document = {},
  onSave = () => {}
}) {
  return (
    <div className="w-[1140px] shrink-0 mx-auto bg-white border-2 border-black text-black font-sans shadow-lg text-xs print:w-full print:border-black select-text overflow-hidden">
      {/* ── Top Bar: Company Name ── */}
      <div className="flex justify-end px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-black bg-white">
        FURUKAWA MINDA ELECTRIC PVT. LTD.
      </div>

      {/* ── Header: Logo, Title, Metadata ── */}
      <div className="grid grid-cols-12 border-t-2 border-b-2 border-black">
        {/* Logo (Col 1-2) */}
        <div className="col-span-2 p-2 flex items-center justify-center border-r border-black bg-white">
          <img
            src={fmeProcedureLogo}
            alt="Furukawa Minda Fme Logo"
            className="h-14 w-auto max-w-[130px] object-contain select-none"
          />
        </div>

        {/* Title Center (Col 3-8) */}
        <div className="col-span-6 flex items-center justify-center border-r border-black p-3 bg-white text-center">
          <h1 className="text-3xl font-black uppercase tracking-wider text-black font-sans">
            ANNEXURE - 2
          </h1>
        </div>

        {/* Metadata Table (Col 9-12) */}
        <div className="col-span-4 flex flex-col justify-between divide-y divide-black text-[11px] font-semibold bg-white">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Ref No:</span>
            <span className="font-mono font-bold text-black">PRC-WH-QA-007</span>
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Rev:</span>
            <span className="font-mono font-bold text-black">01</span>
          </div>
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-black font-bold">Rev Date:</span>
            <span className="font-bold text-black">15.03.19</span>
          </div>
        </div>
      </div>

      {/* ── Subtitle ── */}
      <div className="px-3 py-2 border-b border-black font-bold text-[13px] uppercase tracking-wide bg-white text-black">
        ACCEPATANCE CRITERIA FOR CALIBRATION
      </div>

      {/* ── 6-Column Acceptance Criteria Table ── */}
      <table className="w-full text-left border-collapse table-fixed text-[11px]">
        <colgroup>
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '13.5%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '18.5%' }} />
          <col style={{ width: '18.5%' }} />
        </colgroup>
        <thead>
          <tr className="bg-white text-black font-bold border-b border-black text-center divide-x divide-black uppercase text-[11px]">
            <th className="p-2">S.No.</th>
            <th className="p-2">Instrument Name/ Type</th>
            <th className="p-2">Instrument Sr. No.</th>
            <th className="p-2">Type of Measurement</th>
            <th className="p-2">Range</th>
            <th className="p-2 border-r border-black">ACCEPTANCE CRITERIA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black divide-x divide-black">
          {ANNEXURE_2_DATA.map((row) => (
            <tr key={row.sNo} className="hover:bg-slate-50/50">
              <td className="p-1.5 text-center font-bold">{row.sNo}</td>
              <td className="p-1.5 font-medium">{row.name}</td>
              <td className="p-1.5 text-center font-medium">{row.instSrNo}</td>
              <td className="p-1.5 text-center font-medium">{row.type}</td>
              <td className="p-1.5 text-center font-medium font-mono">{row.range}</td>
              {row.isScaleGroupStart ? (
                <td
                  rowSpan={row.scaleGroupSpan}
                  className="p-1.5 text-center font-bold text-sm align-middle bg-white border-r border-black"
                >
                  {row.criteria}
                </td>
              ) : row.inScaleGroup ? null : (
                <td className="p-1.5 text-center font-medium font-mono border-r border-black">{row.criteria}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Revision Table: Details of Change ── */}
      <table className="w-full text-left border-collapse border-t-2 border-b-2 border-black text-xs">
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '45%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-black divide-x divide-black font-bold text-center bg-white">
            <th rowSpan={2} className="p-2 align-middle">
              Revision No.
            </th>
            <th rowSpan={2} className="p-2 align-middle">
              Revision Date
            </th>
            <th colSpan={2} className="p-1.5 text-center border-r border-black">
              Details of Change
            </th>
          </tr>
          <tr className="border-b border-black divide-x divide-black font-bold text-center bg-white">
            <th className="p-1.5 text-center">Affected Sr. No. / page</th>
            <th className="p-1.5 text-center border-r border-black">Change details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black divide-x divide-black">
          {/* Rev 0 */}
          <tr>
            <td className="p-2.5 text-center font-bold text-sm">0</td>
            <td className="p-2.5 text-center font-bold">30.08.08</td>
            <td className="p-2.5 text-center font-medium">All</td>
            <td className="p-2.5 text-left font-medium border-r border-black">Original issue</td>
          </tr>

          {/* Rev 1 */}
          <tr>
            <td className="p-2.5 text-center font-bold text-sm">1</td>
            <td className="p-2.5 text-center font-bold">15.03.19</td>
            <td className="p-2.5 text-center font-medium">All</td>
            <td className="p-2.5 text-left font-medium space-y-1 border-r border-black">
              <div>
                1. Company Name changed from Minda Furukawa Electric to Furukawa Minda Electric Pvt. Ltd. and logo changed from MFE to FME
              </div>
              <div>2. Verified by replace with Reviewed By</div>
              <div>3. Document Numbering changed from PRC/QA/007 Annexure-1 to Annexure-1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Signatures Row: Prepared, Checked, Reviewed, Approved ── */}
      <div className="grid grid-cols-4 border-b border-black divide-x divide-black bg-white">
        {/* Prepared By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Prepared By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="prepared"
              initialApproved={true}
              initialName="Khushboo"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Checked By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Checked By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="checked"
              initialApproved={true}
              initialName="Arvind"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Reviewed By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Reviewed By:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="reviewed"
              initialApproved={true}
              initialName="Arvind"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>

        {/* Approved By */}
        <div className="p-2 flex flex-col justify-between min-h-[75px]">
          <span className="font-bold text-[11px] text-black">Approved by:</span>
          <div className="mt-1">
            <SignatureApprovalControl
              role="approved"
              initialApproved={true}
              initialName="Yadvender"
              initialDate="15.03.19"
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
        </div>
      </div>

      {/* ── Document Footer Metadata Bar ── */}
      <div className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold bg-white text-black">
        <div>FRM-WH-QA-214</div>
        <div>Rev:00</div>
        <div>Issue Date: 25.02.2019</div>
        <div>Page: 1 of 1</div>
      </div>
    </div>
  );
}
