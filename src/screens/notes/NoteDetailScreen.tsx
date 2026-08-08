import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Pencil } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll } from '../../services/localStore';
import { NoteRecord } from '../../services/notes';
import { formatRelativeDayTime } from '../../utils/date';

export const NoteDetailScreen = ({ navigation, route }: any) => {
  const noteId: string = route.params.noteId;
  const [note, setNote] = useState<NoteRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadNote = async () => {
        const all = await getAll<NoteRecord>('notes');
        setNote(all.find((n) => n.id === noteId) ?? null);
      };
      loadNote();
    }, [noteId])
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ArrowLeft size={22} color={defaultTheme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Note</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateNote', { noteId })}
            style={styles.headerBtn}
          >
            <Pencil size={20} color={defaultTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        {note && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.title}>{note.title || 'Untitled'}</Text>
            <Text style={styles.date}>{formatRelativeDayTime(new Date(note.updatedAt))}</Text>
            <Text style={styles.content}>{note.content || 'No content'}</Text>
          </ScrollView>
        )}
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
  },
  bodyContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
    paddingBottom: defaultTheme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  date: {
    fontSize: 13,
    fontWeight: '500',
    color: defaultTheme.colors.textSecondary,
    marginBottom: defaultTheme.spacing.lg,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: defaultTheme.colors.textPrimary,
  },
});
