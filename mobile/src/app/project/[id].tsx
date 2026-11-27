
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import { AlertCircle, Users, ShieldCheck, MessageCircle, BriefcaseBusiness } from 'lucide-react-native';

import { AppScreen, Card, SectionTitle } from '../../features/common/AppScreen';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi } from '../../core/theme/gridhandUi';

import {
  getProjectDetail,
} from '../../core/network/projects';

import type {
  ProjectDetail,
  ProjectStatus,
} from '../../core/network/projects';

function errorMessage(error: unknown): string {
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
    'دریافت اطلاعات پروژه ناموفق بود'
  );
}

function statusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    PLANNING: 'برنامه‌ریزی',
    ACTIVE: 'در جریان',
    ON_HOLD: 'متوقف',
    COMPLETED: 'تکمیل‌شده',
    ARCHIVED: 'بایگانی‌شده',
  };

  return labels[status] ?? 'نامشخص';
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('شناسه پروژه معتبر نیست');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await getProjectDetail(id);
      setProject(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <AppScreen
      title="جزئیات پروژه"
      subtitle="اطلاعات و ساختار فضای کاری پروژه"
    >
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ui.accent} />
          <Text style={{ color: ui.muted, marginTop: 10 }}>
            در حال دریافت اطلاعات پروژه...
          </Text>
        </View>
      )}

      {!!error && !loading && (
        <Card ui={ui}>
          <View style={[styles.row, { flexDirection: rowDirection }]}>
            <AlertCircle size={21} color={ui.danger} />
            <Text style={{ color: ui.danger, flex: 1, textAlign }}>
              {error}
            </Text>
          </View>

          <Pressable
            onPress={() => void loadDetail()}
            style={[
              styles.retry,
              { backgroundColor: ui.accentSoft },
            ]}
          >
            <Text style={{ color: ui.accent, fontWeight: '800' }}>
              تلاش مجدد
            </Text>
          </Pressable>
        </Card>
      )}

      {!loading && !error && project && (
        <>
          <Card ui={ui}>
            <Text
              style={[
                styles.projectName,
                { color: ui.text, textAlign },
              ]}
            >
              {project.name}
            </Text>

            <Text style={[styles.code, { color: ui.muted, textAlign }]}>
              کد پروژه: {project.code}
            </Text>

            {!!project.description && (
              <Text style={[styles.description, { color: ui.muted, textAlign }]}>
                {project.description}
              </Text>
            )}

            <View
              style={[
                styles.status,
                {
                  backgroundColor: ui.accentSoft,
                  alignSelf: textAlign === 'right' ? 'flex-start' : 'flex-end',
                },
              ]}
            >
              <Text style={{ color: ui.accent, fontWeight: '800', fontSize: 11 }}>
                {statusLabel(project.status)}
              </Text>
            </View>
          </Card>

          <SectionTitle ui={ui} align={textAlign}>
            اطلاعات پایه
          </SectionTitle>

          <Card ui={ui}>
            <InfoRow
              label="نوع پروژه"
              value={project.type}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="استان"
              value={project.province}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="شهرستان"
              value={project.county}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="نشانی"
              value={project.address}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="سازمان"
              value={project.organizationName}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="کارفرما"
              value={project.employerName}
              ui={ui}
              textAlign={textAlign}
            />

            <InfoRow
              label="پیمانکار"
              value={project.contractorName}
              ui={ui}
              textAlign={textAlign}
            />
          </Card>

          <SectionTitle ui={ui} align={textAlign}>
            اعضای پروژه ({project.members.length})
          </SectionTitle>

          <Card ui={ui}>
            {project.members.length === 0 ? (
              <Text style={{ color: ui.muted, textAlign }}>
                عضوی برای این پروژه ثبت نشده است.
              </Text>
            ) : (
              project.members.map((member) => (
                <View
                  key={member.id}
                  style={[
                    styles.member,
                    { flexDirection: rowDirection, borderBottomColor: ui.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: ui.text, fontWeight: '800', textAlign }}>
                      {member.user.name || 'کاربر بدون نام'}
                    </Text>

                    {!!member.user.jobRole && (
                      <Text style={{ color: ui.muted, fontSize: 10, marginTop: 3, textAlign }}>
                        {member.user.jobRole}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.roleTag, { backgroundColor: ui.accentSoft }]}>
                    <Text style={{ color: ui.accent, fontSize: 10, fontWeight: '800' }}>
                      {member.projectRole.name}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          <SectionTitle ui={ui} align={textAlign}>
            نقش‌ها و مجوزها
          </SectionTitle>

          <Card ui={ui}>
            {project.roles.map((role) => (
              <View
                key={role.id}
                style={[
                  styles.roleItem,
                  { borderBottomColor: ui.border },
                ]}
              >
                <View style={[styles.row, { flexDirection: rowDirection }]}>
                  <ShieldCheck size={17} color={ui.accent} />

                  <Text style={{ color: ui.text, fontWeight: '800' }}>
                    {role.name}
                  </Text>
                </View>

                <Text
                  style={{
                    color: ui.muted,
                    fontSize: 10,
                    marginTop: 5,
                    textAlign,
                  }}
                >
                  {role.permissions.length} مجوز تعریف‌شده
                </Text>
              </View>
            ))}
          </Card>

          <SectionTitle ui={ui} align={textAlign}>
            زیرساخت پروژه
          </SectionTitle>

          <Card ui={ui}>
            <View style={[styles.infrastructure, { flexDirection: rowDirection }]}>
              <BriefcaseBusiness size={20} color={ui.accent} />

              <View style={{ flex: 1 }}>
                <Text style={{ color: ui.text, fontWeight: '800', textAlign }}>
                  فضای کاری اختصاصی
                </Text>
                <Text style={{ color: ui.muted, fontSize: 10, marginTop: 4, textAlign }}>
                  {project.workspace?.id || 'فضای کاری ثبت نشده است'}
                </Text>
              </View>
            </View>

            <View style={[styles.infrastructure, { flexDirection: rowDirection }]}>
              <MessageCircle size={20} color={ui.accent} />

              <View style={{ flex: 1 }}>
                <Text style={{ color: ui.text, fontWeight: '800', textAlign }}>
                  اتاق گفت‌وگوی پروژه
                </Text>
                <Text style={{ color: ui.muted, fontSize: 10, marginTop: 4, textAlign }}>
                  {project.conversation?.title || 'اتاق گفت‌وگو ثبت نشده است'}
                </Text>
              </View>
            </View>

            <View style={[styles.infrastructure, { flexDirection: rowDirection }]}>
              <Users size={20} color={ui.accent} />

              <View style={{ flex: 1 }}>
                <Text style={{ color: ui.text, fontWeight: '800', textAlign }}>
                  سازنده پروژه
                </Text>
                <Text style={{ color: ui.muted, fontSize: 10, marginTop: 4, textAlign }}>
                  {project.createdBy?.name || 'نامشخص'}
                </Text>
              </View>
            </View>
          </Card>

          <Text style={[styles.note, { color: ui.muted, textAlign }]}>
            اتاق گفت‌وگو و فضای کاری در این مرحله فقط به‌عنوان زیرساخت نمایش داده می‌شوند.
            ارسال پیام و مدیریت اعضا در مراحل بعدی فعال خواهد شد.
          </Text>
        </>
      )}
    </AppScreen>
  );
}

function InfoRow({
  label,
  value,
  ui,
  textAlign,
}: {
  label: string;
  value?: string | null;
  ui: ReturnType<typeof getUi>;
  textAlign: 'left' | 'right';
}) {
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <Text style={{ color: ui.muted, fontSize: 11, textAlign }}>
        {label}
      </Text>
      <Text style={{ color: ui.text, fontSize: 12, fontWeight: '700', textAlign }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    padding: 30,
  },
  row: {
    alignItems: 'center',
    gap: 9,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '900',
  },
  code: {
    fontSize: 10,
    marginTop: 7,
  },
  description: {
    fontSize: 12,
    lineHeight: 21,
    marginTop: 12,
  },
  status: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  infoRow: {
    paddingVertical: 9,
    gap: 5,
  },
  member: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roleTag: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  roleItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infrastructure: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  retry: {
    marginTop: 14,
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
  },
  note: {
    fontSize: 10,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 15,
  },
});
