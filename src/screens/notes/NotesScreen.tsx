import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated, PanResponder, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FileText, Plus, Search, Star, Trash2 } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll, upsertRecord, deleteRecord } from '../../services/localStore';
import { NoteRecord } from '../../services/notes';
import { formatRelativeDayTime } from '../../utils/date';

const DELETE_WIDTH = 84;
const SWIPE_OPEN_THRESHOLD = DELETE_WIDTH / 2;

type FilterKind = 'All' | 'Favorites';

const FILTERS: FilterKind[] = ['All', 'Favorites'];

const matchesFilter = (filter: FilterKind, note: NoteRecord): boolean =>
  filter === 'All' || note.isFavorite;

const notePreview = (note: NoteRecord): string => note.content.trim() || 'No content';

const NoteRow = ({
  note,
  isLast,
  onPress,
  onToggleFavorite,
}: {
  note: NoteRecord;
  isLast: boolean;
  onPress: (note: NoteRecord) => void;
  onToggleFavorite: (note: NoteRecord) => void;
}) => (
  <TouchableOpacity
    style={[styles.row, isLast && styles.rowLast]}
    activeOpacity={0.7}
    onPress={() => onPress(note)}
  >
    <View style={styles.rowIconBox}>
      <FileText size={20} color={defaultTheme.colors.secondary} />
    </View>

    <View style={styles.rowInfo}>
      <Text style={styles.rowTitle} numberOfLines={1}>{note.title || 'Untitled'}</Text>
      <Text style={styles.rowPreview} numberOfLines={2}>{notePreview(note)}</Text>
      <Text style={styles.rowDate}>{formatRelativeDayTime(new Date(note.updatedAt))}</Text>
    </View>

    <TouchableOpacity style={styles.favoriteBtn} onPress={() => onToggleFavorite(note)}>
      <Star
        size={18}
        color={note.isFavorite ? defaultTheme.colors.warning : defaultTheme.colors.textSecondary}
        fill={note.isFavorite ? defaultTheme.colors.warning : 'none'}
      />
    </TouchableOpacity>
  </TouchableOpacity>
);

// Wraps NoteRow with a swipe-left-to-reveal-delete gesture, matching the pattern used for
// tracker cards (core RN Animated + PanResponder, no gesture-handler dependency).
const SwipeableNoteRow = ({
  note,
  isLast,
  onPress,
  onToggleFavorite,
  onDelete,
}: {
  note: NoteRecord;
  isLast: boolean;
  onPress: (note: NoteRecord) => void;
  onToggleFavorite: (note: NoteRecord) => void;
  onDelete: (note: NoteRecord) => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const snapTo = (open: boolean) => {
    isOpenRef.current = open;
    Animated.spring(translateX, {
      toValue: open ? -DELETE_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_evt, gesture) => {
        const base = isOpenRef.current ? -DELETE_WIDTH : 0;
        const next = Math.min(0, Math.max(-DELETE_WIDTH, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const base = isOpenRef.current ? -DELETE_WIDTH : 0;
        const next = base + gesture.dx;
        snapTo(next < -SWIPE_OPEN_THRESHOLD);
      },
    })
  ).current;

  const handleRowPress = (n: NoteRecord) => {
    if (isOpenRef.current) {
      snapTo(false);
      return;
    }
    onPress(n);
  };

  return (
    <View style={styles.swipeRow}>
      <View style={styles.deleteAction}>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(note)}>
          <Trash2 size={22} color="#FFFFFF" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <NoteRow note={note} isLast={isLast} onPress={handleRowPress} onToggleFavorite={onToggleFavorite} />
      </Animated.View>
    </View>
  );
};

export const NotesScreen = () => {
  const navigation = useNavigation<any>();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKind>('All');

  const fetchNotes = async () => {
    try {
      const all = await getAll<NoteRecord>('notes');
      setNotes(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [])
  );

  const handleOpenNote = (note: NoteRecord) => navigation.navigate('NoteDetails', { noteId: note.id });

  const handleToggleFavorite = async (note: NoteRecord) => {
    const updated = { ...note, isFavorite: !note.isFavorite };
    await upsertRecord('notes', updated);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
  };

  const handleDeleteNote = (note: NoteRecord) => {
    Alert.alert(
      'Delete Note',
      `Delete "${note.title || 'this note'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecord('notes', note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
          },
        },
      ]
    );
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredNotes = notes
    .filter((note) => matchesFilter(activeFilter, note))
    .filter((note) => !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query));

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <Text>Loading notes...</Text>
        </View>
      );
    }

    if (notes.length === 0) {
      return (
        <View style={styles.content}>
          <View style={[styles.emptyIconBox, { backgroundColor: defaultTheme.colors.secondaryLight }]}>
            <FileText size={48} color={defaultTheme.colors.secondary} />
          </View>
          <Text style={styles.emptyText}>No notes yet.</Text>
          <Text style={styles.subText}>Tap the + button to write your first note.</Text>
        </View>
      );
    }

    if (filteredNotes.length === 0) {
      return (
        <View style={styles.content}>
          <Text style={styles.emptyText}>No matching notes.</Text>
          <Text style={styles.subText}>
            {activeFilter === 'Favorites' ? 'Tap the star on a note to favorite it.' : 'Try a different search.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.listContainer}>
        {filteredNotes.map((note, index) => (
          <SwipeableNoteRow
            key={note.id}
            note={note}
            isLast={index === filteredNotes.length - 1}
            onPress={handleOpenNote}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDeleteNote}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Notes</Text>
          </View>

          <View style={styles.searchBox}>
            <Search size={18} color={defaultTheme.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notes"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={defaultTheme.colors.textSecondary}
            />
          </View>

          <View style={styles.chipRow}>
            {FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.chip, activeFilter === filter && styles.chipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.chipText, activeFilter === filter && styles.chipTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderContent()}
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CreateNote')}
      >
        <Plus size={32} color="#FFFFFF" strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.md,
    paddingBottom: 100,
  },
  header: {
    marginBottom: defaultTheme.spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultTheme.colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    marginBottom: defaultTheme.spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: defaultTheme.colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: defaultTheme.borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    marginRight: 10,
  },
  chipActive: {
    backgroundColor: defaultTheme.colors.primary,
    borderColor: defaultTheme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: defaultTheme.spacing.xl,
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.sm,
  },
  subText: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    // Rows are separated by a bottom border (see `row`), not a gap, to read as a flat list.
  },
  swipeRow: {
    position: 'relative',
  },
  deleteAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    backgroundColor: defaultTheme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: defaultTheme.colors.secondaryLight,
  },
  rowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  rowPreview: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  rowDate: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  favoriteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
});
