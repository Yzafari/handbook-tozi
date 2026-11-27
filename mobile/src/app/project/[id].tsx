import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import { AlertCircle, Users, ShieldCheck, MessageCircle, BriefcaseBusiness } from 'lucide-react-native';

import { AppScreen, Card, SectionTitle } from '../../features/common/AppScreen';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi } from '../../core/theme/gridhandUi';

import {
  getProjectDetail,
  getConversationMessages,
  sendConversationMessage,
} from '../../core/network/projects';

import type {
  ProjectDetail,
  ProjectStatus,
  ConversationMessage,
} from '../../core/network/projects';

function errorMessage(
  error: unknown,
  fallback = 'دریافت اطلاعات پروژه ناموفق بود',
): string {
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
    fallback
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

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  // --- Refs for lifecycle safety and request tracing ---
  const isMountedRef = useRef(true);
  const projectIdRef = useRef<string | undefined>(id);
  const messagesScrollRef = useRef<ScrollView>(null);
  const shouldScrollToEndRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep latest project id so async callbacks can validate staleness.
  useEffect(() => {
    projectIdRef.current = id;
  }, [id]);

  const isStale = useCallback(
    (requestedId: string) =>
      !isMountedRef.current || projectIdRef.current !== requestedId,
    [],
  );

  const trimmedDraft = messageDraft.trim();
  const canSend = !messageSending && trimmedDraft.length > 0;

  const loadDetail = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('شناسه پروژه معتبر نیست');
      setLoading(false);
      return;
    }

    const requestedId = id;
    setLoading(true);
    setError('');

    try {
      const result = await getProjectDetail(requestedId);
      if (isStale(requestedId)) return;
      setProject(result);
    } catch (err) {
      if (isStale(requestedId)) return;
      setError(errorMessage(err));
    } finally {
      if (!isStale(requestedId)) {
        setLoading(false);
      }
    }
  }, [id, isStale]);

  const loadConversationMessages = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      return;
    }

    const requestedId = id;
    setMessagesLoading(true);
    setConversationError('');

    try {
      const result = await getConversationMessages(requestedId, {
        limit: 20,
      });

      if (isStale(requestedId)) return;

      shouldScrollToEndRef.current = result.items.length > 0;
      setMessages(result.items);
      setNextMessageCursor(result.nextCursor);
      setHasMoreMessages(result.hasMore);
    } catch (err) {
      if (isStale(requestedId)) return;
      setConversationError(
        errorMessage(err, 'دریافت پیام‌های گفت‌وگو ناموفق بود'),
      );
    } finally {
      if (!isStale(requestedId)) {
        setMessagesLoading(false);
      }
    }
  }, [id, isStale]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !id ||
      typeof id !== 'string' ||
      !nextMessageCursor ||
      !hasMoreMessages ||
      olderMessagesLoading
    ) {
      return;
    }

    const requestedId = id;
    setOlderMessagesLoading(true);
    setConversationError('');

    try {
      const result = await getConversationMessages(requestedId, {
        cursor: nextMessageCursor,
        limit: 20,
      });

      if (isStale(requestedId)) return;

      setMessages((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const older = result.items.filter(
          (item) => !existingIds.has(item.id),
        );
        return [...older, ...current];
      });

      setNextMessageCursor(result.nextCursor);
      setHasMoreMessages(result.hasMore);
    } catch (err) {
      if (isStale(requestedId)) return;
      setConversationError(
        errorMessage(err, 'دریافت پیام‌های قدیمی‌تر ناموفق بود'),
      );
    } finally {
      if (!isStale(requestedId)) {
        setOlderMessagesLoading(false);
      }
    }
  }, [id, nextMessageCursor, hasMoreMessages, olderMessagesLoading, isStale]);

  const handleSendMessage = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setConversationError(
        'شناسه پروژه معتبر نیست. صفحه پروژه را دوباره باز کنید.',
      );
      return;
    }

    const content = messageDraft.trim();

    if (!content) {
      setConversationError('متن پیام خالی است. ابتدا پیام خود را بنویسید.');
      return;
    }

    if (content.length > 10000) {
      setConversationError('پیام بیش از ۱۰۰۰۰ کاراکتر است. متن را کوتاه‌تر کنید.');
      return;
    }

    if (messageSending) {
      return;
    }

    const requestedId = id;
    setMessageSending(true);
    setConversationError('');

    try {
      const message = await sendConversationMessage(requestedId, content);

      if (isStale(requestedId)) return;

      shouldScrollToEndRef.current = true;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current;
        }
        return [...current, message];
      });

      setMessageDraft('');
    } catch (err) {
      if (isStale(requestedId)) return;
      setConversationError(errorMessage(err, 'ارسال پیام ناموفق بود'));
    } finally {
      if (!isStale(requestedId)) {
        setMessageSending(false);
      }
    }
  }, [id, messageDraft, messageSending, isStale]);

  // Reset conversation state whenever the project id changes (or on mount),
  // then load the freshest page.
  useEffect(() => {
    setMessages([]);
    setNextMessageCursor(null);
    setHasMoreMessages(false);
    setMessageDraft('');
    setConversationError('');
    setMessageSending(false);
    setOlderMessagesLoading(false);

    void loadConversationMessages();
  }, [loadConversationMessages]);

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
            style={[styles.retry, { backgroundColor: ui.accentSoft }]}
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
            <Text style={[styles.projectName, { color: ui.text, textAlign }]}>
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
            <InfoRow label="نوع پروژه" value={project.type} ui={ui} textAlign={textAlign} />
            <InfoRow label="استان" value={project.province} ui={ui} textAlign={textAlign} />
            <InfoRow label="شهرستان" value={project.county} ui={ui} textAlign={textAlign} />
            <InfoRow label="نشانی" value={project.address} ui={ui} textAlign={textAlign} />
            <InfoRow label="سازمان" value={project.organizationName} ui={ui} textAlign={textAlign} />
            <InfoRow label="کارفرما" value={project.employerName} ui={ui} textAlign={textAlign} />
            <InfoRow label="پیمانکار" value={project.contractorName} ui={ui} textAlign={textAlign} />
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
              <View key={role.id} style={[styles.roleItem, { borderBottomColor: ui.border }]}>
                <View style={[styles.row, { flexDirection: rowDirection }]}>
                  <ShieldCheck size={17} color={ui.accent} />
                  <Text style={{ color: ui.text, fontWeight: '800' }}>
                    {role.name}
                  </Text>
                </View>

                <Text style={{ color: ui.muted, fontSize: 10, marginTop: 5, textAlign }}>
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

          <SectionTitle ui={ui} align={textAlign}>
            گفت‌وگوی پروژه
          </SectionTitle>

          <Card ui={ui}>
            {messagesLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={ui.accent} />
                <Text style={{ color: ui.muted, marginTop: 8 }}>
                  در حال دریافت پیام‌ها...
                </Text>
              </View>
            ) : (
              <>
                {!!conversationError && (
                  <View
                    style={[
                      styles.conversationError,
                      { backgroundColor: ui.accentSoft },
                    ]}
                  >
                    <Text style={{ color: ui.danger, textAlign, fontSize: 12 }}>
                      {conversationError}
                    </Text>

                    <Pressable
                      onPress={() => void loadConversationMessages()}
                      style={styles.retry}
                    >
                      <Text style={{ color: ui.accent, fontWeight: '800' }}>
                        دریافت مجدد پیام‌ها
                      </Text>
                    </Pressable>
                  </View>
                )}

                {hasMoreMessages && (
                  <Pressable
                    disabled={olderMessagesLoading}
                    onPress={() => void loadOlderMessages()}
                    style={[styles.loadOlder, { backgroundColor: ui.accentSoft }]}
                  >
                    {olderMessagesLoading ? (
                      <ActivityIndicator size="small" color={ui.accent} />
                    ) : (
                      <Text style={{ color: ui.accent, fontWeight: '800' }}>
                        دریافت پیام‌های قدیمی‌تر
                      </Text>
                    )}
                  </Pressable>
                )}

                {messages.length === 0 && !conversationError ? (
                  <Text
                    style={{
                      color: ui.muted,
                      textAlign: 'center',
                      paddingVertical: 20,
                    }}
                  >
                    هنوز پیامی در گفت‌وگوی این پروژه ثبت نشده است.
                    اولین پیام را ارسال کنید.
                  </Text>
                ) : (
                  <ScrollView
                    ref={messagesScrollRef}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    style={styles.messagesScroll}
                    onContentSizeChange={() => {
                      if (shouldScrollToEndRef.current) {
                        shouldScrollToEndRef.current = false;
                        messagesScrollRef.current?.scrollToEnd({ animated: false });
                      }
                    }}
                  >
                    {messages.map((message) => (
                      <View
                        key={message.id}
                        style={[styles.messageItem, { borderBottomColor: ui.border }]}
                      >
                        <View style={[styles.messageHeader, { flexDirection: rowDirection }]}>
                          <Text
                            style={{
                              color: ui.text,
                              fontWeight: '800',
                              flex: 1,
                              textAlign,
                            }}
                          >
                            {message.sender?.name || 'کاربر بدون نام'}
                          </Text>

                          <Text style={{ color: ui.muted, fontSize: 10 }}>
                            {new Date(message.createdAt).toLocaleString('fa-IR')}
                          </Text>
                        </View>

                        <Text
                          style={{
                            color: ui.text,
                            textAlign,
                            lineHeight: 23,
                            marginTop: 7,
                          }}
                        >
                          {message.isDeleted || message.deletedAt
                            ? 'این پیام حذف شده است.'
                            : message.content || ''}
                        </Text>

                        {!!message.editedAt && (
                          <Text
                            style={{
                              color: ui.muted,
                              fontSize: 9,
                              textAlign,
                              marginTop: 4,
                            }}
                          >
                            ویرایش‌شده
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <View
              style={[
                styles.messageComposer,
                { borderTopColor: ui.border, flexDirection: rowDirection },
              ]}
            >
              <TextInput
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder="پیام خود را بنویسید..."
                placeholderTextColor={ui.muted}
                multiline
                maxLength={10000}
                editable={!messageSending}
                textAlign={textAlign}
                style={[
                  styles.messageInput,
                  {
                    color: ui.text,
                    backgroundColor: ui.background,
                    borderColor: ui.border,
                  },
                ]}
              />

              <Pressable
                disabled={!canSend}
                onPress={() => void handleSendMessage()}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: ui.accent,
                    opacity: canSend ? 1 : 0.5,
                  },
                ]}
              >
                {messageSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                    ارسال
                  </Text>
                )}
              </Pressable>
            </View>
          </Card>
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
  conversationError: {
    borderRadius: 10,
    padding: 11,
    marginBottom: 12,
  },
  loadOlder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
  },
  messagesScroll: {
    maxHeight: 360,
  },
  messageItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messageHeader: {
    alignItems: 'center',
    gap: 10,
  },
  messageComposer: {
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 14,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
  },
  sendButton: {
    minWidth: 62,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
