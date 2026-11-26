import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreditCard, Info, Receipt } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

type Tier = { upTo: number; label: string; rate: string };

const DEFAULT_TIERS: Tier[] = [
  { upTo: 100, label: 'پلهٔ اول (۰ تا ۱۰۰)', rate: '500' },
  { upTo: 200, label: 'پلهٔ دوم (۱۰۱ تا ۲۰۰)', rate: '1200' },
  { upTo: 300, label: 'پلهٔ سوم (۲۰۱ تا ۳۰۰)', rate: '2200' },
  { upTo: Number.POSITIVE_INFINITY, label: 'پلهٔ چهارم (بیش از ۳۰۰)', rate: '3200' },
];

const PAYMENT_STEPS = [
  'شمارهٔ اشتراک (۱۳ رقمی) را از روی قبض یا اپلیکیشن شرکت توزیع بردارید.',
  'مبلغ قابل پرداخت را با همین محاسبهٔ تقریبی مقایسه کنید؛ مبلغ قطعی روی قبض رسمی است.',
  'پرداخت را فقط از درگاه بانکی یا اپلیکیشن رسمی شرکت توزیع انجام دهید.',
  'رسید پرداخت را تا تسویهٔ قبض نگه دارید و در صورت کسر نشدن، کد رهگیری را پیگیری کنید.',
];

export default function BillPaymentScreen() {
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const [consumption, setConsumption] = useState('250');
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [fixedFee, setFixedFee] = useState('45000');
  const [taxPercent, setTaxPercent] = useState('10');

  const result = useMemo(() => {
    const total = Number(consumption.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(total) || total < 0) return null;
    let previous = 0;
    const rows = tiers.map(tier => {
      const span = Math.max(0, Math.min(total, tier.upTo) - previous);
      previous = tier.upTo;
      const rate = Number(tier.rate) || 0;
      return { label: tier.label, kwh: span, rate, cost: span * rate };
    });
    const energy = rows.reduce((sum, row) => sum + row.cost, 0);
    const fixed = Number(fixedFee) || 0;
    const tax = (energy + fixed) * (Number(taxPercent) || 0) / 100;
    return { rows, energy, fixed, tax, payable: energy + fixed + tax };
  }, [consumption, tiers, fixedFee, taxPercent]);

  return (
    <AppScreen title="محاسبه و پرداخت قبض" subtitle="برآورد پله‌ای هزینهٔ برق و راهنمای پرداخت">
      <View style={[styles.note, { backgroundColor: ui.surfaceAlt, flexDirection: rowDirection }]}>
        <Info size={16} color={ui.blue} />
        <Text style={{ flex: 1, color: ui.muted, fontSize: 10.5, lineHeight: 18, textAlign }}>
          نرخ‌های پیش‌فرض نمونه‌اند. نرخ رسمی سال را از بخشنامهٔ شرکت توزیع وارد کنید؛ مبلغ نهایی همیشه مبلغ قبض رسمی است.
        </Text>
      </View>

      <Text style={[styles.label, { color: ui.text, textAlign }]}>مصرف ماه (کیلووات‌ساعت)</Text>
      <TextInput value={consumption} onChangeText={setConsumption} keyboardType="decimal-pad"
        style={[styles.input, { color: ui.text, backgroundColor: ui.surface, borderColor: ui.border, textAlign: 'left' }]} />

      <Text style={[styles.label, { color: ui.text, textAlign }]}>نرخ هر پله (تومان بر کیلووات‌ساعت)</Text>
      {tiers.map((tier, index) => (
        <View key={tier.label} style={[styles.tierRow, { flexDirection: rowDirection }]}>
          <Text style={[styles.tierLabel, { color: ui.muted, textAlign }]}>{tier.label}</Text>
          <TextInput
            value={tier.rate}
            keyboardType="decimal-pad"
            onChangeText={value => setTiers(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, rate: value } : row))}
            style={[styles.rateInput, { color: ui.text, backgroundColor: ui.surface, borderColor: ui.border }]}
          />
        </View>
      ))}

      <View style={[styles.twoCols, { flexDirection: rowDirection }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: ui.text, textAlign }]}>آبونمان ثابت (تومان)</Text>
          <TextInput value={fixedFee} onChangeText={setFixedFee} keyboardType="decimal-pad"
            style={[styles.input, { color: ui.text, backgroundColor: ui.surface, borderColor: ui.border, textAlign: 'left' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: ui.text, textAlign }]}>مالیات و عوارض (٪)</Text>
          <TextInput value={taxPercent} onChangeText={setTaxPercent} keyboardType="decimal-pad"
            style={[styles.input, { color: ui.text, backgroundColor: ui.surface, borderColor: ui.border, textAlign: 'left' }]} />
        </View>
      </View>

      <View style={[styles.summary, { backgroundColor: ui.surface, borderColor: ui.border }]}>
        <View style={[styles.summaryHead, { flexDirection: rowDirection }]}>
          <Receipt size={18} color={ui.accent} />
          <Text style={{ color: ui.text, fontWeight: '800', fontSize: 14 }}>برآورد هزینه</Text>
        </View>
        {!result && <Text style={{ color: ui.danger, textAlign, marginTop: 8 }}>مقدار مصرف معتبر نیست.</Text>}
        {result?.rows.filter(row => row.kwh > 0).map(row => (
          <View key={row.label} style={[styles.summaryRow, { flexDirection: rowDirection }]}>
            <Text style={[styles.summaryLabel, { color: ui.muted, textAlign }]}>{row.label} · {formatNumber(row.kwh)} kWh</Text>
            <Text style={[styles.summaryValue, { color: ui.text }]}>{formatMoney(row.cost)}</Text>
          </View>
        ))}
        {result && (
          <>
            <View style={[styles.summaryRow, { flexDirection: rowDirection, borderTopColor: ui.border }]}>
              <Text style={[styles.summaryLabel, { color: ui.muted, textAlign }]}>آبونمان + مالیات</Text>
              <Text style={[styles.summaryValue, { color: ui.text }]}>{formatMoney(result.fixed + result.tax)}</Text>
            </View>
            <View style={[styles.totalRow, { flexDirection: rowDirection, borderTopColor: ui.border }]}>
              <Text style={{ color: ui.text, fontWeight: '800', fontSize: 13 }}>مبلغ تقریبی قابل پرداخت</Text>
              <Text style={{ color: ui.accent, fontWeight: '900', fontSize: 17 }}>{formatMoney(result.payable)} تومان</Text>
            </View>
          </>
        )}
      </View>

      <View style={[styles.summary, { backgroundColor: ui.surface, borderColor: ui.border, marginTop: 12 }]}>
        <View style={[styles.summaryHead, { flexDirection: rowDirection }]}>
          <CreditCard size={18} color={ui.blue} />
          <Text style={{ color: ui.text, fontWeight: '800', fontSize: 14 }}>مراحل پرداخت</Text>
        </View>
        {PAYMENT_STEPS.map((step, index) => (
          <Text key={step} style={[styles.step, { color: ui.muted, textAlign }]}>{toFa(index + 1)}. {step}</Text>
        ))}
                <Pressable
          onPress={() =>
 Linking.openURL('https://bargheman.com/bill-inquiry-without-id')}
          accessibilityRole="link"
          accessibilityLabel="ورود به سامانه استعلام و پرداخت قبض برق"
          style={{
            marginTop: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: ui.blue,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            استعلام و پرداخت آنلاین قبض برق
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const toFa = (value: number) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const formatNumber = (value: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(value);
const formatMoney = (value: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(value));

const styles = StyleSheet.create({
  note: { alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  tierRow: { alignItems: 'center', gap: 10, marginBottom: 7 },
  tierLabel: { flex: 1, fontSize: 11 },
  rateInput: { width: 110, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, textAlign: 'left' },
  twoCols: { gap: 10 },
  summary: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16 },
  summaryHead: { alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryRow: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 8 },
  summaryLabel: { flex: 1, fontSize: 11 },
  summaryValue: { fontSize: 12, fontWeight: '700', writingDirection: 'ltr' },
  totalRow: { justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6, paddingTop: 10, gap: 8 },
  step: { fontSize: 11, lineHeight: 20, marginTop: 6 },
});
