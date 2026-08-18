export const initialWorkRecords = [
  { time: '13:10 - 14:05', duration: '55분', temp: 33, coreTemp: 37.6 },
  { time: '10:20 - 11:30', duration: '70분', temp: 31, coreTemp: 37.3 },
  { time: '08:00 - 09:00', duration: '60분', temp: 29, coreTemp: 37.0 },
];

export const initialRestRecords = [
  { time: '14:05 - 14:25', duration: '20분', temp: 35, coreTemp: 37.8 },
  { time: '11:30 - 11:50', duration: '20분', temp: 32, coreTemp: 37.4 },
  { time: '09:00 - 09:20', duration: '20분', temp: 31, coreTemp: 37.2 },
];

export const DEFAULT_ADMIN_SETTINGS = {
  dangerTemperature: 43,
  cautionTemperature: 38,
  maxWorkMinutes: 120,
  restMinutes: 20,
  channels: {
    push: true,
    sms: true,
    email: false,
    emergencyCall: true,
  },
};
