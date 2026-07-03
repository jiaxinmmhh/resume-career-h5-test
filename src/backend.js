function trimSlash(value = '') {
  return value.replace(/\/+$/, '');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `请求失败：HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function hasBackend(settings = {}) {
  return Boolean(settings.backendUrl?.trim() && settings.customerId?.trim());
}

export function getBackendBase(settings = {}) {
  return trimSlash(settings.backendUrl?.trim() || '');
}

export async function fetchBackendAccount(settings) {
  return requestJson(
    `${getBackendBase(settings)}/api/account?customerId=${encodeURIComponent(settings.customerId)}`,
  );
}

export async function createBackendOrder(settings) {
  return requestJson(`${getBackendBase(settings)}/api/orders`, {
    method: 'POST',
    body: JSON.stringify({ customerId: settings.customerId }),
  });
}

export async function confirmBackendOrder(settings, orderId, adminToken = '') {
  return requestJson(`${getBackendBase(settings)}/api/dev/confirm-payment/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
  });
}

export async function runBackendAiAction(settings, action, payload) {
  return requestJson(`${getBackendBase(settings)}/api/ai/${action}`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      customerId: settings.customerId,
    }),
  });
}
