import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { generateId } from '../../utils/id';
import { getAll, upsertRecord } from '../../services/localStore';
import { NoteRecord } from '../../services/notes';

const TITLE_MAX_LENGTH = 100;

export const CreateNoteScreen = ({ navigation, route }: any) => {
  const noteId: string | undefined = route.params?.noteId;
  const isEditMode = !!noteId;

  const [existingNote, setExistingNote] = useState<NoteRecord | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadExistingNote = async () => {
      if (!noteId) return;
      const all = await getAll<NoteRecord>('notes');
      const note = all.find((n) => n.id === noteId) ?? null;
      setExistingNote(note);
      if (note) {
        setTitle(note.title);
        setContent(note.content);
      }
    };
    loadExistingNote();
  }, [noteId]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Note title is required');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: NoteRecord = {
        id: existingNote?.id ?? generateId(),
        title: title.trim(),
        content,
        isFavorite: existingNote?.isFavorite ?? false,
        createdAt: existingNote?.createdAt ?? now,
        updatedAt: now,
      };

      await upsertRecord('notes', record);
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save note', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <X size={22} color={defaultTheme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEditMode ? 'Edit Note' : 'Add Note'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={defaultTheme.colors.primary} />
            ) : (
              <Check size={22} color={defaultTheme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.titleLabel}>Title</Text>
            <Text style={styles.titleCounter}>{title.length}/{TITLE_MAX_LENGTH}</Text>
          </View>
          <TextInput
            style={styles.titleInput}
            placeholder="Note title"
            value={title}
            onChangeText={(value) => { setTitle(value); setError(''); }}
            maxLength={TITLE_MAX_LENGTH}
            multiline
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TextInput
            style={styles.contentInput}
            placeholder="Start typing..."
            value={content}
            onChangeText={setContent}
            multiline
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
        </View>
      </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: defaultTheme.spacing.md,
    paddingVertical: defaultTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  body: {
    flex: 1,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: defaultTheme.spacing.sm,
  },
  titleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  titleCounter: {
    fontSize: 12,
    fontWeight: '500',
    color: defaultTheme.colors.textSecondary,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    paddingBottom: defaultTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: defaultTheme.colors.error,
    marginTop: 6,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: defaultTheme.colors.textPrimary,
    marginTop: defaultTheme.spacing.md,
    textAlignVertical: 'top',
  },
});
