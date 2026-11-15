import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('search_errors');
const latency = new Trend('search_latency', true);
const baseUrl = __ENV.API_BASE_URL;
const token = __ENV.ACCESS_TOKEN;

export const options = {
  scenarios: {
    search_load: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 250 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    search_errors: ['rate<0.01'],
    search_latency: ['p(95)<1500'],
  },
};

export default function () {
  if (!baseUrl) throw new Error('API_BASE_URL is required');
  const query = ['ترانسفورماتور', 'افت ولتاژ', 'کابل خودنگهدار', 'حفاظت شبکه'][__VU % 4];
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = http.get(`${baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&limit=20`, { headers, tags: { endpoint: 'search' } });
  latency.add(response.timings.duration);
  const valid = check(response, {
    'status is 200': r => r.status === 200,
    'response has success envelope': r => {
      try { const body = r.json(); return body.success === true && Array.isArray(body.data); } catch { return false; }
    },
  });
  errors.add(!valid);
  sleep(1);
}
