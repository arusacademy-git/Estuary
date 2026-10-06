export const EMPLOYEE_NAMES = [
  'Adhikananda Kevin Tandiono',
  'Aina Sahira binti Abdul Karim',
  'Alina Bt Amir',
  'Anis Fatinah binti Redwan',
  'Chak Shan Chun @ David',
  'Daniel Russel A/L Mohanraj',
  'Era Natasha Abd Gani',
  'Felicia Yoon Pui Shi',
  'Ilmi Safina binti Zulhi',
  'Joanna Peh En Zhen',
  'Khor Yi Thing',
  'Lee Jie Yee',
  'Lingeswary a/p Manickam',
  'Muhamad Amir Zakwan bin Azman',
  'Muhammad Afiq bin Abdullah',
  'Muhammad Afiq bin Iskandar',
  'Mulqis bin Abdullah',
  'Nalissa Suria Binti Asri Raja',
  'Nirmaladevi A/P M. Aravinthan',
  'Noor Elliesya Binti Kamarul Zaman',
  'Nur Adlina Sofea binti Mahdzir',
  'Nur Hawa Nabiha Mazlan',
  'Nuraisyah Bibi Binti Ishaq Angullia',
  'Nurfarah Amira bt Anwar',
  'Nurul Iqmalina binti Jamil',
  'Nurul Nadiah binti Muhammad',
  'Nuur Hafizah Bt Ramdan',
  'Sharmanshah bin Shahren',
  'Siranjeev Ram S/O S. Sanjeeviramah',
  'Siti Puteri Binti Mohd Suzaly',
  'Tulasi Maharani Dasi',
] as const;

export const EMPLOYEE_OPTIONS = EMPLOYEE_NAMES.map((name) => ({
  id: name,
  name,
}));

export function findEmployeeByName(
  employeeName: string,
) {
  const normalizedName = employeeName
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return EMPLOYEE_OPTIONS.find((employee) => {
    return (
      employee.name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase() === normalizedName
    );
  });
}
