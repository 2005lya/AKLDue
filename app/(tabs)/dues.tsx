import { useDues } from '@/contexts/dues-context';
import {
  formatDate,
  generateDueOccurrences,
  getToday,
  toDateText,
} from '@/utils/due-dates';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

type CalendarMark = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
};


export default function DuesScreen() {
  const { dues } = useDues();
  const [selectedDate, setSelectedDate] = useState(
    toDateText(getToday())
  );

  const occurrenceEndDate = useMemo(() => {
    const endDate = getToday();

    endDate.setFullYear(endDate.getFullYear() + 5);
    return endDate;
  }, []);

  const occurrences = useMemo(
    () =>
      dues.flatMap((due) =>
        generateDueOccurrences(due, occurrenceEndDate)
      ),
    [dues, occurrenceEndDate]
  );

  const markedDates = occurrences.reduce<Record<string, CalendarMark>>(
  (marks, occurrence) => {
    marks[occurrence.dueDate] = {
      ...marks[occurrence.dueDate],
      marked: true,
      dotColor: '#0f172a',
    };

    return marks;
  },
  {}
);

  markedDates[selectedDate] = {
    ...markedDates[selectedDate],
    selected: true,
    selectedColor: '#0f172a',
    selectedTextColor: '#ffffff',
  };

  const selectedDues = occurrences.filter(
    (occurrence) => occurrence.dueDate === selectedDate
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Dues</Text>
        <Text style={styles.summary}>
          {occurrences.length} occurrences
        </Text>
        <Calendar
          current={selectedDate}
          firstDay={1}
          enableSwipeMonths
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          style={styles.calendar}
          theme={{
            calendarBackground: '#ffffff',
            backgroundColor: '#ffffff',
            monthTextColor: '#0f172a',
            dayTextColor: '#0f172a',
            textDisabledColor: '#cbd5e1',
            textSectionTitleColor: '#64748b',
            todayTextColor: '#0f172a',
            arrowColor: '#0f172a',
            dotColor: '#0f172a',
            selectedDayBackgroundColor: '#0f172a',
            selectedDayTextColor: '#ffffff',
            textMonthFontSize: 18,
            textMonthFontWeight: '600',
            textDayFontSize: 15,
            textDayHeaderFontSize: 13,
          }}
        />

        <Text style={styles.selectedDate}>
          {formatDate(selectedDate)}
        </Text>

        {selectedDues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No dues on this date.</Text>
          </View>
        ) : (
          selectedDues.map((due) => (
            <View key={due.id} style={styles.dueCard}>
              <Text style={styles.dueTitle}>{due.title}</Text>
              <Text style={styles.dueSource}>{due.source}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  summary: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  calendar: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  selectedDate: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyState: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
  },
  dueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  dueTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  dueSource: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
  },
});