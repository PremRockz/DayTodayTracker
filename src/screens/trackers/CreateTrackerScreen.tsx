import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  X,
  Check,
  Target,
  Repeat,
  Receipt,
  CalendarCheck,
  PartyPopper,
  Landmark,
  Cake,
  ChevronDown,
  Calendar,
  Bell,
  Pencil,
  Wallet,
} from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { Button } from '../../components/Button';
import { generateId } from '../../utils/id';
import { getAll, upsertRecord, BaseRecord } from '../../services/localStore';
import { applyPriceChangeToAllLogs, monthKey } from '../../services/dailyLogs';
import { computeLoanInterestBreakdown, daysBetweenDates } from '../../services/loanInterest';
import { BirthdayMember, REMINDER_OFFSET_OPTIONS } from '../../services/birthdays';
import { TRACKER_ICONS } from '../../constants/trackerIcons';
import { DEFAULT_QUANTITY_OPTIONS } from '../../components/TrackerActionCard';
import { formatDate, formatTime } from '../../utils/date';
import { formatIndianNumber, formatAmountInput, stripAmountFormatting } from '../../utils/number';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

type TrackerKind = 'quantity' | 'bill' | 'booking' | 'event' | 'loan' | 'birthday' | 'allowance';
type ReminderRepeat = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Once';

interface TrackerData extends BaseRecord {
  name: string;
  iconId: string;
  color: string;
  kind: TrackerKind;
  unit: string;
  price: string;
  sellerName: string;
  sellerContact: string;
  paymentMethod: 'quantity' | 'monthly' | 'manual';
  monthlyPaymentDay: string;
  targetQuantity: string;
  quantityOptions: string[];
  status: string;
  startDate?: string;
  reminderDate?: string;
  reminderRepeat: ReminderRepeat;
  notes: string;
  loanAmount: string;
  bankName: string;
  collateralWeight: string;
  interestRate: string;
  disbursedDate?: string;
  members?: BirthdayMember[];
  entryMode: 'manual' | 'daily';
  monthlyLimit: string;
  allowanceCycleMonth?: string;
}

const KIND_OPTIONS: { id: TrackerKind; label: string; icon: typeof Repeat }[] = [
  { id: 'quantity', label: 'Recurring', icon: Repeat },
  { id: 'bill', label: 'Bill', icon: Receipt },
  { id: 'booking', label: 'Booking', icon: CalendarCheck },
  { id: 'event', label: 'Event', icon: PartyPopper },
  { id: 'loan', label: 'Loan', icon: Landmark },
  { id: 'birthday', label: 'Birthday', icon: Cake },
  { id: 'allowance', label: 'Allowance', icon: Wallet },
];

const REPEAT_OPTIONS: ReminderRepeat[] = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Once'];

// Only offer repeat frequencies that fit within the loan's tenure (Disbursed Date -> Due Date) —
// e.g. a 5-day loan shouldn't be able to pick a Monthly reminder that will never fire.
const repeatOptionsForTenure = (tenureDays: number | null): ReminderRepeat[] => {
  if (tenureDays === null) return REPEAT_OPTIONS;
  const options: ReminderRepeat[] = ['Daily'];
  if (tenureDays >= 7) options.push('Weekly');
  if (tenureDays >= 30) options.push('Monthly');
  if (tenureDays >= 365) options.push('Yearly');
  options.push('Once');
  return options;
};

const defaultRepeatForKind = (k: TrackerKind): ReminderRepeat => {
  if (k === 'bill') return 'Monthly';
  if (k === 'event' || k === 'birthday') return 'Yearly';
  if (k === 'booking') return 'Once';
  if (k === 'loan') return 'Once';
  return 'Daily';
};

const UNIT_OPTIONS = ['Liters', 'Kg', 'Grams', 'Pieces', 'Packets', 'Dozen', 'Bottles', 'Boxes'];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

const ordinalSuffix = (day: number): string => {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
};

const formatMonthlyPaymentDay = (day: string): string => {
  const value = parseInt(day, 10);
  if (Number.isNaN(value)) return '';
  return `${value}${ordinalSuffix(value)} of every month`;
};

const COLORS = [
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#F97316', // Orange
];

export const CreateTrackerScreen = ({ navigation, route }: any) => {
  const trackerId: string | undefined = route.params?.trackerId;
  const isEditMode = !!trackerId;

  const [existingTracker, setExistingTracker] = useState<TrackerData | null>(null);
  const [kind, setKind] = useState<TrackerKind>('quantity');
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('milk');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [unit, setUnit] = useState('Liters');
  const [price, setPrice] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [sellerContact, setSellerContact] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'quantity' | 'monthly' | 'manual'>('quantity');
  const [monthlyPaymentDay, setMonthlyPaymentDay] = useState('');
  const [entryMode, setEntryMode] = useState<'manual' | 'daily'>('manual');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [quantityOptions, setQuantityOptions] = useState<string[]>(DEFAULT_QUANTITY_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(isEditMode ? null : new Date());
  const [reminderDate, setReminderDate] = useState<Date | null>(() => {
    if (isEditMode) return null;
    const defaultReminder = new Date();
    defaultReminder.setHours(6, 0, 0, 0);
    return defaultReminder;
  });
  const [reminderRepeat, setReminderRepeat] = useState<ReminderRepeat>('Daily');
  const [notes, setNotes] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [collateralWeight, setCollateralWeight] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [disbursedDate, setDisbursedDate] = useState<Date | null>(null);
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [activeMemberDobIndex, setActiveMemberDobIndex] = useState<number | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showDisbursedPicker, setShowDisbursedPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showMonthlyDayPicker, setShowMonthlyDayPicker] = useState(false);
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const SelectedIcon = TRACKER_ICONS.find((i) => i.id === selectedIcon)?.component ?? TRACKER_ICONS[0].component;

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      { id: generateId(), name: '', dateOfBirth: '', reminderOffsetDays: REMINDER_OFFSET_OPTIONS[1].days },
    ]);
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, patch: Partial<BirthdayMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const openMemberDobPicker = (index: number) => {
    const member = members[index];
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: member.dateOfBirth ? new Date(member.dateOfBirth) : new Date(),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (_e: any, date?: Date) => { if (date) updateMember(member.id, { dateOfBirth: date.toISOString() }); },
      });
    } else {
      setActiveMemberDobIndex(index);
    }
  };

  const openUnitPicker = () => {
    setCustomUnitInput(UNIT_OPTIONS.includes(unit) ? '' : unit);
    setShowUnitPicker(true);
  };

  const openStartDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startDate ?? new Date(),
        mode: 'date',
        onChange: (_e: any, date?: Date) => { if (date) { setStartDate(date); clearError('startDate'); } },
      });
    } else {
      setShowStartPicker(true);
    }
  };

  const openReminderPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: reminderDate ?? new Date(),
        mode: 'time',
        onChange: (_e: any, time?: Date) => { if (time) setReminderDate(time); },
      });
    } else {
      setShowReminderPicker(true);
    }
  };

  const openDisbursedPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: disbursedDate ?? new Date(),
        mode: 'date',
        onChange: (_e: any, date?: Date) => { if (date) { setDisbursedDate(date); clearError('disbursedDate'); } },
      });
    } else {
      setShowDisbursedPicker(true);
    }
  };

  const loanBreakdown = computeLoanInterestBreakdown(loanAmount, interestRate, disbursedDate, startDate);
  const loanTenureDays = disbursedDate && startDate ? daysBetweenDates(disbursedDate, startDate) : null;
  const visibleRepeatOptions = kind === 'loan' ? repeatOptionsForTenure(loanTenureDays) : REPEAT_OPTIONS;

  // Keep the selected repeat frequency valid as the loan's tenure changes (e.g. shortening the
  // due date from 2 months to 3 days should drop a previously-picked "Monthly" back to "Daily").
  useEffect(() => {
    if (!visibleRepeatOptions.includes(reminderRepeat)) {
      setReminderRepeat('Daily');
    }
  }, [visibleRepeatOptions, reminderRepeat]);

  // Load the existing tracker (if editing) and prefill the form
  useEffect(() => {
    const loadExistingTracker = async () => {
      if (!trackerId) return;
      const all = await getAll<TrackerData>('trackers');
      const tracker = all.find((t) => t.id === trackerId) ?? null;
      setExistingTracker(tracker);
      if (tracker) {
        setKind(tracker.kind ?? 'quantity');
        setName(tracker.name);
        setSelectedIcon(tracker.iconId);
        setSelectedColor(tracker.color);
        setUnit(tracker.unit);
        setPrice(tracker.price);
        setSellerName(tracker.sellerName || '');
        setSellerContact(tracker.sellerContact || '');
        setPaymentMethod(tracker.paymentMethod ?? 'quantity');
        setMonthlyPaymentDay(tracker.monthlyPaymentDay || '');
        setEntryMode(tracker.entryMode ?? 'manual');
        setMonthlyLimit(tracker.monthlyLimit || '');
        setTargetQuantity(tracker.targetQuantity || '');
        setQuantityOptions(
          tracker.quantityOptions?.length === 3 ? tracker.quantityOptions : DEFAULT_QUANTITY_OPTIONS
        );
        setStartDate(tracker.startDate ? new Date(tracker.startDate) : null);
        setReminderDate(tracker.reminderDate ? new Date(tracker.reminderDate) : null);
        setReminderRepeat(tracker.reminderRepeat ?? defaultRepeatForKind(tracker.kind ?? 'quantity'));
        setNotes(tracker.notes || '');
        setLoanAmount(tracker.loanAmount || '');
        setBankName(tracker.bankName || '');
        setCollateralWeight(tracker.collateralWeight || '');
        setInterestRate(tracker.interestRate || '');
        setDisbursedDate(tracker.disbursedDate ? new Date(tracker.disbursedDate) : null);
        setMembers(tracker.members?.length ? tracker.members : []);
      }
    };
    loadExistingTracker();
  }, [trackerId]);

  const persistTracker = async (applyPriceToHistory: boolean) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const record: TrackerData = {
        id: existingTracker?.id ?? generateId(),
        name,
        iconId: selectedIcon,
        color: selectedColor,
        kind,
        unit,
        price: kind === 'loan' ? loanBreakdown.totalPayable.toFixed(2) : price,
        sellerName,
        sellerContact,
        paymentMethod,
        monthlyPaymentDay,
        entryMode,
        monthlyLimit,
        allowanceCycleMonth: existingTracker?.allowanceCycleMonth ?? monthKey(),
        targetQuantity,
        quantityOptions,
        status: existingTracker?.status ?? 'Active',
        createdAt: existingTracker?.createdAt ?? now,
        updatedAt: now,
        startDate: startDate?.toISOString(),
        reminderDate: reminderDate?.toISOString(),
        reminderRepeat,
        notes,
        loanAmount,
        bankName,
        collateralWeight,
        interestRate,
        disbursedDate: disbursedDate?.toISOString(),
        members: kind === 'birthday' ? members.filter((m) => m.name.trim() && m.dateOfBirth) : undefined,
      };

      await upsertRecord('trackers', record);
      if (applyPriceToHistory) {
        await applyPriceChangeToAllLogs(record.id, kind, parseFloat(price) || 0);
      }
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save tracker', e);
    } finally {
      setLoading(false);
    }
  };

  const isPositiveNumber = (value: string): boolean => !!value.trim() && !Number.isNaN(parseFloat(value)) && parseFloat(value) > 0;

  // Quick Purchase Options default to quarter / half / full of the target quantity,
  // but stay editable since the user may want different preset amounts.
  const quickPurchaseOptionsForTarget = (target: number): string[] =>
    [target / 4, target / 2, target].map((value) => parseFloat(value.toFixed(2)).toString());

  const handleTargetQuantityChange = (value: string) => {
    setTargetQuantity(value);
    clearError('targetQuantity');
    if (isPositiveNumber(value)) {
      setQuantityOptions(quickPurchaseOptionsForTarget(parseFloat(value)));
    }
  };

  const updateQuantityOption = (index: number, value: string) => {
    setQuantityOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) nextErrors.name = 'Tracker name is required';

    if (kind === 'quantity') {
      if (!isPositiveNumber(price)) nextErrors.price = `Enter a valid price per ${unit}`;
      if (paymentMethod === 'quantity' && !isPositiveNumber(targetQuantity)) {
        nextErrors.targetQuantity = 'Enter a target quantity';
      }
      if (paymentMethod === 'monthly' && !monthlyPaymentDay) {
        nextErrors.monthlyPaymentDay = 'Select the day of the month to pay on';
      }
      if (paymentMethod !== 'manual' && !startDate) {
        nextErrors.startDate = 'Select the tracker start date';
      }
    }

    if (kind === 'bill' && !isPositiveNumber(price)) {
      nextErrors.price = 'Enter the amount due';
    }

    if (kind === 'allowance') {
      if (entryMode === 'daily' && !startDate) nextErrors.startDate = 'Select the tracker start date';
      if (monthlyLimit && !isPositiveNumber(monthlyLimit)) {
        nextErrors.monthlyLimit = 'Enter a valid monthly limit';
      }
    }

    if (kind === 'loan') {
      if (!isPositiveNumber(loanAmount)) nextErrors.loanAmount = 'Enter the loan amount';
      if (!interestRate.trim() || Number.isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0) {
        nextErrors.interestRate = 'Enter the interest rate';
      }
      if (!disbursedDate) nextErrors.disbursedDate = 'Select the disbursed date';
      if (!startDate) nextErrors.startDate = 'Select the due date';
    }

    if (kind === 'birthday') {
      const validMembers = members.filter((m) => m.name.trim() && m.dateOfBirth);
      if (validMembers.length === 0) nextErrors.members = 'Add at least one member with a name and date of birth';
    }

    return nextErrors;
  };

  const handleSave = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Past logs already have their amount baked in at the old price and keep it by default —
    // only ask when there's an actual price edit on a tracker that already has logged history.
    const priceChanged =
      isEditMode &&
      !!existingTracker &&
      (kind === 'quantity' || kind === 'bill') &&
      existingTracker.price !== price;

    if (priceChanged) {
      Alert.alert(
        'Price Updated',
        `You changed the price from ₹${existingTracker!.price || 0} to ₹${price || 0}. Apply the new price to:`,
        [
          { text: 'Upcoming Tasks Only', onPress: () => persistTracker(false) },
          { text: 'All Tasks (Recalculate History)', onPress: () => persistTracker(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    persistTracker(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {isEditMode ? 'Edit Tracker' : 'New Tracker'}
          </Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Tracker Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Tracker Type</Text>
          <View style={styles.kindGrid}>
            {KIND_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.kindChip, styles.kindChipWrap, kind === option.id && styles.kindChipActive]}
                onPress={() => {
                  setKind(option.id);
                  setReminderRepeat(defaultRepeatForKind(option.id));
                  if (option.id === 'loan') {
                    setUnit('Grams');
                    setSelectedIcon('money');
                  }
                  if (option.id === 'birthday') {
                    setSelectedIcon('event');
                    if (members.length === 0) addMember();
                  }
                  if (option.id === 'allowance') {
                    setSelectedIcon('money');
                    setEntryMode('manual');
                  }
                  setErrors({});
                }}
              >
                <option.icon size={18} color={kind === option.id ? '#FFFFFF' : defaultTheme.colors.textSecondary} />
                <Text style={[styles.kindChipText, kind === option.id && styles.kindChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tracker Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Tracker Name</Text>
          <View style={[styles.fieldBox, errors.name && styles.fieldBoxError]}>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Morning Milk, Newspaper"
              value={name}
              onChangeText={(value) => { setName(value); clearError('name'); }}
              placeholderTextColor={defaultTheme.colors.textSecondary}
            />
            <TouchableOpacity
              style={[styles.namePreview, { backgroundColor: selectedColor + '20' }]}
              onPress={() => setShowIconPicker(true)}
            >
              <SelectedIcon size={20} color={selectedColor} />
            </TouchableOpacity>
          </View>
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Color Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorBtn,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorBtnActive
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && <View style={styles.colorSelectedDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Entry Mode (allowance) */}
        {kind === 'allowance' && (
          <View style={styles.section}>
            <Text style={styles.label}>Entry Mode</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.paymentCard, styles.rowItem, entryMode === 'manual' && styles.paymentCardActive]}
                onPress={() => setEntryMode('manual')}
              >
                {entryMode === 'manual' && (
                  <View style={styles.paymentCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
                <Pencil size={22} color={entryMode === 'manual' ? defaultTheme.colors.primary : '#94A3B8'} />
                <Text style={[styles.paymentTitle, entryMode !== 'manual' && styles.textMuted]}>
                  Manual Entry
                </Text>
                <Text style={[styles.paymentSubtitle, entryMode !== 'manual' && styles.textMuted]}>
                  Log expenses anytime
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, styles.rowItem, entryMode === 'daily' && styles.paymentCardActive]}
                onPress={() => setEntryMode('daily')}
              >
                {entryMode === 'daily' && (
                  <View style={styles.paymentCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
                <Calendar size={22} color={entryMode === 'daily' ? defaultTheme.colors.primary : '#94A3B8'} />
                <Text style={[styles.paymentTitle, entryMode !== 'daily' && styles.textMuted]}>
                  Daily Entry
                </Text>
                <Text style={[styles.paymentSubtitle, entryMode !== 'daily' && styles.textMuted]}>
                  One entry per day
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Monthly Limit (allowance) */}
        {kind === 'allowance' && (
          <View style={styles.section}>
            <Text style={styles.label}>Monthly Limit (Optional)</Text>
            <View style={[styles.fieldBox, errors.monthlyLimit && styles.fieldBoxError]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 3000"
                value={monthlyLimit}
                onChangeText={(value) => { setMonthlyLimit(value); clearError('monthlyLimit'); }}
                keyboardType="numeric"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
            </View>
            {errors.monthlyLimit && <Text style={styles.errorText}>{errors.monthlyLimit}</Text>}
          </View>
        )}

        {/* Seller Details */}
        {kind === 'quantity' && (
          <View style={styles.row}>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Seller Name</Text>
              <View style={styles.fieldBox}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Ramesh"
                  value={sellerName}
                  onChangeText={setSellerName}
                  placeholderTextColor={defaultTheme.colors.textSecondary}
                />
              </View>
            </View>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.fieldBox}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="98765 43210"
                  value={sellerContact}
                  onChangeText={setSellerContact}
                  keyboardType="phone-pad"
                  placeholderTextColor={defaultTheme.colors.textSecondary}
                />
              </View>
            </View>
          </View>
        )}

        {/* Unit and Price (recurring) */}
        {kind === 'quantity' && (
          <View style={styles.row}>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Unit</Text>
              <TouchableOpacity style={styles.fieldBox} onPress={openUnitPicker}>
                <Text style={styles.fieldInput}>{unit}</Text>
                <ChevronDown size={20} color={defaultTheme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Price per {unit} (₹)</Text>
              <View style={[styles.fieldBox, errors.price && styles.fieldBoxError]}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Enter price"
                  value={price}
                  onChangeText={(value) => { setPrice(value); clearError('price'); }}
                  keyboardType="numeric"
                  placeholderTextColor={defaultTheme.colors.textSecondary}
                />
              </View>
              {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
            </View>
          </View>
        )}

        {/* Amount Due (bill) */}
        {kind === 'bill' && (
          <View style={styles.section}>
            <Text style={styles.label}>Amount Due (₹)</Text>
            <View style={[styles.fieldBox, errors.price && styles.fieldBoxError]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter amount due"
                value={price}
                onChangeText={(value) => { setPrice(value); clearError('price'); }}
                keyboardType="numeric"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
            </View>
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>
        )}

        {/* Loan Amount (loan) */}
        {kind === 'loan' && (
          <View style={styles.section}>
            <Text style={styles.label}>Loan Amount (₹)</Text>
            <View style={[styles.fieldBox, errors.loanAmount && styles.fieldBoxError]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter loan amount"
                value={formatAmountInput(loanAmount)}
                onChangeText={(value) => { setLoanAmount(stripAmountFormatting(value)); clearError('loanAmount'); }}
                keyboardType="numeric"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
            </View>
            {errors.loanAmount && <Text style={styles.errorText}>{errors.loanAmount}</Text>}
          </View>
        )}

        {/* Bank Name (loan) */}
        {kind === 'loan' && (
          <View style={styles.section}>
            <Text style={styles.label}>Bank Name</Text>
            <View style={styles.fieldBox}>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChangeText={setBankName}
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
            </View>
          </View>
        )}

        {/* Collateral (loan) */}
        {kind === 'loan' && (
          <View style={styles.row}>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Collateral Weight</Text>
              <View style={styles.fieldBox}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Enter weight"
                  value={collateralWeight}
                  onChangeText={setCollateralWeight}
                  keyboardType="numeric"
                  placeholderTextColor={defaultTheme.colors.textSecondary}
                />
              </View>
            </View>
            <View style={[styles.section, styles.rowItem]}>
              <Text style={styles.label}>Unit</Text>
              <View style={[styles.fieldBox, styles.fieldBoxDisabled]}>
                <Text style={styles.fieldInput}>Grams</Text>
              </View>
            </View>
          </View>
        )}

        {/* Interest Rate (loan) */}
        {kind === 'loan' && (
          <View style={styles.section}>
            <Text style={styles.label}>Interest Rate (% per annum)</Text>
            <View style={[styles.fieldBox, errors.interestRate && styles.fieldBoxError]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter interest rate"
                value={interestRate}
                onChangeText={(value) => { setInterestRate(value); clearError('interestRate'); }}
                keyboardType="numeric"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
            </View>
            {errors.interestRate && <Text style={styles.errorText}>{errors.interestRate}</Text>}
          </View>
        )}

        {/* Disbursed Date (loan) */}
        {kind === 'loan' && (
          <View style={styles.section}>
            <Text style={styles.label}>Disbursed Date</Text>
            <TouchableOpacity
              style={[styles.fieldBox, errors.disbursedDate && styles.fieldBoxError]}
              onPress={openDisbursedPicker}
            >
              <Calendar size={20} color={disbursedDate ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary} />
              <Text style={[styles.fieldInput, styles.fieldInputWithIcon, disbursedDate && styles.fieldInputSelected]}>
                {disbursedDate ? formatDate(disbursedDate) : 'Select a date'}
              </Text>
              {disbursedDate && (
                <TouchableOpacity onPress={() => setDisbursedDate(null)} style={styles.clearBtn}>
                  <X size={16} color={defaultTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.disbursedDate && <Text style={styles.errorText}>{errors.disbursedDate}</Text>}
          </View>
        )}

        {/* Payment Method (recurring) */}
        {kind === 'quantity' && (
          <View style={styles.section}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.paymentCard, styles.rowItem, paymentMethod === 'quantity' && styles.paymentCardActive]}
                onPress={() => setPaymentMethod('quantity')}
              >
                {paymentMethod === 'quantity' && (
                  <View style={styles.paymentCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
                <Target size={22} color={paymentMethod === 'quantity' ? defaultTheme.colors.primary : '#94A3B8'} />
                <Text style={[styles.paymentTitle, paymentMethod !== 'quantity' && styles.textMuted]}>
                  Pay at {targetQuantity || '0'} {unit}
                </Text>
                <Text style={[styles.paymentSubtitle, paymentMethod !== 'quantity' && styles.textMuted]}>
                  Pay when target quantity is reached
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, styles.rowItem, paymentMethod === 'monthly' && styles.paymentCardActive]}
                onPress={() => setPaymentMethod('monthly')}
              >
                {paymentMethod === 'monthly' && (
                  <View style={styles.paymentCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
                <Calendar size={22} color={paymentMethod === 'monthly' ? defaultTheme.colors.primary : '#94A3B8'} />
                <Text style={[styles.paymentTitle, paymentMethod !== 'monthly' && styles.textMuted]}>
                  Monthly Payment
                </Text>
                <Text style={[styles.paymentSubtitle, paymentMethod !== 'monthly' && styles.textMuted]}>
                  Pay on specific date every month
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, styles.rowItem, paymentMethod === 'manual' && styles.paymentCardActive]}
                onPress={() => setPaymentMethod('manual')}
              >
                {paymentMethod === 'manual' && (
                  <View style={styles.paymentCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
                <Pencil size={22} color={paymentMethod === 'manual' ? defaultTheme.colors.primary : '#94A3B8'} />
                <Text style={[styles.paymentTitle, paymentMethod !== 'manual' && styles.textMuted]}>
                  Manual Entry
                </Text>
                <Text style={[styles.paymentSubtitle, paymentMethod !== 'manual' && styles.textMuted]}>
                  Add and record payments manually
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment Date (recurring, monthly) */}
        {kind === 'quantity' && paymentMethod === 'monthly' && (
          <View style={styles.section}>
            <Text style={styles.label}>Payment Date</Text>
            <TouchableOpacity
              style={[styles.fieldBox, errors.monthlyPaymentDay && styles.fieldBoxError]}
              onPress={() => setShowMonthlyDayPicker(true)}
            >
              <Calendar size={20} color={monthlyPaymentDay ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary} />
              <Text style={[styles.fieldInput, styles.fieldInputWithIcon, monthlyPaymentDay && styles.fieldInputSelected]}>
                {monthlyPaymentDay ? formatMonthlyPaymentDay(monthlyPaymentDay) : 'Select a day of the month'}
              </Text>
            </TouchableOpacity>
            {errors.monthlyPaymentDay && <Text style={styles.errorText}>{errors.monthlyPaymentDay}</Text>}
          </View>
        )}

        {/* Target Quantity (recurring) */}
        {kind === 'quantity' && paymentMethod === 'quantity' && (
          <View style={styles.section}>
            <Text style={styles.label}>Target Quantity</Text>
            <View style={[styles.fieldBox, errors.targetQuantity && styles.fieldBoxError]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter target quantity"
                value={targetQuantity}
                onChangeText={handleTargetQuantityChange}
                keyboardType="numeric"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
              <Text style={styles.fieldSuffix}>{unit}</Text>
            </View>
            {errors.targetQuantity && <Text style={styles.errorText}>{errors.targetQuantity}</Text>}
          </View>
        )}

        {/* Quick Purchase Options (recurring) */}
        {kind === 'quantity' && paymentMethod === 'quantity' && (
          <View style={styles.section}>
            <Text style={[styles.label, !isPositiveNumber(targetQuantity) && styles.textMuted]}>
              Quick Purchase Options ({unit})
            </Text>
            <View style={styles.row}>
              {quantityOptions.map((option, index) => (
                <View
                  key={index}
                  style={[styles.fieldBox, styles.rowItem, !isPositiveNumber(targetQuantity) && styles.fieldBoxDisabled]}
                >
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Qty"
                    value={option}
                    onChangeText={(value) => updateQuantityOption(index, value)}
                    keyboardType="numeric"
                    editable={isPositiveNumber(targetQuantity)}
                    placeholderTextColor={defaultTheme.colors.textSecondary}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Members (birthday) */}
        {kind === 'birthday' && (
          <View style={styles.section}>
            <Text style={styles.label}>Members</Text>
            {members.map((member, index) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberCardHeader}>
                  <TextInput
                    style={styles.memberNameInput}
                    placeholder="Member name"
                    value={member.name}
                    onChangeText={(value) => updateMember(member.id, { name: value })}
                    placeholderTextColor={defaultTheme.colors.textSecondary}
                  />
                  <TouchableOpacity onPress={() => removeMember(member.id)} style={styles.memberRemoveBtn}>
                    <X size={16} color={defaultTheme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.fieldBox} onPress={() => openMemberDobPicker(index)}>
                  <Calendar
                    size={20}
                    color={member.dateOfBirth ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.fieldInput,
                      styles.fieldInputWithIcon,
                      member.dateOfBirth && styles.fieldInputSelected,
                    ]}
                  >
                    {member.dateOfBirth ? formatDate(new Date(member.dateOfBirth)) : 'Select date of birth'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.memberReminderLabel}>Remind me</Text>
                <View style={styles.row}>
                  {REMINDER_OFFSET_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.days}
                      style={[styles.kindChip, member.reminderOffsetDays === option.days && styles.kindChipActive]}
                      onPress={() => updateMember(member.id, { reminderOffsetDays: option.days })}
                    >
                      <Text
                        style={[
                          styles.kindChipText,
                          member.reminderOffsetDays === option.days && styles.kindChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addMemberBtn} onPress={addMember}>
              <Text style={styles.addMemberBtnText}>+ Add Member</Text>
            </TouchableOpacity>
            {errors.members && <Text style={styles.errorText}>{errors.members}</Text>}
          </View>
        )}

        {/* Start Date / Due Date / Event Date */}
        {kind !== 'booking' &&
          kind !== 'birthday' &&
          !(kind === 'quantity' && paymentMethod === 'manual') &&
          !(kind === 'allowance' && entryMode === 'manual') && (
          <View style={styles.section}>
            <Text style={styles.label}>
              {kind === 'bill' || kind === 'loan' ? 'Due Date' : kind === 'event' ? 'Event Date' : 'Tracker Start Date'}
            </Text>
            <TouchableOpacity
              style={[styles.fieldBox, errors.startDate && styles.fieldBoxError]}
              onPress={openStartDatePicker}
            >
              <Calendar size={20} color={startDate ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary} />
              <Text style={[styles.fieldInput, styles.fieldInputWithIcon, startDate && styles.fieldInputSelected]}>
                {startDate ? formatDate(startDate) : 'Select a date'}
              </Text>
              {startDate && (
                <TouchableOpacity onPress={() => setStartDate(null)} style={styles.clearBtn}>
                  <X size={16} color={defaultTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
          </View>
        )}

        {/* Interest Summary (loan) */}
        {kind === 'loan' && (
          <View style={[styles.section, styles.loanSummaryBox]}>
            <View style={styles.loanSummaryRow}>
              <View style={styles.loanSummaryStat}>
                <Text style={styles.loanSummaryStatValue}>
                  ₹{formatIndianNumber(loanBreakdown.monthlyInterest, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.loanSummaryStatLabel}>Interest / Month</Text>
              </View>
              <View style={styles.loanSummaryStat}>
                <Text style={styles.loanSummaryStatValue}>
                  ₹{formatIndianNumber(loanBreakdown.totalInterest, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.loanSummaryStatLabel}>
                  Total Interest ({loanBreakdown.tenureMonths} mo{loanBreakdown.tenureMonths === 1 ? '' : 's'})
                </Text>
              </View>
            </View>
            <View style={styles.loanSummaryDivider} />
            <Text style={styles.loanSummaryLabel}>Total Payable at Maturity</Text>
            <Text style={styles.loanSummaryValue}>
              ₹{formatIndianNumber(loanBreakdown.totalPayable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        {/* Reminder Time / Book Before */}
        {kind !== 'birthday' &&
          !(kind === 'quantity' && paymentMethod === 'manual') &&
          !(kind === 'allowance' && entryMode === 'manual') && (
          <View style={styles.section}>
            <Text style={styles.label}>{kind === 'booking' ? 'Book Before' : 'Reminder Time'}</Text>
            <TouchableOpacity style={styles.fieldBox} onPress={openReminderPicker}>
              <Bell size={20} color={reminderDate ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary} />
              <Text style={[styles.fieldInput, styles.fieldInputWithIcon, reminderDate && styles.fieldInputSelected]}>
                {reminderDate ? formatTime(reminderDate) : kind === 'booking' ? 'Select booking deadline' : 'Select reminder time'}
              </Text>
              {reminderDate && (
                <TouchableOpacity onPress={() => setReminderDate(null)} style={styles.clearBtn}>
                  <X size={16} color={defaultTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Repeat Reminder */}
        {kind !== 'birthday' &&
          !(kind === 'quantity' && paymentMethod === 'manual') &&
          !(kind === 'allowance' && entryMode === 'manual') && (
          <View style={styles.section}>
            <Text style={styles.label}>Repeat Reminder</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {visibleRepeatOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.kindChip, reminderRepeat === option && styles.kindChipActive]}
                  onPress={() => setReminderRepeat(option)}
                >
                  <Text style={[styles.kindChipText, reminderRepeat === option && styles.kindChipTextActive]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <View style={[styles.fieldBox, styles.notesBox]}>
            <TextInput
              style={[styles.fieldInput, styles.notesInput]}
              placeholder="Add any extra details (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={defaultTheme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Icon picker */}
        {showIconPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowIconPicker(false)}>
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Choose Icon</Text>
                <View style={styles.iconGrid}>
                  {TRACKER_ICONS.map((icon) => (
                    <TouchableOpacity
                      key={icon.id}
                      style={[
                        styles.iconBtn,
                        selectedIcon === icon.id && styles.iconBtnActive
                      ]}
                      onPress={() => {
                        setSelectedIcon(icon.id);
                        setShowIconPicker(false);
                      }}
                    >
                      <icon.component
                        size={24}
                        color={selectedIcon === icon.id ? defaultTheme.colors.primary : defaultTheme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Unit picker */}
        {showUnitPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowUnitPicker(false)}>
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Unit</Text>
                <View style={styles.unitGrid}>
                  {UNIT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.unitChip, unit === option && styles.kindChipActive]}
                      onPress={() => {
                        setUnit(option);
                        setShowUnitPicker(false);
                      }}
                    >
                      <Text style={[styles.kindChipText, unit === option && styles.kindChipTextActive]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Custom Unit</Text>
                <View style={styles.fieldBox}>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Cylinders, Strips"
                    value={customUnitInput}
                    onChangeText={setCustomUnitInput}
                    placeholderTextColor={defaultTheme.colors.textSecondary}
                  />
                </View>
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => {
                    if (customUnitInput.trim()) {
                      setUnit(customUnitInput.trim());
                    }
                    setShowUnitPicker(false);
                  }}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Monthly payment day picker */}
        {showMonthlyDayPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity
              style={styles.iosPickerOverlay}
              activeOpacity={1}
              onPress={() => setShowMonthlyDayPicker(false)}
            >
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Payment Date</Text>
                <View style={styles.unitGrid}>
                  {MONTH_DAYS.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, monthlyPaymentDay === day && styles.kindChipActive]}
                      onPress={() => {
                        setMonthlyPaymentDay(day);
                        clearError('monthlyPaymentDay');
                        setShowMonthlyDayPicker(false);
                      }}
                    >
                      <Text style={[styles.kindChipText, monthlyPaymentDay === day && styles.kindChipTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* iOS-only inline DateTimePicker overlays */}
        {Platform.OS === 'ios' && showStartPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowStartPicker(false)}>
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Start Date</Text>
                <DateTimePicker
                  value={startDate ?? new Date()}
                  mode="date"
                  display="inline"
                  onChange={(_e: any, date?: Date) => { if (date) { setStartDate(date); clearError('startDate'); } }}
                  style={styles.iosPicker}
                />
                <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowStartPicker(false)}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        {Platform.OS === 'ios' && showDisbursedPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowDisbursedPicker(false)}>
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Disbursed Date</Text>
                <DateTimePicker
                  value={disbursedDate ?? new Date()}
                  mode="date"
                  display="inline"
                  onChange={(_e: any, date?: Date) => { if (date) { setDisbursedDate(date); clearError('disbursedDate'); } }}
                  style={styles.iosPicker}
                />
                <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowDisbursedPicker(false)}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        {Platform.OS === 'ios' && activeMemberDobIndex !== null && (
          <Modal transparent animationType="fade">
            <TouchableOpacity
              style={styles.iosPickerOverlay}
              activeOpacity={1}
              onPress={() => setActiveMemberDobIndex(null)}
            >
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Date of Birth</Text>
                <DateTimePicker
                  value={
                    members[activeMemberDobIndex]?.dateOfBirth
                      ? new Date(members[activeMemberDobIndex].dateOfBirth)
                      : new Date()
                  }
                  mode="date"
                  display="inline"
                  maximumDate={new Date()}
                  onChange={(_e: any, date?: Date) => {
                    if (date && activeMemberDobIndex !== null) {
                      updateMember(members[activeMemberDobIndex].id, { dateOfBirth: date.toISOString() });
                    }
                  }}
                  style={styles.iosPicker}
                />
                <TouchableOpacity style={styles.iosPickerDone} onPress={() => setActiveMemberDobIndex(null)}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        {Platform.OS === 'ios' && showReminderPicker && (
          <Modal transparent animationType="fade">
            <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowReminderPicker(false)}>
              <View style={styles.iosPickerCard}>
                <Text style={styles.iosPickerTitle}>Select Reminder Time</Text>
                <DateTimePicker
                  value={reminderDate ?? new Date()}
                  mode="time"
                  display="spinner"
                  onChange={(_e: any, date?: Date) => { if (date) setReminderDate(date); }}
                  style={styles.iosPicker}
                />
                <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowReminderPicker(false)}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        <Button
          title={isEditMode ? 'Update Tracker' : 'Create Tracker'}
          onPress={handleSave}
          loading={loading}
          style={styles.saveBtn}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerSafeArea: {
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: defaultTheme.spacing.md,
    paddingVertical: defaultTheme.spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
  },
  section: {
    marginBottom: defaultTheme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    marginBottom: defaultTheme.spacing.sm,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: defaultTheme.colors.textPrimary,
    fontWeight: '500',
    paddingVertical: 12,
  },
  notesBox: {
    minHeight: 90,
    alignItems: 'flex-start',
  },
  notesInput: {
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fieldBoxError: {
    borderColor: defaultTheme.colors.error,
  },
  fieldBoxDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: defaultTheme.colors.border,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: defaultTheme.colors.error,
    marginTop: 6,
  },
  fieldInputWithIcon: {
    marginLeft: 10,
    color: '#94A3B8',
  },
  fieldInputSelected: {
    color: defaultTheme.colors.textPrimary,
    fontWeight: '600',
  },
  fieldSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    marginLeft: 8,
  },
  namePreview: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginHorizontal: -defaultTheme.spacing.lg,
    paddingHorizontal: defaultTheme.spacing.lg,
  },
  iconBtn: {
    width: 52,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBtnActive: {
    borderColor: defaultTheme.colors.primary,
    backgroundColor: defaultTheme.colors.primaryLight,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 12,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: defaultTheme.spacing.md,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayChip: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.border,
    borderRadius: 12,
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    gap: 6,
  },
  kindChipWrap: {
    marginRight: 0,
  },
  kindChipActive: {
    backgroundColor: defaultTheme.colors.primary,
    borderColor: defaultTheme.colors.primary,
  },
  kindChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  kindChipTextActive: {
    color: '#FFFFFF',
  },
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorBtnActive: {
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorSelectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  paymentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    padding: 14,
    position: 'relative',
  },
  paymentCardActive: {
    backgroundColor: defaultTheme.colors.primaryLight,
    borderColor: defaultTheme.colors.primary,
  },
  paymentCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginTop: 10,
  },
  paymentSubtitle: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  textMuted: {
    color: '#CBD5E1',
  },
  loanSummaryBox: {
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  loanSummaryRow: {
    flexDirection: 'row',
    width: '100%',
  },
  loanSummaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  loanSummaryStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.primaryDark,
  },
  loanSummaryStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: defaultTheme.colors.primaryDark,
    marginTop: 2,
    textAlign: 'center',
  },
  loanSummaryDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 10,
  },
  loanSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: defaultTheme.colors.primaryDark,
    marginBottom: 4,
  },
  loanSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.primaryDark,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 8,
  },
  memberCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    padding: 14,
    marginBottom: defaultTheme.spacing.md,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.sm,
    gap: 8,
  },
  memberNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberReminderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    marginTop: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.sm,
  },
  addMemberBtn: {
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addMemberBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.primary,
  },
  saveBtn: {
    marginTop: 10,
    borderRadius: 20,
    height: 56,
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iosPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  iosPicker: {
    width: '100%',
  },
  iosPickerDone: {
    marginTop: 16,
    backgroundColor: defaultTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  iosPickerDoneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
