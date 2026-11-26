import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BriefcaseBusiness, Plus, Trash2 } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useAuth } from '../core/auth/AuthContext';
import { readLocal, writeLocal } from '../features/common/localStore';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

type ProjectStatus = 'در جریان' | 'تکمیل‌شده' | 'متوقف';
type Project = { id: string; title: string; description: string; status: ProjectStatus; createdAt: string };

const STATUSES: ProjectStatus[] = ['در جریان', 'تکمیل‌شده', 'متوقف'];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const owner = user?.id ?? 'guest';

  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const persist = useCallback((next: Project[]) => {
    setProjects(next);
    void writeLocal('projects', owner, next).catch(() => {});
  }, [owner]);

  useEffect(() => {
    let active = true;
    readLocal<Project[]>('projects', owner, []).then(value => { if (active) setProjects(value); }).catch(() => {});
    return () => { active = false; };
  }, [owner]);

  const add = () => {
    if (!title.trim()) { Alert.alert('عنوان پروژه را وارد کنید.'); return; }
    const project: Project = {
      id: `${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      status: 'در جریان',
      createdAt: new Date().toISOString(),
    };
    persist([project, ...projects]);
    setTitle(''); setDescription(''); setShowForm(false);
  };

  const cycleStatus = (id: string) => {
    persist(projects.map(project => project.id === id
      ? { ...project, status: STATUSES[(STATUSES.indexOf(project.status) + 1) % STATUSES.length] }
      : project));
  };

  const remove = (id: string) => {
    Alert.alert('حذف پروژه', 'این پروژه از روی گوشی حذف شود؟', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => persist(projects.filter(project => project.id !== id)) },
    ]);
  };

  return (
    <AppScreen title="پروژه‌های من" subtitle={user ? 'پروژه‌های شما روی همین گوشی ذخیره می‌شوند.' : 'برای ذخیرهٔ پروژه‌ها وارد حساب شوید؛ فعلاً مهمان هستید.'}>
      <Pressable onPress={() => setShowForm(value => !value)}
        style={[styles.addButton, { backgroundColor: ui.accentSoft, flexDirection: rowDirection }]}>
        <Plus size={17} color={ui.accent} />
        <Text style={{ color: ui.accent, fontWeight: '800', fontSize: 13 }}>{showForm ? 'بستن فرم' : 'پروژهٔ جدید'}</Text>
      </Pressable>

      {showForm && (
        <View style={[styles.form, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان پروژه"
            placeholderTextColor={ui.muted} style={[styles.input, { color: ui.text, backgroundColor: ui.surfaceAlt, borderColor: ui.border, textAlign }]} />
          <TextInput value={description} onChangeText={setDescription} placeholder="شرح کوتاه، محل و وضعیت کار"
            placeholderTextColor={ui.muted} multiline style={[styles.input, styles.area, { color: ui.text, backgroundColor: ui.surfaceAlt, borderColor: ui.border, textAlign }]} />
          <Pressable onPress={add} style={[styles.save, { backgroundColor: ui.accent }]}>
            <Text style={{ color: '#04140E', fontWeight: '800' }}>ذخیرهٔ پروژه</Text>
          </Pressable>
        </View>
      )}

      {projects.length === 0 && !showForm && (
        <View style={[styles.empty, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <BriefcaseBusiness size={26} color={ui.muted} />
          <Text style={{ color: ui.muted, textAlign, marginTop: 8, fontSize: 12 }}>هنوز پروژه‌ای ثبت نشده است.</Text>
        </View>
      )}

      {projects.map(project => (
        <View key={project.id} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <View style={[styles.cardHead, { flexDirection: rowDirection }]}>
            <Text style={[styles.title, { color: ui.text, textAlign }]}>{project.title}</Text>
            <Pressable onPress={() => remove(project.id)} hitSlop={8} accessibilityLabel="حذف پروژه">
              <Trash2 size={16} color={ui.danger} />
            </Pressable>
          </View>
          {!!project.description && <Text style={[styles.desc, { color: ui.muted, textAlign }]}>{project.description}</Text>}
          <View style={[styles.footer, { flexDirection: rowDirection }]}>
            <Pressable onPress={() => cycleStatus(project.id)}
              style={[styles.status, { backgroundColor: project.status === 'تکمیل‌شده' ? ui.accentSoft : project.status === 'متوقف' ? ui.dangerSoft : ui.surfaceAlt }]}>
              <Text style={{ color: project.status === 'تکمیل‌شده' ? ui.accent : project.status === 'متوقف' ? ui.danger : ui.muted, fontSize: 10, fontWeight: '800' }}>
                {project.status}
              </Text>
            </Pressable>
            <Text style={{ color: ui.muted, fontSize: 10 }}>{new Date(project.createdAt).toLocaleDateString('fa-IR')}</Text>
          </View>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: { alignSelf: 'flex-start', alignItems: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  form: { borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 14, gap: 9 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  area: { minHeight: 78, textAlignVertical: 'top' },
  save: { borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 9 },
  cardHead: { alignItems: 'center', gap: 9 },
  title: { flex: 1, fontSize: 14, fontWeight: '800' },
  desc: { fontSize: 11.5, lineHeight: 20, marginTop: 6 },
  footer: { alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  status: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
});
