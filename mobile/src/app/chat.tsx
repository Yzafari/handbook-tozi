import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useAuth } from '../core/auth/AuthContext';
import { readLocal, writeLocal } from '../features/common/localStore';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

type Room = { id: string; label: string };
type Message = { id: string; author: string; body: string; at: string };

const ROOMS: Room[] = [
  { id: 'general', label: 'عمومی' },
  { id: 'operations', label: 'بهره‌برداری' },
  { id: 'engineeringPlanning', label: 'مهندسی' },
  { id: 'sales', label: 'مشترکین' },
  { id: 'consultant', label: 'ناظر مشاور' },
];

export default function ChatScreen() {
  const params = useLocalSearchParams<{ room?: string }>();
  const { user } = useAuth();
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const owner = user?.id ?? 'guest';
  const initialRoom = ROOMS.some(room => room.id === params.room) ? params.room! : 'general';
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [text, setText] = useState('');

  useEffect(() => {
    let active = true;
    readLocal<Record<string, Message[]>>('chat', owner, {}).then(value => { if (active) setMessages(value); }).catch(() => {});
    return () => { active = false; };
  }, [owner]);

  const current = useMemo(() => messages[room] ?? [], [messages, room]);

  const send = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    const message: Message = {
      id: `${Date.now()}`,
      author: user?.name || 'مهمان',
      body,
      at: new Date().toISOString(),
    };
    const next = { ...messages, [room]: [...(messages[room] ?? []), message] };
    setMessages(next);
    setText('');
    void writeLocal('chat', owner, next).catch(() => {});
  }, [text, messages, room, user?.name, owner]);

  return (
    <AppScreen title="گفت‌وگوی همکاران" subtitle="اتاق‌های موضوعی؛ پیام‌ها روی همین گوشی ذخیره می‌شوند." scroll={false}>
      <View style={[styles.rooms, { flexDirection: rowDirection }]}>
        {ROOMS.map(item => {
          const active = item.id === room;
          return (
            <Pressable key={item.id} onPress={() => setRoom(item.id)}
              style={[styles.room, { backgroundColor: active ? ui.accentSoft : ui.surface, borderColor: active ? ui.accent : ui.border }]}>
              <Text style={{ color: active ? ui.accent : ui.muted, fontSize: 10.5, fontWeight: '800' }}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {current.length === 0 && (
            <Text style={[styles.empty, { color: ui.muted, textAlign }]}>
              هنوز پیامی در این اتاق نیست. اولین پیام را بنویسید.
            </Text>
          )}
          {current.map(message => {
            const mine = message.author === (user?.name || 'مهمان');
            return (
              <View key={message.id} style={[styles.bubbleRow, { justifyContent: mine ? 'flex-start' : 'flex-end' }]}>
                <View style={[styles.bubble, { backgroundColor: mine ? ui.accentSoft : ui.surface, borderColor: ui.border }]}>
                  <Text style={[styles.author, { color: ui.muted, textAlign }]}>{message.author}</Text>
                  <Text style={[styles.body, { color: ui.text, textAlign }]}>{message.body}</Text>
                  <Text style={[styles.time, { color: ui.muted }]}>{new Date(message.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { flexDirection: rowDirection, borderTopColor: ui.border, backgroundColor: ui.bg }]}>
          <TextInput value={text} onChangeText={setText} placeholder="پیام خود را بنویسید..."
            placeholderTextColor={ui.muted} multiline
            style={[styles.input, { color: ui.text, backgroundColor: ui.surface, borderColor: ui.border, textAlign }]} />
          <Pressable onPress={send} disabled={!text.trim()}
            style={[styles.send, { backgroundColor: text.trim() ? ui.accent : ui.surfaceAlt }]} accessibilityLabel="ارسال پیام">
            <Send size={18} color={text.trim() ? '#04140E' : ui.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Text style={[styles.note, { color: ui.muted, textAlign }]}>
        پیام‌ها فعلاً محلی‌اند؛ ارسال به همکاران پس از اتصال سرویس گفتگوی سرور فعال می‌شود.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  rooms: { gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  room: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  messages: { paddingBottom: 12, flexGrow: 1 },
  empty: { fontSize: 12, marginTop: 24, lineHeight: 21 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubble: { maxWidth: '86%', borderWidth: 1, borderRadius: 14, padding: 11 },
  author: { fontSize: 9.5, fontWeight: '700' },
  body: { fontSize: 12.5, lineHeight: 21, marginTop: 4 },
  time: { fontSize: 9, marginTop: 5 },
  composer: { alignItems: 'flex-end', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  input: { flex: 1, maxHeight: 110, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  send: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 9.5, lineHeight: 16, marginTop: 8 },
});
