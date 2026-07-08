import type { Due, RepeatUnit } from '@/contexts/dues-context';

export type DueOccurrence = {
  id: string;
  seriesId: string;
  title: string;
  source: string;
  dueDate: string;
  repeatUnit: RepeatUnit;
};

export function parseDate(dateText: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function getToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  return today;
}

export function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDate(dateText: string) {
  const [year, month, day] = dateText.split('-');

  return `${day}/${month}/${year}`;
}

export function calculateDaysLeft(dateText: string) {
  const due = parseDate(dateText);

  if (due === null) {
    return -1;
  }

  const milliseconds = due.getTime() - getToday().getTime();
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.ceil(milliseconds / millisecondsPerDay);
}

export function formatRepeat(repeatUnit: RepeatUnit) {
  switch (repeatUnit) {
    case 'week':
      return 'Repeats weekly';
    case 'month':
      return 'Repeats monthly';
      case 'fortnight':
  return 'Repeats every 2 weeks';
case 'quarter':
  return 'Repeats quarterly';
    case 'year':
      return 'Repeats yearly';
    default:
      return null;
  }
}

function createOccurrenceDate(
  startDate: Date,
  repeatUnit: RepeatUnit,
  occurrenceNumber: number
) {
  if (
  repeatUnit === 'week' ||
  repeatUnit === 'fortnight'
) {
  const result = new Date(startDate);
  const weeks = repeatUnit === 'fortnight' ? 2 : 1;

  result.setDate(
    startDate.getDate() +
      occurrenceNumber * weeks * 7
  );

  return result;
}

 if (
  repeatUnit === 'month' ||
  repeatUnit === 'quarter'
) {
  const monthInterval =
    repeatUnit === 'quarter' ? 3 : 1;

  const result = new Date(
    startDate.getFullYear(),
    startDate.getMonth() +
      occurrenceNumber * monthInterval,
    1
  );

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(
    Math.min(startDate.getDate(), lastDay)
  );

  return result;
}

  

  if (repeatUnit === 'year') {
    const targetYear = startDate.getFullYear() + occurrenceNumber;
    const targetMonth = startDate.getMonth();

    const lastDay = new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate();

    return new Date(
      targetYear,
      targetMonth,
      Math.min(startDate.getDate(), lastDay)
    );
  }

  return new Date(startDate);
}

export function getNextDueDate(due: Due) {
  const startDate = parseDate(due.dueDate);

  if (startDate === null) {
    return null;
  }

  const today = getToday();

  if (due.repeatUnit === 'none') {
    return startDate >= today ? due.dueDate : null;
  }

  let occurrenceNumber = 0;
  let occurrenceDate = startDate;

 while (
  occurrenceDate < today ||
  due.excludedDates.includes(toDateText(occurrenceDate))
) {
    occurrenceNumber += 1;
    occurrenceDate = createOccurrenceDate(
      startDate,
      due.repeatUnit,
      occurrenceNumber
    );
  }

  return toDateText(occurrenceDate);
}

export function generateDueOccurrences(
  due: Due,
  endDate: Date
): DueOccurrence[] {
  const startDate = parseDate(due.dueDate);

  if (startDate === null) {
    return [];
  }

  if (due.repeatUnit === 'none') {
  if (due.excludedDates.includes(due.dueDate)) {
    return [];
  }

  return [
    {
      ...due,
      id: `${due.id}:${due.dueDate}`,
      seriesId: due.id,
    },
  ];
}

  const occurrences: DueOccurrence[] = [];
  let occurrenceNumber = 0;

  while (occurrenceNumber < 2000) {
    const occurrenceDate = createOccurrenceDate(
      startDate,
      due.repeatUnit,
      occurrenceNumber
    );

    if (occurrenceDate > endDate && occurrenceNumber > 0) {
      break;
    }

    const dateText = toDateText(occurrenceDate);

    if (!due.excludedDates.includes(dateText)) {
  occurrences.push({
    ...due,
    id: `${due.id}:${dateText}`,
    seriesId: due.id,
    dueDate: dateText,
  });
}

    occurrenceNumber += 1;
  }

  return occurrences;
}