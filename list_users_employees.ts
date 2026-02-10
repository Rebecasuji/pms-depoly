import { db } from './server/db';
import { employees, users } from './shared/schema';

async function listEmployees() {
  try {
    console.log('📋 All employees in database:');
    const allEmps = await db.select().from(employees).limit(50);
    
    if (allEmps.length === 0) {
      console.log('❌ No employees found!');
      return;
    }
    
    console.log(`Total: ${allEmps.length} employees\n`);
    allEmps.forEach(emp => {
      const code = emp.empCode || 'NULL';
      const dept = emp.department || 'N/A';
      console.log(`  ${code.padEnd(8)} | ${emp.name.padEnd(20)} | ${dept.padEnd(15)}`);
    });
    
    console.log('\n📋 All users in database:');
    const allUsers = await db.select().from(users);
    console.log(`Total: ${allUsers.length} users\n`);
    allUsers.forEach(u => {
      console.log(`  ${u.username.padEnd(20)} | Role: ${u.role.padEnd(8)} | EmployeeID: ${u.employeeId || 'NONE'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listEmployees();
