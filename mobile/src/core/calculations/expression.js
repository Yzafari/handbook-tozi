const DIGITS = Object.freeze({
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
});

export function normalizeExpression(value) {
  return String(value)
    .replace(/[۰-۹٠-٩]/g, digit => DIGITS[digit])
    .replace(/[٫·]/g, '.')
    .replace(/[٬،,]/g, '')
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/π/g, 'pi');
}

const PRECEDENCE = Object.freeze({
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '^': 3,
});

const FUNCTIONS = Object.freeze({
  sqrt: value => Math.sqrt(value),
  abs: value => Math.abs(value),
  sin: value => Math.sin(value),
  cos: value => Math.cos(value),
  tan: value => Math.tan(value),
  asin: value => Math.asin(value),
  acos: value => Math.acos(value),
  atan: value => Math.atan(value),
  log: value => Math.log10(value),
  ln: value => Math.log(value),
  exp: value => Math.exp(value),
});

function tokenize(input) {
  const source = normalizeExpression(input).trim();

  if (!source || source.length > 120) {
    throw new Error('عبارت خالی یا بیش از حد طولانی است');
  }

  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);

    if (/^\s+/.test(rest)) {
      index += rest.match(/^\s+/)[0].length;
      continue;
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      index += number[0].length;
      continue;
    }

    const identifier = /^(?:sqrt|asin|acos|atan|abs|sin|cos|tan|log|ln|exp|pi|e)/i.exec(rest);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() });
      index += identifier[0].length;
      continue;
    }

    const char = source[index];
    if ('+-*/^()%'.includes(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }

    throw new Error(`نماد نامعتبر: ${char}`);
  }

  if (tokens.length > 100) {
    throw new Error('تعداد اجزای عبارت بیش از حد مجاز است');
  }

  return tokens;
}

export function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function parsePrefix() {
    const token = take();

    if (!token) throw new Error('عبارت ناقص است');

    if (token.type === 'number') return token.value;

    if (token.type === '+' || token.type === '-') {
      const value = parseExpression(3);
      return token.type === '-' ? -value : value;
    }

    if (token.type === '(') {
      const value = parseExpression(0);
      if (take()?.type !== ')') {
        throw new Error('پرانتز بسته وجود ندارد');
      }
      return value;
    }

    if (token.type === 'identifier') {
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;

      const fn = FUNCTIONS[token.value];
      if (!fn) throw new Error('تابع پشتیبانی‌نشده است');

      if (take()?.type !== '(') {
        throw new Error(`تابع ${token.value} به پرانتز نیاز دارد`);
      }

      const argument = parseExpression(0);

      if (take()?.type !== ')') {
        throw new Error('پرانتز تابع بسته نشده است');
      }

      const result = fn(argument);

      if (!Number.isFinite(result)) {
        throw new Error('ورودی تابع خارج از دامنه مجاز است');
      }

      return result;
    }

    throw new Error('ساختار عبارت معتبر نیست');
  }

  function parseExpression(minPrecedence) {
    let left = parsePrefix();

    while (position < tokens.length) {
      const operator = peek();

      if (operator.type === '%') {
        take();
        left /= 100;
        continue;
      }

      const precedence = PRECEDENCE[operator.type];

      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      take();

      const right = parseExpression(
        precedence + (operator.type === '^' ? 0 : 1)
      );

      if (operator.type === '+') left += right;
      else if (operator.type === '-') left -= right;
      else if (operator.type === '*') left *= right;
      else if (operator.type === '/') {
        if (right === 0) throw new Error('تقسیم بر صفر مجاز نیست');
        left /= right;
      } else if (operator.type === '^') {
        left = Math.pow(left, right);
      }

      if (!Number.isFinite(left) || Math.abs(left) > 1e100) {
        throw new Error('نتیجه خارج از دامنه مجاز است');
      }
    }

    return left;
  }

  const result = parseExpression(0);

  if (position !== tokens.length) {
    throw new Error('بخش اضافی یا عملگر نامعتبر در عبارت وجود دارد');
  }

  if (!Number.isFinite(result)) {
    throw new Error('نتیجه قابل محاسبه نیست');
  }

  return result;
}

export function formatCalculatorResult(value) {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 10,
  }).format(Number(value));
}
