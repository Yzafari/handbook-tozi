import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Delete, History, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../core/auth/AuthContext';
import { evaluateExpression, formatCalculatorResult } from '../core/calculations/expression';
import { listCalculations, saveCalculation } from '../core/offline/repository';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi, NAVY, type Ui } from '../core/theme/gridhandUi';

type CalculationEntry = { id: string; expression: string; result: string; createdAt: string };
type Tab = 'Calc' | 'Complex' | 'Convert' | 'Graph';
const TAB_LABELS: Record<Tab, string> = { Calc: 'محاسبه', Complex: 'مختلط', Convert: 'تبدیل واحد', Graph: 'نمودار' };

/**
 * Degree mode is applied to the whole expression once, with parenthesis-aware
 * rewriting of each trig argument. Rewriting the display text separately (as
 * the old preview did) produced a different value from the one the Calculate
 * button returned.
 */
function toRadians(expression: string): string {
  return expression.replace(/\b(sin|cos|tan)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
    (_match, fn: string, arg: string) => `${fn}((${arg})*pi/180)`);
}
type Complex = { re: number; im: number };

const ROWS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['(', '0', '.', ')'],
];
const OPERATORS = ['÷', '×', '−', '+', '%'];

/**
 * Key grids are rendered exactly as declared. The app root pins Yoga to LTR
 * (`_layout.tsx`), so a calculator's digits stay in their natural order on a
 * Persian device without reversing them a second time.
 */

/** Persian <-> English number display for inputs and expressions. */
const fromFa = (value: string) => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

const toFa = (v: string) =>
  v.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]).replace(/\./g, '٫');

const pretty = (v: string) =>
  toFa(v.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−'));

const cleanNumber = (n: number) =>
  Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(12));

const formatComplex = ({ re, im }: Complex) => {
  const a = cleanNumber(re);
  const b = cleanNumber(im);
  if (b === 0) return String(a);
  if (a === 0) return `${b}i`;
  return `${a}${b < 0 ? '' : '+'}${b}i`;
};

function parseComplex(value: string): Complex {
  const input = value.replace(/\s/g, '').replace(/−/g, '-');
  if (!input) throw new Error('مقدار مختلط را وارد کنید');

  const polar = /^([+-]?(?:\d+\.?\d*|\.\d+))∠([+-]?(?:\d+\.?\d*|\.\d+))(?:°)?$/.exec(input);
  if (polar) {
    const radius = Number(polar[1]);
    const angle = Number(polar[2]) * Math.PI / 180;
    return { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
  }

  const rectangular = /^([+-]?(?:\d+\.?\d*|\.\d+))?([+-](?:\d+\.?\d*|\.\d+))?i$/.exec(input);
  if (rectangular) {
    const real = rectangular[1] ? Number(rectangular[1]) : 0;
    const imaginaryPart = rectangular[2] || '+1';
    return { re: real, im: imaginaryPart === '+' ? 1 : imaginaryPart === '-' ? -1 : Number(imaginaryPart) };
  }

  const real = Number(input);
  if (!Number.isFinite(real)) throw new Error('فرمت عدد مختلط معتبر نیست');
  return { re: real, im: 0 };
}

function calculateComplex(a: Complex, b: Complex, operation: string): Complex {
  let result: Complex;

  if (operation === '+') result = { re: a.re + b.re, im: a.im + b.im };
  else if (operation === '−') result = { re: a.re - b.re, im: a.im - b.im };
  else if (operation === '×') {
    result = { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  } else if (operation === '÷') {
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator === 0) throw new Error('تقسیم بر صفر مجاز نیست');
    result = {
      re: (a.re * b.re + a.im * b.im) / denominator,
      im: (a.im * b.re - a.re * b.im) / denominator,
    };
  } else {
    throw new Error('عملگر مختلط معتبر نیست');
  }

  if (!Number.isFinite(result.re) || !Number.isFinite(result.im)) {
    throw new Error('نتیجه خارج از دامنه مجاز است');
  }
  return { re: cleanNumber(result.re), im: cleanNumber(result.im) };
}

const CONVERSIONS = [
  { category: 'طول', units: ['m', 'km', 'cm', 'mm', 'ft', 'in'], factors: [1, 1000, 0.01, 0.001, 0.3048, 0.0254] },
  { category: 'جرم', units: ['kg', 'g', 'mg', 't', 'lb'], factors: [1, 0.001, 0.000001, 1000, 0.45359237] },
  { category: 'زمان', units: ['s', 'min', 'h', 'day'], factors: [1, 60, 3600, 86400] },
  { category: 'توان', units: ['W', 'kW', 'MW', 'HP'], factors: [1, 1000, 1000000, 745.699872] },
  { category: 'انرژی', units: ['J', 'kJ', 'Wh', 'kWh'], factors: [1, 1000, 3600, 3600000] },
  { category: 'ولتاژ', units: ['V', 'mV', 'kV'], factors: [1, 0.001, 1000] },
  { category: 'جریان', units: ['A', 'mA', 'kA'], factors: [1, 0.001, 1000] },
  { category: 'مقاومت', units: ['Ω', 'mΩ', 'kΩ', 'MΩ'], factors: [1, 0.001, 1000, 1000000] },
];

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(cleanNumber(value));

export default function CalculatorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useAppSettings();
  const { isDark, isRTL, rowDirection, textAlign } = useDesignTokens();
  const ui = getUi(isDark);
  const s = useMemo(() => createStyles(ui, rowDirection, textAlign), [ui, rowDirection, textAlign]);
  const userId = user?.id ?? 'guest';

  const [tab, setTab] = useState<Tab>('Calc');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CalculationEntry[]>([]);
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG');
  const [notation, setNotation] = useState<'ENG' | 'SCI' | 'FIX'>('ENG');
  const [fixDigits, setFixDigits] = useState(4);

  const [complexA, setComplexA] = useState('3+4i');
  const [complexB, setComplexB] = useState('1+2i');
  const [complexOperation, setComplexOperation] = useState('×');
  const [complexResult, setComplexResult] = useState('');

  const [conversionIndex, setConversionIndex] = useState(0);
  const [fromUnit, setFromUnit] = useState(0);
  const [toUnit, setToUnit] = useState(1);
  const [conversionInput, setConversionInput] = useState('1');

  const [graphExpression, setGraphExpression] = useState('sin(x)');
  const [graphRange, setGraphRange] = useState('10');
  const [graphPoints, setGraphPoints] = useState<number[]>([]);
  const [graphError, setGraphError] = useState('');

  const loadHistory = useCallback(async () => {
    const items = await listCalculations(userId).catch(() => []);
    setHistory(items.slice(0, 8) as CalculationEntry[]);
  }, [userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const formatDisplay = useCallback((value: number) => {
    if (!Number.isFinite(value)) return '—';
    if (notation === 'SCI') return value.toExponential(fixDigits);
    if (notation === 'FIX') return value.toFixed(fixDigits);
    return formatCalculatorResult(value);
  }, [notation, fixDigits]);

  const preparedExpression = useMemo(
    () => (angleMode === 'RAD' ? fromFa(expression) : toRadians(fromFa(expression))),
    [expression, angleMode],
  );

  const preview = useMemo(() => {
    if (!preparedExpression.trim()) return null;
    try { return formatDisplay(evaluateExpression(preparedExpression)); }
    catch { return null; }
  }, [preparedExpression, formatDisplay]);

  const pressKey = (key: string) => {
    setError('');
    setResult(null);

    if (key === 'C') {
      setExpression('');
      return;
    }
    if (key === '⌫') {
      setExpression(value => value.slice(0, -1));
      return;
    }

    const mapped = key === '×' ? '*' : key === '÷' ? '/' : key === '−' ? '-' : key;
    setExpression(value => (value + mapped).slice(0, 120));
  };

  const calculate = async () => {
    try {
      const value = evaluateExpression(preparedExpression);
      setResult(formatDisplay(value));
      setError('');

      await saveCalculation({
        userId,
        calculatorId: 'general',
        formulaVersion: '1.0.0',
        inputs: { expression, angleMode, notation },
        result: { value },
      }).catch(() => {});

      await loadHistory();
    } catch (e: any) {
      setResult(null);
      setError(e?.message || t('calculationFailed'));
    }
  };

  const calculateComplex = () => {
    try {
      const a = parseComplex(complexA);
      const b = parseComplex(complexB);
      const value = calculateComplexValues(a, b, complexOperation);
      setComplexResult(formatComplex(value));
      setError('');
    } catch (e: any) {
      setComplexResult('');
      setError(e?.message || 'محاسبه اعداد مختلط ناموفق بود');
    }
  };

  const conversion = useMemo(() => {
    const group = CONVERSIONS[conversionIndex];
    const value = Number(conversionInput);
    if (!Number.isFinite(value)) return null;
    return value * group.factors[fromUnit] / group.factors[toUnit];
  }, [conversionIndex, conversionInput, fromUnit, toUnit]);

  const runGraph = () => {
    try {
      const range = Number(graphRange);
      if (!Number.isFinite(range) || range <= 0 || range > 100000) {
        throw new Error('بازه نمودار باید عددی مثبت باشد');
      }
      const values: number[] = [];
      for (let i = 0; i <= 40; i++) {
        const x = -range + (2 * range * i / 40);
        const formula = graphExpression.replace(/\bx\b/gi, `(${x})`);
        values.push(evaluateExpression(angleMode === 'RAD' ? fromFa(formula) : toRadians(fromFa(formula))));
      }
      if (values.some(value => !Number.isFinite(value))) {
        throw new Error('نمودار شامل مقدار نامعتبر است');
      }
      setGraphPoints(values);
      setGraphError('');
    } catch (e: any) {
      setGraphPoints([]);
      setGraphError(e?.message || 'رسم نمودار ناموفق بود');
    }
  };

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const shown = result ?? preview;
  const conversionGroup = CONVERSIONS[conversionIndex];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={8}>
          <BackIcon size={20} color={ui.text} />
        </Pressable>
        <Text style={s.heading}>{t('calculator')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.tabs}>
          {(['Calc', 'Complex', 'Convert', 'Graph'] as Tab[]).map(item => (
            <Pressable key={item} onPress={() => { setTab(item); setError(''); }} style={[s.tab, tab === item && s.tabActive]}
              accessibilityRole="tab" accessibilityState={{ selected: tab === item }}>
              <Text style={[s.tabText, tab === item && s.tabTextActive]}>{TAB_LABELS[item]}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Calc' && (
          <>
            <LinearGradient colors={NAVY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.display}>
              <View style={s.settingsRow}>
                <Pressable onPress={() => setAngleMode(value => value === 'DEG' ? 'RAD' : 'DEG')} style={s.settingPill}>
                  <Text style={s.settingText}>{angleMode}</Text>
                </Pressable>
                {(['ENG', 'SCI', 'FIX'] as const).map(item => (
                  <Pressable key={item} onPress={() => setNotation(item)} style={[s.settingPill, notation === item && s.settingSelected]}>
                    <Text style={s.settingText}>{item}</Text>
                  </Pressable>
                ))}
                {notation === 'FIX' && (
                  <Pressable onPress={() => setFixDigits(value => value >= 8 ? 0 : value + 1)} style={s.settingPill}>
                    <Text style={s.settingText}>{fixDigits}</Text>
                  </Pressable>
                )}
              </View>
              <Text style={s.expression} numberOfLines={2}>{expression ? pretty(expression) : toFa('0')}</Text>
              <Text style={[s.result, result === null && s.resultPreview]} numberOfLines={1} adjustsFontSizeToFit>
                {shown ? `= ${toFa(shown)}` : ' '}
              </Text>
              {!!error && <Text style={s.error}>{error}</Text>}
            </LinearGradient>

            <View style={s.functionRows}>
              {[
                ['sin(', 'cos(', 'tan(', 'sqrt('],
                ['asin(', 'acos(', 'atan(', 'log('],
                ['ln(', 'abs(', 'pi', 'e'],
                ['^', '*', '/', '−'],
              ].map((row, index) => (
                <View key={index} style={s.functionRow}>
                  {row.map(key => (
                    <Pressable key={key} style={s.functionKey} onPress={() => {
                      setExpression(value => (value + key).slice(0, 120));
                      setResult(null);
                    }}>
                      <Text style={s.functionText}>{key}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            <View style={s.keypad}>
              {ROWS.map((row, index) => (
                <View key={index} style={s.keyRow}>
                  {row.map(key => {
                    const op = OPERATORS.includes(key);
                    const isClear = key === 'C';
                    const isDel = key === '⌫';
                    return (
                      <Pressable key={key} onPress={() => pressKey(key)}
                        accessibilityRole="button"
                        accessibilityLabel={isDel ? 'delete' : key}
                        style={({ pressed }) => [
                          s.key, op && s.keyOp, isClear && s.keyClear, isDel && s.keyDel,
                          pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                        ]}>
                        {isDel
                          ? <Delete size={22} color={ui.muted} />
                          : <Text style={[s.keyText, op && { color: ui.accent }, isClear && { color: ui.danger }]}>{toFa(key)}</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Pressable onPress={() => void calculate()} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <LinearGradient colors={['#18D68C', '#00A36C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.equals}>
                <Text style={s.equalsText}>= {t('calculate')}</Text>
              </LinearGradient>
            </Pressable>

            <View style={s.historyHead}>
              <View style={s.historyTitleRow}>
                <History size={18} color={ui.accent} />
                <Text style={s.historyTitle}>{t('recentCalculations')}</Text>
              </View>
              <Pressable onPress={() => void loadHistory()} style={s.refreshBtn} hitSlop={8}>
                <RefreshCw size={13} color={ui.blue} />
                <Text style={s.refreshText}>{t('refresh')}</Text>
              </Pressable>
            </View>

            {history.length ? history.map(item => (
              <Pressable key={item.id} style={s.historyRow}
                onPress={() => { setExpression(item.expression); setResult(item.result); setError(''); }}>
                <Text style={s.historyExpr} numberOfLines={1}>{pretty(item.expression)}</Text>
                <Text style={s.historyResult}>{toFa(formatCalculatorResult(Number(item.result)))}</Text>
              </Pressable>
            )) : <Text style={s.empty}>{t('historyEmpty')}</Text>}
            <Text style={s.note}>{t('historyOffline')}</Text>
          </>
        )}

        {tab === 'Complex' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>محاسبات اعداد مختلط</Text>
            <Text style={s.help}>نمونه ورودی: 3+4i یا 5∠30°</Text>
            <Text style={s.fieldLabel}>عدد اول</Text>
            <TextInput value={complexA} onChangeText={setComplexA} style={s.input} autoCapitalize="none" />
            <Text style={s.fieldLabel}>عملگر</Text>
            <View style={s.operationRow}>
              {['+', '−', '×', '÷'].map(op => (
                <Pressable key={op} onPress={() => setComplexOperation(op)} style={[s.operationButton, complexOperation === op && s.operationSelected]}>
                  <Text style={s.operationText}>{op}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>عدد دوم</Text>
            <TextInput value={complexB} onChangeText={setComplexB} style={s.input} autoCapitalize="none" />
            <Pressable onPress={calculateComplex} style={s.primaryButton}>
              <Text style={s.primaryText}>محاسبه</Text>
            </Pressable>
            {!!complexResult && <Text style={s.output}>نتیجه: {complexResult}</Text>}
            {!!error && <Text style={s.errorPlain}>{error}</Text>}
          </View>
        )}

        {tab === 'Convert' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>تبدیل واحدها</Text>
            <Text style={s.fieldLabel}>گروه کمیت</Text>
            <View style={s.wrapRow}>
              {CONVERSIONS.map((item, index) => (
                <Pressable key={item.category} onPress={() => {
                  setConversionIndex(index);
                  setFromUnit(0);
                  setToUnit(Math.min(1, item.units.length - 1));
                }} style={[s.chip, conversionIndex === index && s.chipActive]}>
                  <Text style={[s.chipText, conversionIndex === index && s.chipTextActive]}>{item.category}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>مقدار</Text>
            <TextInput value={conversionInput} onChangeText={setConversionInput} keyboardType="decimal-pad" style={s.input} />
            <Text style={s.fieldLabel}>از واحد</Text>
            <View style={s.wrapRow}>
              {conversionGroup.units.map((unit, index) => (
                <Pressable key={unit} onPress={() => setFromUnit(index)} style={[s.chip, fromUnit === index && s.chipActive]}>
                  <Text style={[s.chipText, fromUnit === index && s.chipTextActive]}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>به واحد</Text>
            <View style={s.wrapRow}>
              {conversionGroup.units.map((unit, index) => (
                <Pressable key={unit} onPress={() => setToUnit(index)} style={[s.chip, toUnit === index && s.chipActive]}>
                  <Text style={[s.chipText, toUnit === index && s.chipTextActive]}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.output}>
              {conversion === null ? 'مقدار ورودی معتبر نیست' : `${formatValue(Number(conversionInput))} ${conversionGroup.units[fromUnit]} = ${formatValue(conversion)} ${conversionGroup.units[toUnit]}`}
            </Text>
          </View>
        )}

        {tab === 'Graph' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>نمودار تابع</Text>
            <Text style={s.help}>متغیر x را در عبارت وارد کنید؛ مانند sin(x) یا x^2</Text>
            <Text style={s.fieldLabel}>تابع y =</Text>
            <TextInput value={graphExpression} onChangeText={setGraphExpression} style={s.input} autoCapitalize="none" />
            <Text style={s.fieldLabel}>بازه مثبت و منفی محور x</Text>
            <TextInput value={graphRange} onChangeText={setGraphRange} keyboardType="decimal-pad" style={s.input} />
            <Pressable onPress={runGraph} style={s.primaryButton}>
              <Text style={s.primaryText}>رسم نمودار</Text>
            </Pressable>
            {!!graphError && <Text style={s.errorPlain}>{graphError}</Text>}
            {graphPoints.length > 0 && (
              <>
                <View style={s.graph}>
                  {graphPoints.map((value, index) => {
                    const finiteValues = graphPoints.filter(Number.isFinite);
                    const min = Math.min(...finiteValues);
                    const max = Math.max(...finiteValues);
                    const spread = max - min || 1;
                    const y = 100 - ((value - min) / spread) * 90;
                    return (
                      <View key={index} style={[s.graphPoint, {
                        left: `${index / (graphPoints.length - 1) * 100}%`,
                        top: `${y}%`,
                      }]} />
                    );
                  })}
                </View>
                <Text style={s.help}>محور عمودی بر اساس حداقل و حداکثر مقادیر محاسبه‌شده مقیاس‌بندی شده است.</Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function calculateComplexValues(a: Complex, b: Complex, operation: string): Complex {
  return calculateComplex(a, b, operation);
}

const createStyles = (ui: Ui, row: 'row' | 'row-reverse', align: 'left' | 'right') => StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, alignItems: 'center', justifyContent: 'center' },
  heading: { color: ui.text, fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, alignItems: 'center' },
  tabActive: { backgroundColor: ui.accentSoft, borderColor: ui.accent },
  tabText: { color: ui.muted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: ui.accent },
  display: { borderRadius: 24, padding: 20, minHeight: 165, justifyContent: 'flex-end', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  settingPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.13)' },
  settingSelected: { backgroundColor: 'rgba(24,214,140,0.28)' },
  settingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  expression: { color: '#9FB6D1', fontSize: 22, textAlign: 'left', writingDirection: 'ltr', minHeight: 32, fontVariant: ['tabular-nums'] },
  result: { color: '#18D68C', fontSize: 36, fontWeight: '800', textAlign: 'left', writingDirection: 'ltr', marginTop: 8, fontVariant: ['tabular-nums'] },
  resultPreview: { color: 'rgba(24,214,140,0.55)' },
  error: { color: '#FFB4AB', fontSize: 12, marginTop: 8, textAlign: align },
  functionRows: { marginTop: 12, gap: 7 },
  functionRow: { flexDirection: 'row', gap: 7 },
  functionKey: { flex: 1, minHeight: 40, borderRadius: 11, backgroundColor: ui.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  functionText: { color: ui.blue, fontSize: 12, fontWeight: '700' },
    keypad: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 12,
    gap: 9,
  },
  keyRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 9,
  },
  key: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 58,
    borderRadius: 17,
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyClear: { backgroundColor: ui.dangerSoft, borderColor: 'transparent' },
  keyDel: { backgroundColor: ui.surfaceAlt, borderColor: 'transparent' },
  keyText: { color: ui.text, fontSize: 23, fontWeight: '700' },
  equals: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  equalsText: { color: '#04140E', fontSize: 17, fontWeight: '800' },
  historyHead: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  historyTitleRow: { flexDirection: row, alignItems: 'center', gap: 8 },
  historyTitle: { color: ui.text, fontSize: 15, fontWeight: '800' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  refreshText: { color: ui.blue, fontSize: 11, fontWeight: '700' },
  historyRow: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between', backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  historyExpr: { flex: 1, color: ui.muted, fontSize: 13, textAlign: 'left', writingDirection: 'ltr' },
  historyResult: { color: ui.accent, fontSize: 16, fontWeight: '800' },
  empty: { color: ui.muted, textAlign: 'center', padding: 18, fontSize: 12 },
  note: { color: ui.muted, textAlign: 'center', fontSize: 10, marginTop: 12 },
  panel: { backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 20, padding: 16, gap: 11 },
  panelTitle: { color: ui.text, fontSize: 17, fontWeight: '800', textAlign: align, marginBottom: 4 },
  help: { color: ui.muted, fontSize: 11, lineHeight: 18, textAlign: align },
  fieldLabel: { color: ui.text, fontSize: 12, fontWeight: '700', textAlign: align, marginTop: 5 },
  input: { color: ui.text, backgroundColor: ui.surfaceAlt, borderWidth: 1, borderColor: ui.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, textAlign: 'left' },
  operationRow: { flexDirection: 'row', gap: 8 },
  operationButton: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: ui.surfaceAlt, alignItems: 'center' },
  operationSelected: { backgroundColor: ui.accentSoft, borderWidth: 1, borderColor: ui.accent },
  operationText: { color: ui.text, fontSize: 20, fontWeight: '800' },
  primaryButton: { backgroundColor: ui.accent, borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#04140E', fontSize: 14, fontWeight: '800' },
  output: { color: ui.accent, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  errorPlain: { color: ui.danger, fontSize: 12, textAlign: align, marginTop: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: ui.surfaceAlt, borderWidth: 1, borderColor: ui.border },
  chipActive: { backgroundColor: ui.accentSoft, borderColor: ui.accent },
  chipText: { color: ui.muted, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: ui.accent },
  graph: { height: 190, marginTop: 12, borderRadius: 14, backgroundColor: ui.surfaceAlt, borderWidth: 1, borderColor: ui.border, overflow: 'hidden', position: 'relative' },
  graphPoint: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: ui.accent, marginLeft: -2.5, marginTop: -2.5 },
});
