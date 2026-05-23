
const http = require('http');

function post(path, data) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: tryParse(body) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function get(path, token) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: tryParse(body) }));
        });
        req.on('error', reject);
        req.end();
    });
}

function tryParse(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
}

async function run() {
    try {
        console.log('Logging in as E0001...');
        const loginData = JSON.stringify({ employeeCode: 'E0001', password: 'admin123' });
        const loginRes = await post('/api/login', loginData);

        if (loginRes.status !== 200) {
            console.error('Login failed:', loginRes.status, loginRes.body);
            return;
        }

        const token = loginRes.body.token;
        console.log('Login successful. Token obtained.');

        console.log('Fetching projects...');
        const projectsRes = await get('/api/projects', token);

        if (projectsRes.status === 200) {
            console.log('Projects fetched successfully!');
            console.log('Project count:', Array.isArray(projectsRes.body) ? projectsRes.body.length : 'Not an array');
            if (Array.isArray(projectsRes.body) && projectsRes.body.length > 0) {
                console.log('First 3 Projects Departments:', projectsRes.body.slice(0, 3).map(p => ({ title: p.title, department: p.department })));
            }
            // console.log('Projects:', JSON.stringify(projectsRes.body, null, 2)); // Too verbose
        } else {
            console.error('Failed to fetch projects (Status ' + projectsRes.status + '):', projectsRes.body);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
