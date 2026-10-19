fetch('/health', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error('Health check failed');
    return response.text();
  })
  .then(status => {
    document.querySelector('#container-status').textContent = `Static app: ${status}`;
  })
  .catch(() => {
    document.querySelector('#container-status').textContent = 'Static app health check unavailable';
  });