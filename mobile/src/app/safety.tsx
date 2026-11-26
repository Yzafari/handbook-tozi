import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Circle, ShieldCheck } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useAuth } from '../core/auth/AuthContext';
import { readLocal, writeLocal } from '../features/common/localStore';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

const PRINCIPLES = [
  { title: 'قطع کامل و مطمئن', text: 'منبع را از هر دو سو قطع کنید و امکان وصل مجدد را با قفل و برچسب از بین ببرید.' },
  { title: 'تأیید بی‌برقی', text: 'بی‌برقی را با آشکارساز ولتاژ سالم و آزمون‌شده در نقطهٔ کار تأیید کنید؛ به چراغ نشانگر تنها اعتماد نکنید.' },
  { title: 'ارت و اتصال کوتاه حفاظتی', text: 'پیش از کار، هادی‌ها را ارت و در صورت لزوم اتصال کوتاه کنید.' },
  { title: 'حفاظت از محدودهٔ کار', text: 'محدوده را با نرده، برچسب و حضور نفر دوم کنترل کنید.' },
  { title: 'تجهیزات حفاظت فردی', text: 'کلاه، دستکش عایق با کلاس متناسب، لباس ضدقوس و کفش عایق الزامی است.' },
  { title: 'شرایط جوی', text: 'در رعد و برق، باران شدید و باد خارج از حد مجاز کار روی خط هوایی متوقف می‌شود.' },
];

const MESSAGES = [
  { id: 'm1', title: 'پیام امروز: فاصله را جدی بگیرید', text: 'نزدیک‌شدن غیرمجاز به هادی برقدار، حتی بدون تماس، می‌تواند باعث قوس و سوختگی شدید شود.' },
  { id: 'm2', title: 'پیش از مانور، نقشه را بخوانید', text: 'وضعیت کلیدها و مسیرهای تغذیهٔ پشتیبان را بررسی کنید تا قطع، ناقص نماند.' },
  { id: 'm3', title: 'گزارش حادثهٔ نزدیک‌به‌حادثه', text: 'هر رخداد بدون آسیب هم باید ثبت شود؛ همین گزارش‌ها منشأ بیشتر اصلاحات ایمنی‌اند.' },
];

const CHECKLIST = [
  'مجوز کار و هماهنگی با مرکز کنترل',
  'قطع و قفل منبع از همهٔ سوها',
  'تأیید بی‌برقی با دستگاه سالم',
  'ارت و اتصال کوتاه حفاظتی',
  'نصب حفاظ و علائم محدوده',
  'تجهیزات حفاظت فردی کامل',
];

export default function SafetyScreen() {
  const { user } = useAuth();
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const owner = user?.id ?? 'guest';
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    readLocal<string[]>('safety-checklist', owner, []).then(value => { if (active) setChecked(value); }).catch(() => {});
    return () => { active = false; };
  }, [owner]);

  const toggle = (item: string) => {
    const next = checked.includes(item) ? checked.filter(value => value !== item) : [...checked, item];
    setChecked(next);
    void writeLocal('safety-checklist', owner, next).catch(() => {});
  };

  return (
    <AppScreen title="پیام‌ها و اصول ایمنی" subtitle="قواعد کار ایمن و چک‌لیست پیش از عملیات">
      <View style={[styles.banner, { backgroundColor: ui.dangerSoft, flexDirection: rowDirection }]}>
        <AlertTriangle size={20} color={ui.danger} />
        <Text style={{ flex: 1, color: ui.danger, fontSize: 11, lineHeight: 19, textAlign }}>
          ایمنی بر سرعت اولویت دارد. در تردید، کار را متوقف کنید و با مسئول ایمنی هماهنگ کنید.
        </Text>
      </View>

      <Text style={[styles.section, { color: ui.text, textAlign }]}>پنج قاعدهٔ کار ایمن</Text>
      {PRINCIPLES.map((item, index) => (
        <View key={item.title} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <View style={[styles.head, { flexDirection: rowDirection }]}>
            <View style={[styles.number, { backgroundColor: ui.accentSoft }]}>
              <Text style={{ color: ui.accent, fontWeight: '800', fontSize: 12 }}>{toFa(index + 1)}</Text>
            </View>
            <Text style={[styles.title, { color: ui.text, textAlign }]}>{item.title}</Text>
          </View>
          <Text style={[styles.text, { color: ui.muted, textAlign }]}>{item.text}</Text>
        </View>
      ))}

      <Text style={[styles.section, { color: ui.text, textAlign }]}>پیام‌های ایمنی</Text>
      {MESSAGES.map(item => (
        <View key={item.id} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <View style={[styles.head, { flexDirection: rowDirection }]}>
            <ShieldCheck size={17} color={ui.accent} />
            <Text style={[styles.title, { color: ui.text, textAlign }]}>{item.title}</Text>
          </View>
          <Text style={[styles.text, { color: ui.muted, textAlign }]}>{item.text}</Text>
        </View>
      ))}

      <Text style={[styles.section, { color: ui.text, textAlign }]}>چک‌لیست پیش از شروع کار</Text>
      <View style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
        {CHECKLIST.map(item => {
          const done = checked.includes(item);
          return (
            <Pressable key={item} onPress={() => toggle(item)}
              style={[styles.checkRow, { flexDirection: rowDirection, borderTopColor: ui.border }]}
              accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
              {done ? <CheckCircle2 size={18} color={ui.accent} /> : <Circle size={18} color={ui.muted} />}
              <Text style={[styles.checkText, { color: done ? ui.accent : ui.text, textAlign }]}>{item}</Text>
            </Pressable>
          );
        })}
        <Text style={[styles.hint, { color: ui.muted, textAlign }]}>وضعیت چک‌لیست روی همین گوشی ذخیره می‌شود.</Text>
      </View>
    </AppScreen>
  );
}

const toFa = (value: number) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const styles = StyleSheet.create({
  banner: { alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  section: { fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 9 },
  card: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 9 },
  head: { alignItems: 'center', gap: 9, marginBottom: 6 },
  number: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 20 },
  text: { fontSize: 11.5, lineHeight: 20 },
  checkRow: { alignItems: 'center', gap: 9, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  checkText: { flex: 1, fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 10, marginTop: 8 },
});
