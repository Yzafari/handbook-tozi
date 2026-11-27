
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BriefcaseBusiness, Plus } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useAuth } from '../core/auth/AuthContext';
import { useRouter } from 'expo-router';
import { readLocal, writeLocal } from '../features/common/localStore';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

import {
  createProject,
  getProjects,
} from '../core/network/projects';

import type { Project } from '../core/network/projects';

function getErrorMessage(error: unknown): string {
  const apiError = error as {
    response?: {
      data?: {
        message?: string;
      };
    };
    message?: string;
  };

  return (
    apiError?.response?.data?.message ||
    apiError?.message ||
    'ارتباط با سرور برقرار نشد'
  );
}

function getStatusLabel(status: Project['status']): string {
  switch (status) {
    case 'PLANNING':
      return 'در مرحله برنامه‌ریزی';
    case 'ACTIVE':
      return 'در جریان';
    case 'ON_HOLD':
      return 'متوقف';
    case 'COMPLETED':
      return 'تکمیل‌شده';
    case 'ARCHIVED':
      return 'بایگانی‌شده';
    default:
      return 'نامشخص';
  }
}

export default function ProjectsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);

  const owner = user?.id ?? 'guest';

  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const persistCache = useCallback(
    async (next: Project[]) => {
      setProjects(next);
      await writeLocal('projects', owner, next);
    },
    [owner]
  );

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const cached = await readLocal<Project[]>('projects', owner, []);
      setProjects(cached);

      if (!user?.id) {
        return;
      }

      const serverProjects = await getProjects();

      await persistCache(serverProjects);
    } catch (error) {
      setLoadError(getErrorMessage(error));

      const cached = await readLocal<Project[]>('projects', owner, []);
      setProjects(cached);
    } finally {
      setLoading(false);
    }
  }, [owner, user?.id, persistCache]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const add = async () => {
    if (!user?.id) {
      Alert.alert(
        'ورود به حساب کاربری',
        'برای ثبت پروژه باید ابتدا وارد حساب کاربری شوید.'
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert('عنوان پروژه را وارد کنید.');
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const created = await createProject({
        name: title.trim(),
        description: description.trim() || null,
        type: 'DISTRIBUTION',
      });

      setProjects((current) => {
        const next = [
          created,
          ...current.filter((item) => item.id !== created.id),
        ];

        void writeLocal('projects', owner, next).catch(() => {});
        return next;
      });

      setTitle('');
      setDescription('');
      setShowForm(false);

      Alert.alert('موفقیت', 'پروژه با موفقیت ثبت شد.');
    } catch (error) {
      Alert.alert(
        'خطا در ثبت پروژه',
        getErrorMessage(error)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen
      title="پروژه‌های من"
      subtitle={
        user
          ? 'پروژه‌های شما از طریق سرور دریافت می‌شوند.'
          : 'برای مشاهده و ثبت پروژه‌های حساب کاربری وارد شوید.'
      }
    >
      <Pressable
        onPress={() => setShowForm((value) => !value)}
        style={[
          styles.addButton,
          {
            backgroundColor: ui.accentSoft,
            flexDirection: rowDirection,
          },
        ]}
      >
        <Plus size={17} color={ui.accent} />
        <Text
          style={{
            color: ui.accent,
            fontWeight: '800',
            fontSize: 13,
          }}
        >
          {showForm ? 'بستن فرم' : 'پروژه جدید'}
        </Text>
      </Pressable>

      {showForm && (
        <View
          style={[
            styles.form,
            {
              backgroundColor: ui.surface,
              borderColor: ui.border,
            },
          ]}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان پروژه"
            placeholderTextColor={ui.muted}
            style={[
              styles.input,
              {
                color: ui.text,
                backgroundColor: ui.surfaceAlt,
                borderColor: ui.border,
                textAlign,
              },
            ]}
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="شرح کوتاه پروژه"
            placeholderTextColor={ui.muted}
            multiline
            style={[
              styles.input,
              styles.area,
              {
                color: ui.text,
                backgroundColor: ui.surfaceAlt,
                borderColor: ui.border,
                textAlign,
              },
            ]}
          />

          <Pressable
            disabled={saving}
            onPress={() => void add()}
            style={[
              styles.save,
              {
                backgroundColor: ui.accent,
                opacity: saving ? 0.6 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#04140E" />
            ) : (
              <Text
                style={{
                  color: '#04140E',
                  fontWeight: '800',
                }}
              >
                ثبت پروژه در سرور
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={ui.accent} />
          <Text style={{ color: ui.muted, fontSize: 12 }}>
            در حال دریافت پروژه‌ها...
          </Text>
        </View>
      )}

      {!!loadError && (
        <View
          style={[
            styles.error,
            {
              backgroundColor: ui.surface,
              borderColor: ui.border,
            },
          ]}
        >
          <Text style={{ color: ui.danger, fontSize: 12 }}>
            دریافت اطلاعات از سرور ناموفق بود.
          </Text>

          <Text
            style={{
              color: ui.muted,
              fontSize: 11,
              textAlign,
              marginTop: 5,
            }}
          >
            {loadError}
          </Text>

          <Pressable onPress={() => void loadProjects()}>
            <Text
              style={{
                color: ui.accent,
                fontWeight: '800',
                marginTop: 10,
              }}
            >
              تلاش مجدد
            </Text>
          </Pressable>
        </View>
      )}

      {!loading && projects.length === 0 && !showForm && (
        <View
          style={[
            styles.empty,
            {
              backgroundColor: ui.surface,
              borderColor: ui.border,
            },
          ]}
        >
          <BriefcaseBusiness size={26} color={ui.muted} />
          <Text
            style={{
              color: ui.muted,
              textAlign,
              marginTop: 8,
              fontSize: 12,
            }}
          >
            هنوز پروژه‌ای ثبت نشده است.
          </Text>
        </View>
      )}

      {projects.map((project) => (
                  <Pressable
            key={project.id}
            onPress={() =>
              router.push({
                pathname: '/project/[id]',
                params: { id: project.id },
              })
            }
            style={[
              styles.card,
              {
                backgroundColor: ui.surface,
                borderColor: ui.border,
              },
            ]}
          >

          <Text
            style={[
              styles.title,
              {
                color: ui.text,
                textAlign,
              },
            ]}
          >
            {project.name}
          </Text>

          <Text
            style={{
              color: ui.muted,
              fontSize: 10,
              marginTop: 5,
              textAlign,
            }}
          >
            کد پروژه: {project.code}
          </Text>

          {!!project.description && (
            <Text
              style={[
                styles.desc,
                {
                  color: ui.muted,
                  textAlign,
                },
              ]}
            >
              {project.description}
            </Text>
          )}

          <View
            style={[
              styles.footer,
              {
                flexDirection: rowDirection,
              },
            ]}
          >
            <View
              style={[
                styles.status,
                {
                  backgroundColor: ui.surfaceAlt,
                },
              ]}
            >
              <Text
                style={{
                  color: ui.accent,
                  fontSize: 10,
                  fontWeight: '800',
                }}
              >
                {getStatusLabel(project.status)}
              </Text>
            </View>

            <Text style={{ color: ui.muted, fontSize: 10 }}>
              {new Date(project.createdAt).toLocaleDateString('fa-IR')}
            </Text>
          </View>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 7,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  form: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 14,
    gap: 9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  area: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  save: {
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  loading: {
    alignItems: 'center',
    gap: 9,
    padding: 20,
  },
  error: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    marginBottom: 9,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  desc: {
    fontSize: 11.5,
    lineHeight: 20,
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  status: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
