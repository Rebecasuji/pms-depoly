import http from 'http';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/departments',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {data += chunk;});
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ /api/departments response:');
      console.log(json);
    } catch(e) {
      console.log('Response (raw):', data);
    }
  });
});

req.on('error', (e) => {console.error('Error:', e);});
req.end();
