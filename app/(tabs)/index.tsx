
import type { Due, RepeatUnit } from '@/contexts/dues-context';
import { useDues } from '@/contexts/dues-context';
import {
  createDue,
  deleteDue,
  deleteDueOccurrence,
  unsubscribeDue,
  updateDue,
} from '@/services/api';
import {
  calculateDaysLeft,
  formatDate,
  formatRepeat,
  getNextDueDate,
  getToday,
  parseDate,
  toDateText,
} from '@/utils/due-dates';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';



type UpcomingDue = Due & {
  nextDueDate: string;
};
const repeatOptions: {
  label: string;
  value: RepeatUnit;
}[] = [
  { label: 'Never', value: 'none' },
  { label: 'Weekly', value: 'week' },
  { label: 'Fortnightly', value: 'fortnight' },
  { label: 'Monthly', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Yearly', value: 'year' },
];


export default function HomeScreen() {
  const {
  dues,
  setDues,
  isLoading,
  error,
  refreshDues,
} = useDues();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingDueId, setEditingDueId] = useState<string | null>(null);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>('none');
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const upcomingDues = dues
    .map((due) => ({
      ...due,
      nextDueDate: getNextDueDate(due),
    }))
    .filter(
      (due): due is UpcomingDue =>
        due.nextDueDate !== null
    )
    .sort((first, second) =>
      first.nextDueDate.localeCompare(second.nextDueDate)
    );

  function handleAddDue() {
    setEditingDueId(null);
    setTitle('');
    setDueDate(toDateText(getToday()));
    setIsFormVisible(true);
    setRepeatUnit('none');
  }

  function handleUnsubscribeDue(due: UpcomingDue) {
  Alert.alert(
    'Unsubscribe',
    `Stop receiving "${due.title}" reminders?`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Unsubscribe',
        style: 'destructive',
        onPress: async () => {
          try {
            await unsubscribeDue(due);
            await refreshDues();
          } catch {
            Alert.alert(
              'Could not unsubscribe',
              'Please check the server and try again.'
            );
          }
        },
      },
    ]
  );
}

  function handleDateChange(
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (Platform.OS === 'android') {
      setShowAndroidDatePicker(false);
    }

    if (event.type === 'dismissed' || selectedDate === undefined) {
      return;
    }

    setDueDate(toDateText(selectedDate));
  }

  function handleEditDue(due: Due) {
    if (due.source !== 'Personal') {
      return;
    }

    setEditingDueId(due.id);
    setTitle(due.title);
    setDueDate(due.dueDate);
    setIsFormVisible(true);
    setRepeatUnit(due.repeatUnit);
  }

  function handleDeleteDue(due: UpcomingDue) {
    async function deleteEntireSeries() {
  try {
    await deleteDue(due.id);

    setDues((currentDues) =>
      currentDues.filter((item) => item.id !== due.id)
    );
  } catch {
    Alert.alert(
      'Could not delete due',
      'Please check the server and try again.'
    );
  }
}

    if (due.repeatUnit === 'none') {
      Alert.alert(
        'Delete due',
        `Delete "${due.title}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: deleteEntireSeries,
          },
        ]
      );

      return;
    }

    async function deleteCurrentOccurrence() {
  try {
    await deleteDueOccurrence(
      due.id,
      due.nextDueDate
    );

    setDues((currentDues) =>
      currentDues.map((item) => {
        if (item.id !== due.id) {
          return item;
        }

        if (item.excludedDates.includes(due.nextDueDate)) {
          return item;
        }

        return {
          ...item,
          excludedDates: [
            ...item.excludedDates,
            due.nextDueDate,
          ],
        };
      })
    );
  } catch {
    Alert.alert(
      'Could not delete occurrence',
      'Please check the server and try again.'
    );
  }
}

    Alert.alert(
      'Delete repeating due',
      `Choose what to delete for "${due.title}".`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'This occurrence',
          onPress: deleteCurrentOccurrence,
        },
        {
          text: 'Entire series',
          style: 'destructive',
          onPress: deleteEntireSeries,
        },
      ]
    );
  }

  function formatDaysLeft(dateText: string) {
  const daysLeft = calculateDaysLeft(dateText);

  if (daysLeft === 0) {
    return 'Today';
  }

  if (daysLeft === 1) {
    return 'Tomorrow';
  }

  return `${daysLeft} days left`;
}

  function handleCloseForm() {
    setEditingDueId(null);
    setTitle('');
    setDueDate('');
    setIsFormVisible(false);
    setRepeatUnit('none');
  }

  async function handleSaveDue() {
    const cleanTitle = title.trim();
    const parsedDate = parseDate(dueDate);

    if (!cleanTitle) {
      Alert.alert('Missing title', 'Please enter a due title.');
      return;
    }

    if (parsedDate === null) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD.');
      return;
    }

    if (calculateDaysLeft(dueDate) < 0) {
      Alert.alert('Expired date', 'Please choose today or a future date.');
      return;
    }
    if (editingDueId !== null) {
  try {
    setIsSaving(true);

    const updatedDue = await updateDue(editingDueId, {
      title: cleanTitle,
      dueDate,
      repeatUnit,
    });

    setDues((currentDues) =>
      currentDues.map((existingDue) => {
        if (existingDue.id !== editingDueId) {
          return existingDue;
        }

        const recurrenceChanged =
          existingDue.dueDate !== updatedDue.dueDate ||
          existingDue.repeatUnit !== updatedDue.repeatUnit;

        return {
          ...updatedDue,
          excludedDates: recurrenceChanged
            ? []
            : existingDue.excludedDates,
        };
      })
    );

    handleCloseForm();
  } catch {
    Alert.alert(
      'Could not update due',
      'Please check the server and try again.'
    );
  } finally {
    setIsSaving(false);
  }

  return;
}

    try {
      setIsSaving(true);

      const newDue = await createDue({
        title: cleanTitle,
        dueDate,
        repeatUnit,
      });

      setDues((currentDues) => [...currentDues, newDue]);
      handleCloseForm();
    } catch {
      Alert.alert(
        'Could not save due',
        'Please check the server and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appName}>AKLDue</Text>

          <Pressable
            accessibilityLabel="Add due"
            onPress={handleAddDue}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Upcoming dues</Text>
        {isLoading && (
          <Text style={styles.statusText}>Loading dues...</Text>
        )}

        {error !== null && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {upcomingDues.map((due) => {
          const card = (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{due.title}</Text>

                <Text style={styles.daysLeft}>
                  {formatDaysLeft(due.nextDueDate)}
                </Text>
              </View>

              <Text style={styles.source}>{due.source}</Text>
              <Text style={styles.dueDate}>
                {formatDate(due.nextDueDate)}
              </Text>
              {formatRepeat(due.repeatUnit) && (
                <Text style={styles.repeatText}>
                  {formatRepeat(due.repeatUnit)}
                </Text>
              )}
            </View>
          );

          if (due.source !== 'Personal') {
  if (due.subscriptionType === null) {
    return (
      <View key={due.id} style={styles.swipeRow}>
        {card}
      </View>
    );
  }

  return (
    <Swipeable
      key={due.id}
      containerStyle={styles.swipeRow}
      overshootRight={false}
      renderRightActions={(
        _progress,
        _translation,
        methods
      ) => (
        <Pressable
          accessibilityLabel={`Unsubscribe ${due.title}`}
          onPress={() => {
            methods.close();
            handleUnsubscribeDue(due);
          }}
          style={styles.unsubscribeAction}
        >
          <Text style={styles.unsubscribeActionText}>
            Unsubscribe
          </Text>
        </Pressable>
      )}
    >
      {card}
    </Swipeable>
  );
}

          return (
            <Swipeable
              key={due.id}
              containerStyle={styles.swipeRow}
              overshootRight={false}
              renderRightActions={(_progress, _translation, methods) => (
                <View style={styles.swipeActions}>
                  <Pressable
                    accessibilityLabel={`Edit ${due.title}`}
                    onPress={() => {
                      methods.close();
                      handleEditDue(due);
                    }}
                    style={styles.editAction}
                  >
                    <Text style={styles.editActionText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Delete ${due.title}`}
                    onPress={() => {
                      methods.close();
                      handleDeleteDue(due);
                    }}
                    style={styles.deleteAction}
                  >
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            >
              {card}
            </Swipeable>
          );
        })}
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={isFormVisible}
        onRequestClose={handleCloseForm}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Pressable onPress={handleCloseForm}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Text style={styles.modalTitle}>
                {editingDueId === null ? 'Add Due' : 'Edit Due'}
              </Text>

             <Pressable
  disabled={isSaving}
  onPress={handleSaveDue}
>
  <Text style={styles.saveText}>
    {isSaving ? 'Saving...' : 'Save'}
  </Text>
</Pressable>
            </View>

            <Text style={styles.label}>Title</Text>

            <TextInput
              autoFocus
              placeholder="Enter due title"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Due date</Text>

            {Platform.OS === 'ios' ? (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={parseDate(dueDate) ?? getToday()}
                  mode="date"
                  display="compact"
                  minimumDate={getToday()}
                  onChange={handleDateChange}
                />
              </View>
            ) : (
              <>
                <Pressable
                  style={styles.datePickerContainer}
                  onPress={() => setShowAndroidDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>
                    {formatDate(dueDate)}
                  </Text>
                </Pressable>

                {showAndroidDatePicker && (
                  <DateTimePicker
                    value={parseDate(dueDate) ?? getToday()}
                    mode="date"
                    minimumDate={getToday()}
                    onChange={handleDateChange}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Repeat</Text>

            <View style={styles.repeatControl}>
              {repeatOptions.map((option) => {
                const isSelected = repeatUnit === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setRepeatUnit(option.value)}
                    style={[
                      styles.repeatOption,
                      isSelected && styles.repeatOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.repeatOptionText,
                        isSelected && styles.repeatOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 34,
    fontWeight: '300',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  daysLeft: {
    fontSize: 14,
    color: '#64748b',
  },
  source: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
  },
  dueDate: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalContainer: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  cancelText: {
    fontSize: 16,
    color: '#64748b',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 20,
  },
  swipeRow: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  deleteAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#b91c1c',
  },
  swipeActions: {
    flexDirection: 'row',
  },
  editAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  editActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  repeatText: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
  },
  repeatControl: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  borderWidth: 1,
  borderColor: '#dbe1e8',
  borderRadius: 8,
  overflow: 'hidden',
},
repeatOption: {
  width: '33.3333%',
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#ffffff',
},
  repeatOptionSelected: {
    backgroundColor: '#0f172a',
  },
  repeatOptionText: {
    fontSize: 13,
    color: '#475569',
  },
  repeatOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  datePickerContainer: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  datePickerText: {
    fontSize: 16,
    color: '#0f172a',
  },
  statusText: {
    color: '#64748b',
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    marginBottom: 12,
  },
  unsubscribeAction: {
  width: 112,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff1f2',
},
unsubscribeActionText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#b91c1c',
},
});