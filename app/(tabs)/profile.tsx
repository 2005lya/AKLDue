import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createVehicle,
  deleteVehicle,
  fetchCouncilServices,
  fetchSavedCouncilProperty,
  fetchVehicles,
  saveCouncilProperty,
  saveRatesSubscription,
  searchCouncilAddresses,
  updateVehicle,

  type CouncilAddress,
  type CouncilService,
  type Vehicle,
} from '@/services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useDues } from '@/contexts/dues-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { formatDate, toDateText } from '@/utils/due-dates';

import {
  getReminderLeadDays,
  getRemindersEnabled,
  setReminderLeadDays,
  setRemindersEnabled,
  syncDueNotifications,
  type ReminderLeadDays,
} from '@/services/notifications';
const councilServiceIcons = {
  rubbish: 'trash-can-outline',
  foodScraps: 'food-apple-outline',
  recycling: 'recycle',
} as const;

export default function ProfileScreen() {
  const { dues, refreshDues } = useDues();
  const { accessToken, email, signOut } = useAuth();
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] =
    useState<CouncilAddress[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<CouncilAddress | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addressError, setAddressError] =
    useState<string | null>(null);

  const [councilServices, setCouncilServices] =
    useState<CouncilService[]>([]);

  const [selectedServiceTypes, setSelectedServiceTypes] =
    useState<CouncilService['type'][]>([]);

  const [ratesSubscribed, setRatesSubscribed] =
    useState(false);

  const [isLoadingServices, setIsLoadingServices] =
    useState(false);

  const [serviceError, setServiceError] =
    useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const saveInProgress = useRef(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] =
    useState(false);
  const [vehicleError, setVehicleError] =
    useState<string | null>(null);

  const [vehicleModalVisible, setVehicleModalVisible] =
    useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newRegoDate, setNewRegoDate] = useState(new Date());
  const [newWofDate, setNewWofDate] = useState(new Date());
  const [isSavingVehicle, setIsSavingVehicle] =
    useState(false);

  const [editingVehicleId, setEditingVehicleId] =
    useState<string | null>(null);

  const [includeRego, setIncludeRego] = useState(true);
  const [includeWof, setIncludeWof] = useState(true);
  const [reminderLeadDays, setReminderLeadDaysState] =
    useState<ReminderLeadDays>(1);
  const [remindersEnabled, setRemindersEnabledState] =
    useState(true);

  useEffect(() => {
    getReminderLeadDays()
      .then(setReminderLeadDaysState)
      .catch(() => {
        setReminderLeadDaysState(1);
      });

    getRemindersEnabled()
      .then(setRemindersEnabledState)
      .catch(() => {
        setRemindersEnabledState(true);
      });
  }, []);

  useEffect(() => {
    if (accessToken === null) {
      setVehicles([]);
      return;
    }

    let isActive = true;

    async function loadVehicles() {
      try {
        setIsLoadingVehicles(true);
        setVehicleError(null);

        const results = await fetchVehicles();

        if (isActive) {
          setVehicles(results);
        }
      } catch {
        if (isActive) {
          setVehicleError('Could not load vehicles.');
        }
      } finally {
        if (isActive) {
          setIsLoadingVehicles(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (accessToken === null) {
      return;
    }

    let isActive = true;

    async function loadSavedProperty() {
      try {
        setIsLoadingServices(true);
        setServiceError(null);

        const property = await fetchSavedCouncilProperty();

        if (!isActive || property === null) {
          return;
        }

        setSelectedAddress({
          id: property.councilAddressId,
          address: property.address,
          propertyId: property.propertyId,
        });

        setAddressQuery(property.address);
        const availableServices = await fetchCouncilServices(
          property.councilAddressId
        );

        setCouncilServices(availableServices);
        setRatesSubscribed(property.ratesSubscribed);
        setSelectedServiceTypes(
          property.services.map((service) => service.type)
        );
      } catch {
        if (isActive) {
          setServiceError(
            'Could not load your saved Council services.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingServices(false);
        }
      }
    }

    loadSavedProperty();

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  useEffect(() => {
    const query = addressQuery.trim();

    if (selectedAddress?.address === query) {
      setSuggestions([]);
      return;
    }

    if (query.length < 3) {
      setSuggestions([]);
      setAddressError(null);
      setIsSearching(false);
      return;
    }

    let isActive = true;

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        setAddressError(null);

        const results = await searchCouncilAddresses(query);

        if (isActive) {
          setSuggestions(results);
        }
      } catch {
        if (isActive) {
          setSuggestions([]);
          setAddressError('Address search is unavailable.');
        }
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [addressQuery, selectedAddress]);


  async function handleSelectAddress(address: CouncilAddress) {
    setSelectedAddress(address);
    setAddressQuery(address.address);
    setSuggestions([]);
    setCouncilServices([]);
    setSelectedServiceTypes([]);
    setRatesSubscribed(false);
    setServiceError(null);

    try {
      setIsLoadingServices(true);

      const services = await fetchCouncilServices(address.id);

      setCouncilServices(services);
    } catch {
      setServiceError('Collection services are unavailable.');
    } finally {
      setIsLoadingServices(false);
    }
  }

  async function toggleService(
    type: CouncilService['type']
  ) {
    if (
      selectedAddress === null ||
      saveInProgress.current
    ) {
      return;
    }

    saveInProgress.current = true;

    const previousTypes = selectedServiceTypes;

    const nextTypes = previousTypes.includes(type)
      ? previousTypes.filter((item) => item !== type)
      : [...previousTypes, type];

    // 先更新界面，让勾选立即响应。
    setSelectedServiceTypes(nextTypes);
    setIsSaving(true);
    setServiceError(null);

    try {
      await saveCouncilProperty({
        councilAddressId: selectedAddress.id,
        address: selectedAddress.address,
        propertyId: selectedAddress.propertyId,
        serviceTypes: nextTypes,
        services: councilServices,
      });

      await refreshDues();
    } catch {
      // 保存失败时恢复之前的勾选状态。
      setSelectedServiceTypes(previousTypes);
      setServiceError('Could not update this subscription.');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  async function toggleRatesSubscription() {
    if (
      selectedAddress === null ||
      saveInProgress.current
    ) {
      return;
    }

    saveInProgress.current = true;

    const previousValue = ratesSubscribed;
    const nextValue = !previousValue;

    setRatesSubscribed(nextValue);
    setIsSaving(true);
    setServiceError(null);

    try {
      const result = await saveRatesSubscription({
        councilAddressId: selectedAddress.id,
        address: selectedAddress.address,
        propertyId: selectedAddress.propertyId,
        subscribed: nextValue,
      });

      setRatesSubscribed(result.ratesSubscribed);
      await refreshDues();
    } catch (error) {
      setRatesSubscribed(previousValue);
      setServiceError(
        error instanceof Error
          ? error.message
          : 'Could not update the rates subscription.'
      );
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }


  async function handleSaveVehicle() {
    if (newVehiclePlate.trim() === '') {
      Alert.alert('Enter a plate number.');
      return;
    }
    if (!includeRego && !includeWof) {
      Alert.alert(
        'Choose a service',
        'Select Rego, WoF, or both.'
      );
      return;
    }

    try {
      setIsSavingVehicle(true);
      setVehicleError(null);

      const input = {
        plate: newVehiclePlate,
        regoExpiryDate: includeRego
          ? toDateText(newRegoDate)
          : null,
        wofExpiryDate: includeWof
          ? toDateText(newWofDate)
          : null,
      };

      const vehicle =
        editingVehicleId === null
          ? await createVehicle(input)
          : await updateVehicle(editingVehicleId, input);

      setVehicles((current) => {
        const next =
          editingVehicleId === null
            ? [...current, vehicle]
            : current.map((item) =>
              item.id === vehicle.id ? vehicle : item
            );

        return next.sort((a, b) =>
          a.plate.localeCompare(b.plate)
        );
      });

      await refreshDues();
      setVehicleModalVisible(false);
    } catch (error) {
      setVehicleError(
        error instanceof Error
          ? error.message
          : 'Could not add vehicle.'
      );
    } finally {
      setIsSavingVehicle(false);
    }
  }

  function handleDeleteVehicle() {
    if (editingVehicleId === null) {
      return;
    }

    Alert.alert(
      'Delete vehicle',
      'This will remove its Rego and WoF dues.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSavingVehicle(true);
              setVehicleError(null);

              await deleteVehicle(editingVehicleId);

              setVehicles((current) =>
                current.filter(
                  (vehicle) =>
                    vehicle.id !== editingVehicleId
                )
              );

              await refreshDues();
              setVehicleModalVisible(false);
              setEditingVehicleId(null);
            } catch {
              setVehicleError('Could not delete vehicle.');
            } finally {
              setIsSavingVehicle(false);
            }
          },
        },
      ]
    );
  }

  async function handleReminderLeadDays(
    days: ReminderLeadDays
  ) {
    const previous = reminderLeadDays;

    setReminderLeadDaysState(days);

    try {
      await setReminderLeadDays(days);
      await syncDueNotifications(dues);
    } catch {
      setReminderLeadDaysState(previous);

      Alert.alert(
        'Could not save reminder setting',
        'Please try again.'
      );
    }
  }

  async function handleRemindersEnabled(
    enabled: boolean
  ) {
    const previous = remindersEnabled;

    setRemindersEnabledState(enabled);

    try {
      await setRemindersEnabled(enabled);
      await syncDueNotifications(dues);
    } catch {
      setRemindersEnabledState(previous);

      Alert.alert(
        'Could not update notifications',
        'Please try again.'
      );
    }
  }

  function openVehicleModal(vehicle?: Vehicle) {
    if (vehicle === undefined) {
      setEditingVehicleId(null);
      setNewVehiclePlate('');
      setNewRegoDate(new Date());
      setNewWofDate(new Date());
      setIncludeRego(true);
      setIncludeWof(true);
    } else {
      setEditingVehicleId(vehicle.id);
      setNewVehiclePlate(vehicle.plate);
      setIncludeRego(vehicle.regoExpiryDate !== null);
      setIncludeWof(vehicle.wofExpiryDate !== null);

      setNewRegoDate(
        vehicle.regoExpiryDate !== null
          ? new Date(`${vehicle.regoExpiryDate}T00:00:00`)
          : new Date()
      );

      setNewWofDate(
        vehicle.wofExpiryDate !== null
          ? new Date(`${vehicle.wofExpiryDate}T00:00:00`)
          : new Date()
      );
    }

    setVehicleModalVisible(true);
  }


  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch {
              Alert.alert(
                'Could not sign out',
                'Please try again.'
              );
            }
          },
        },
      ]
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Profile</Text>

        <Text style={styles.sectionTitle}>Services</Text>

        <View style={styles.group}>
          <View style={styles.councilSection}>
            <Text style={styles.rowTitle}>Auckland Council</Text>

            <Text style={styles.rowMeta}>
              {selectedAddress?.address ?? 'Enter your property address'}
            </Text>

            <TextInput
              autoCorrect={false}
              placeholder="Search address"
              style={styles.addressInput}
              value={addressQuery}
              onChangeText={(value) => {
                setAddressQuery(value);
                setSelectedAddress(null);
                setCouncilServices([]);
                setSelectedServiceTypes([]);
                setRatesSubscribed(false);
              }}
            />

            {isSearching && (
              <ActivityIndicator style={styles.searching} />
            )}

            {addressError !== null && (
              <Text style={styles.addressError}>{addressError}</Text>
            )}

            {suggestions.map((address) => (
              <Pressable
                key={address.id}
                onPress={() => handleSelectAddress(address)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionText}>
                  {address.address}
                </Text>
              </Pressable>
            ))}


            {isLoadingServices && (
              <ActivityIndicator style={styles.searching} />
            )}

            {serviceError !== null && (
              <Text style={styles.addressError}>{serviceError}</Text>
            )}

            {councilServices.map((service) => {
              const selected = selectedServiceTypes.includes(service.type);

              return (
                <Pressable
                  key={service.type}
                  disabled={isSaving}
                  onPress={() => toggleService(service.type)}
                  style={styles.serviceRow}
                >
                  <View style={styles.checkbox}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>

                  <View style={styles.serviceDetails}>
                    <View style={styles.serviceTitleRow}>
                      <MaterialCommunityIcons
                        name={councilServiceIcons[service.type]}
                        size={18}
                        color="#64748b"
                      />

                      <Text style={styles.serviceTitle}>
                        {service.title}
                      </Text>
                    </View>

                    <Text style={styles.rowMeta}>
                      Next due: {service.dueDate}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {selectedAddress !== null && (
              <Pressable
                disabled={isSaving}
                onPress={toggleRatesSubscription}
                style={styles.serviceRow}
              >
                <View style={styles.checkbox}>
                  {ratesSubscribed && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.serviceDetails}>
                <View style={styles.serviceTitleRow}>

                  
                    <MaterialCommunityIcons
                      name="greenhouse"
                      size={18}
                      color="#64748b"
                    />
                    <Text style={styles.rowTitle}>
                      Property rates
                    </Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    Four instalments each rating year
                  </Text>
                </View>
              </Pressable>
            )}

            {isSaving && (
              <ActivityIndicator style={styles.searching} />
            )}

          </View>



          <View style={styles.vehicleSection}>
            <View style={styles.vehicleHeader}>
              <Text style={styles.rowTitle}>Vehicles</Text>

              <Pressable
                accessibilityLabel="Add vehicle"
                onPress={() => openVehicleModal()}
              >
                <Text style={styles.addVehicleIcon}>＋</Text>
              </Pressable>
            </View>

            {isLoadingVehicles && (
              <ActivityIndicator style={styles.searching} />
            )}

            {vehicleError !== null && (
              <Text style={styles.addressError}>{vehicleError}</Text>
            )}

            {!isLoadingVehicles && vehicles.length === 0 && (
              <Text style={styles.rowMeta}>No vehicles</Text>
            )}

            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                onPress={() => openVehicleModal(vehicle)}
                style={({ pressed }) => [
                  styles.vehicleItem,
                  pressed && styles.vehicleItemPressed,
                ]}
              >
                <View style={styles.vehiclePlateRow}>
  <MaterialCommunityIcons
    name="car-outline"
    size={20}
    color="#64748b"
  />

  <Text style={styles.vehiclePlate}>
    {vehicle.plate}
  </Text>
</View>

                <View style={styles.vehicleServices}>
                  {vehicle.regoExpiryDate !== null && (
                    <View style={styles.vehicleServiceRow}>
                      <Text style={styles.vehicleServiceTitle}>
                        Rego
                      </Text>

                      <Text style={styles.vehicleDateValue}>
                        {formatDate(vehicle.regoExpiryDate)}
                      </Text>
                    </View>
                  )}

                  {vehicle.wofExpiryDate !== null && (
                    <View style={styles.vehicleServiceRow}>
                      <Text style={styles.vehicleServiceTitle}>
                        WoF
                      </Text>

                      <Text style={styles.vehicleDateValue}>
                        {formatDate(vehicle.wofExpiryDate)}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.group}>
          <View style={styles.notificationSection}>
            <View style={styles.notificationToggleRow}>
              <View>
                <Text style={styles.rowTitle}>Due reminders</Text>
                <Text style={styles.rowMeta}>
                  Receive local notifications
                </Text>
              </View>

              <Switch
                value={remindersEnabled}
                onValueChange={handleRemindersEnabled}
                trackColor={{
                  false: '#cbd5e1',
                  true: '#64748b',
                }}
                thumbColor="#ffffff"
              />
            </View>


            <Text style={styles.rowTitle}>Remind me before</Text>

            <View style={[
              styles.segmentedControl,
              !remindersEnabled && styles.controlDisabled,
            ]}>
              {[
                { label: '1 day', value: 1 },
                { label: '3 days', value: 3 },
                { label: '1 week', value: 7 },
              ].map((option) => {
                const selected =
                  reminderLeadDays === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      handleReminderLeadDays(
                        option.value as ReminderLeadDays
                      )
                    }
                    style={[
                      styles.segment,
                      selected && styles.segmentSelected,
                    ]}
                    disabled={!remindersEnabled}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && styles.segmentTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>



        <View style={styles.group}>
          <View style={styles.accountInfo}>

            <Text style={styles.accountEmail}>
              {email ?? 'Signed in'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={vehicleModalVisible}
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingVehicleId === null
                ? 'Add vehicle'
                : 'Edit vehicle'}
            </Text>

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Plate number"
              style={styles.addressInput}
              value={newVehiclePlate}
              onChangeText={setNewVehiclePlate}
            />

            <Text style={styles.dateLabel}>Rego expiry</Text>

            <DateTimePicker
              minimumDate={new Date()}
              mode="date"
              value={newRegoDate}
              onChange={(_, date) => {
                if (date !== undefined) {
                  setNewRegoDate(date);
                }
              }}
            />

            <Text style={styles.dateLabel}>WoF expiry</Text>

            <DateTimePicker
              minimumDate={new Date()}
              mode="date"
              value={newWofDate}
              onChange={(_, date) => {
                if (date !== undefined) {
                  setNewWofDate(date);
                }
              }}
            />

            <View style={styles.modalActions}>
              {editingVehicleId !== null && (
                <Pressable
                  disabled={isSavingVehicle}
                  onPress={handleDeleteVehicle}
                  style={styles.deleteVehicleButton}
                >
                  <Text style={styles.deleteVehicleText}>Delete</Text>
                </Pressable>
              )}

              <Pressable
                disabled={isSavingVehicle}
                onPress={() => setVehicleModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isSavingVehicle}
                onPress={handleSaveVehicle}
                style={styles.confirmButton}
              >
                {isSavingVehicle ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {editingVehicleId === null ? 'Add' : 'Save'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
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
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    marginBottom: 10,
  },
  group: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 14,
    color: '#64748b',
  },
  chevron: {
    fontSize: 20,
    color: '#94a3b8',
  },

  councilSection: {
    padding: 16,
  },
  addressInput: {
    minHeight: 48,
    marginTop: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    fontSize: 16,
  },
  searching: {
    marginTop: 12,
  },
  suggestion: {
    minHeight: 52,
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 15,
    color: '#0f172a',
  },

  addressError: {
    marginTop: 10,
    color: '#b91c1c',
  },
  serviceRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  serviceDetails: {
    marginLeft: 12,
  },
  vehicleSection: {
    padding: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addVehicleIcon: {
    fontSize: 28,
    color: '#0f172a',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  dateLabel: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  modalActions: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    minWidth: 90,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  deleteVehicleButton: {
    minHeight: 46,
    marginRight: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteVehicleText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  expiryOption: {
    minHeight: 52,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryOptionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  notificationSection: {
    padding: 16,
  },
  segmentedControl: {
    marginTop: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: '#0f172a',
  },
  segmentText: {
    fontSize: 14,
    color: '#475569',
  },
  segmentTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  notificationToggleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlDisabled: {
    opacity: 0.45,
  },
  vehicleItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  vehicleServices: {
    marginTop: 8,
    gap: 8,
  },
  vehicleServiceRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleServiceTitle: {
    fontSize: 15,
    color: '#475569',
  },
  vehicleDateValue: {
    fontSize: 14,
    color: '#0f172a',
  },
  accountInfo: {
    padding: 16,
  },
  accountEmail: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  signOutButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b91c1c',
  },
  vehicleItemPressed: {
    backgroundColor: '#f1f5f9',
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  vehiclePlateRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
vehiclePlate: {
  marginLeft: 8,
  fontSize: 16,
  fontWeight: '600',
  color: '#0f172a',
},
});
